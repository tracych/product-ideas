# Maze Trickster

A self-contained HTML game. The maze lies. Floors vanish. Doors deceive. Trust nothing — remember everything.

## Play

Open `index.html` in any modern browser. No build, no server, no dependencies.

## Controls

- **← →** or **A D** &mdash; move
- **Space** / **↑** / **W** &mdash; jump (also rises in water and updrafts)
- **↓** / **S** &mdash; descend (in water/updraft)
- **R** &mdash; retry current level
- **Esc** &mdash; back to menu

Progress (cleared levels + furthest reached) is saved to `localStorage`.

## The 15 levels

Each level introduces one core trick, then later levels remix them. Every death teaches one thing &mdash; same trap, same spot, every try.

| # | Name | The lie |
|---|---|---|
| 1 | Trust Nothing | A patch of floor isn't really there. |
| 2 | Don't Look Back | Floor tiles crumble shortly after you touch them. Keep moving. |
| 3 | Hidden Path | The wall blocking you isn't entirely solid. |
| 4 | Bubble Lies | Most of the pool is water. Some patches are acid &mdash; subtly warmer tint. |
| 5 | Order Matters | Three switches glow briefly at the start. Press them in that order. |
| 6 | Signs Lie | Red-tinted floor: jumping kills. Plain floor with hidden spikes: you must jump. |
| 7 | Upside Down | Purple tiles flip gravity. The exit is on the ceiling. |
| 8 | Updraft | Teal columns lift you. Hold jump to ride. The path is in the air. |
| 9 | Mirror | Inside the shaded zone, left and right swap. |
| 10 | The Lying Game | Floors are traps. Doors lie. Spikes are safe. The real exit is the one you didn't walk toward. |
| 11 | Glass Lake | The floor is ice &mdash; you can't stop on a dime. Let go of the key *before* the ledge or you glide into the crack. |
| 12 | Read My Lips | The intro hint itself lies. It begs you to jump; jumping is exactly what kills you. |
| 13 | Heartbeat | Walls breathe solid/open on a fixed, deterministic beat. Read the rhythm, walk through on the open beat. |
| 14 | Nothing Up My Sleeve | The honest level: there is no trick. Every gap is real, every floor holds. After 13 lies, players overthink the straight path. |
| 15 | Standing Ovation | The fake win: the obvious door flashes &ldquo;LEVEL CLEAR&rdquo;&hellip; then peels away. The real exit is further on. |

## Design notes

- **No combat, no enemies.** The maze is the adversary.
- **Tile-based** (25×15 grid, 32px tiles) with continuous-physics jumping.
- **Minimal palette:** white background, black character, one accent per level.
- **Instant respawn** on death &mdash; trial and error is the core loop.
- **One file**, ~1300 lines including 15 levels of map data.
- **Deterministic, never random.** Even the timed mechanics (vanishing floor, phase walls) run off a per-level frame counter, so the same beat hits the same spot every retry &mdash; and the headless simulator reproduces it exactly.

## Adding a level

Each entry in the `LEVELS` array in `index.html` is:

```js
{
  name: 'Display name',
  theme: 'Short subtitle',
  accent: '#hexcolor',
  intro: 'One-sentence hint shown on entry.',
  map: [ /* 15 strings × 25 chars each */ ],
  switchOrder: ['2','1','3'],  // optional, for memory-switch levels
  lyingHint: true,             // optional: marks that the intro hint is a deliberate lie
  honest: true,                // optional: marks a level that genuinely has no trick
}
```

Tile glyphs:

```
. empty           S start           E real exit
# solid           H invisible hole  V vanishing floor
F fake wall       D fake door       ~ water    X acid
T spikes          1 2 3 switches    G gravity flip
M mirror zone     ^ updraft         J no-jump floor
L lying spike (safe, looks deadly)  Y lying floor (deadly, looks safe)
I ice / slip floor (solid, slippery — you keep gliding)
P phase wall (breathes solid<->open on a fixed, deterministic beat)
Z fake exit (looks identical to E; flashes a win, then peels away)
```
