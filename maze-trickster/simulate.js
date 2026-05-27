// Headless simulator — loads the game's physics + level data and tries a simple
// AI: walk right, jump when about to step on a hazard. Used during dev to
// validate level designs. Not part of the shipped game.

const fs = require('fs');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

global.window = { addEventListener: ()=>{} };
const noop = () => {};
global.document = {
  getElementById: () => ({
    getContext: () => new Proxy({}, { get: () => noop }),
    classList: { add: noop, remove: noop }, onclick: null,
    appendChild: noop, style: {}, innerHTML: '', textContent: ''
  }),
  documentElement: { style: { setProperty: noop } },
  createElement: () => ({ className: '', classList: { add: noop }, onclick: null, title: '', textContent: '' })
};
global.localStorage = { getItem: () => null, setItem: noop };
global.requestAnimationFrame = noop;
let t = 0;
global.performance = { now: () => t };

// Load — note the IIFE keeps everything private, so we need to inject hooks.
// Cheap trick: append code to dump game/LEVELS to globals.
// Inject globals export inside the IIFE, right before the closing })()
const hooked = script.replace(
  /^showMenu\(\);/m,
  'globalThis.__game = game; globalThis.__LEVELS = LEVELS; globalThis.__update = update; globalThis.__loadLevel = loadLevel;\nshowMenu();'
);
eval(hooked);

const game = globalThis.__game;
const LEVELS = globalThis.__LEVELS;

function simulate(levelIdx, strategy, debug) {
  globalThis.__loadLevel(levelIdx);
  game.state = 'playing';
  game.introUntil = 0;
  game.showSwitchOrderUntil = 0;
  game.keys = {};
  const maxFrames = 1500;
  let frame = 0;
  let lastDeaths = game.deaths;
  let deathsHere = 0;
  while (frame < maxFrames) {
    strategy(game, frame);
    globalThis.__update(16);
    if (debug && frame % 30 === 0) {
      const p = game.player;
      console.log(`  f${frame} x=${p.x.toFixed(0)} y=${p.y.toFixed(0)} vy=${p.vy.toFixed(1)} mir=${p.inMirror} sw=${game.switchProgress} keys=${Object.keys(game.keys).filter(k=>game.keys[k]).join(',')}`);
    }
    if (game.deaths > lastDeaths) {
      deathsHere++;
      lastDeaths = game.deaths;
      if (debug) console.log(`  f${frame} DIED #${deathsHere}`);
      if (deathsHere > 5) return { win: false, frame, reason: 'too many deaths', deaths: deathsHere };
    }
    if (game.player && game.player.won) return { win: true, frame, deaths: deathsHere };
    frame++;
  }
  return { win: false, frame, reason: 'timeout', deaths: deathsHere };
}

// Strategy: walk right, jump if next floor tile is a hazard
function walkRightWithJumps(game) {
  game.keys = {};
  game.keys['ArrowRight'] = true;
  const p = game.player;
  if (!p) return;
  const TILE = 32;
  const aheadX = p.x + p.w + 8; // look ahead a bit
  const feetY = p.y + p.h + 2;
  const aheadCol = Math.floor(aheadX / TILE);
  const floorRow = Math.floor(feetY / TILE);
  const map = game.level.map;
  const ahead = (map[floorRow] || '')[aheadCol];
  if (ahead === 'H' || ahead === 'Y' || ahead === undefined || ahead === '.') {
    // jump
    game.jumpPressed = true;
  }
}

// L4: walk right, hold down + right to swim toward bottom-right E
function l4Water(game) {
  game.keys = {};
  const p = game.player;
  if (!p) return;
  game.keys['ArrowRight'] = true;
  if (p.inWater) game.keys['ArrowDown'] = true;
  else game.jumpPressed = false; // no jumping
}

// L5: switch order — execute scripted path
function l5Switches(game, frame) {
  game.keys = {};
  const p = game.player;
  if (!p) return;
  const TILE = 32;
  const col = (p.x + p.w/2) / TILE;
  const sp = game.switchProgress;
  // sp=0: go to switch 2 (col 12)
  // sp=1: go to switch 1 (col 6)
  // sp=2: go to switch 3 (col 18), then E (col 24)
  let targetCol;
  if (sp === 0) targetCol = 12;
  else if (sp === 1) targetCol = 6;
  else if (sp === 2) targetCol = 18;
  else targetCol = 24;
  const dx = targetCol - col;
  if (dx > 0.3) game.keys['ArrowRight'] = true;
  else if (dx < -0.3) game.keys['ArrowLeft'] = true;
  // Jump if near target platform or near a hole
  const aheadX = p.x + p.w + 8;
  const ahead = (game.level.map[12] || '')[Math.floor(aheadX / TILE)];
  if (ahead === 'H') game.jumpPressed = true;
  if (Math.abs(dx) < 1.5 && sp < 3) game.jumpPressed = true; // jump onto platform
}

// L7: walk right hitting G, after flip walk left
function l7Gravity(game) {
  game.keys = {};
  const p = game.player;
  if (!p) return;
  if (game.gravityDir === 1) {
    game.keys['ArrowRight'] = true;
    const TILE = 32;
    const aheadX = p.x + p.w + 8;
    const ahead = (game.level.map[12] || '')[Math.floor(aheadX / TILE)];
    if (ahead === 'H') game.jumpPressed = true;
  } else {
    game.keys['ArrowLeft'] = true;
  }
}

// L8: walk right onto col 2 updraft, then hold up
function l8Updraft(game) {
  game.keys = {};
  const p = game.player;
  if (!p) return;
  const TILE = 32;
  const col = (p.x + p.w/2) / TILE;
  if (col < 2.4) game.keys['ArrowRight'] = true;
  else game.keys['ArrowUp'] = true;
  game.keys[' '] = (col >= 2.4); // hold space for rise
}

// L9: walk right outside mirror, walk left inside mirror (reversed)
function l9Mirror(game) {
  game.keys = {};
  const p = game.player;
  if (!p) return;
  if (p.inMirror) game.keys['ArrowLeft'] = true;
  else game.keys['ArrowRight'] = true;
  const TILE = 32;
  const aheadX = p.inMirror ? p.x - 8 : p.x + p.w + 8; // "ahead" is reversed in mirror? Actually input swap means right=left so physical motion is right
  const physicalAhead = p.x + p.w + 8;
  const ahead = (game.level.map[12] || '')[Math.floor(physicalAhead / TILE)];
  if (ahead === 'H') game.jumpPressed = true;
}

// L10: walk left through F to E
function l10Lying(game) {
  game.keys = {};
  game.keys['ArrowLeft'] = true;
}

const names = LEVELS.map((l, i) => `L${i+1} ${l.name}`);
const strategies = [
  walkRightWithJumps, walkRightWithJumps, walkRightWithJumps,
  l4Water, l5Switches, walkRightWithJumps,
  l7Gravity, l8Updraft, l9Mirror, l10Lying
];
const onlyArg = process.argv[2];
const onlyIdx = onlyArg ? parseInt(onlyArg, 10) - 1 : null;

console.log('Simulating each level with appropriate strategy:');
for (let i = 0; i < LEVELS.length; i++) {
  if (onlyIdx !== null && i !== onlyIdx) continue;
  const r = simulate(i, strategies[i], onlyIdx === i);
  const status = r.win ? `WIN  ${(r.frame/60).toFixed(1)}s ${r.deaths}d` : `FAIL ${r.reason} (${r.frame}f, ${r.deaths}d)`;
  console.log(`  ${names[i].padEnd(35)} ${status}`);
}
