# amity-square

A self-contained Pokémon-style isometric park explorer built on Zo Space. Navigate with WASD/arrows, avoid water/trees/fences, and watch your Pichu follower trail behind you with animated lag.

**Live:** [https://etok.zo.space/amity-square](https://etok.zo.space/amity-square)

## Route

| Path | Type | Description |
|------|------|-------------|
| `/amity-square` | page | Isometric park explorer |

## Controls

| Key | Action |
|-----|--------|
| `W` / `↑` | Move up |
| `S` / `↓` | Move down |
| `A` / `←` | Move left |
| `D` / `→` | Move right |

## Features

- **Tile-based collision:** Water, trees, fences, and bushes are solid
- **Smooth movement:** 145ms per tile, lerped camera follow
- **Pichu follower:** Trails behind the player with configurable lag (18 frames) and bob animation
- **Animated tiles:** Water ripples, grass sways, fences render with depth
- **Debug HUD:** Toggle with the "Show debug" button (player tile coords, follower coords, facing direction)

## Tech

- **Rendering:** HTML5 Canvas (pixel-perfect, 384×288 viewport, scaled 3× via CSS `image-rendering: pixelated`)
- **No dependencies:** Pure React + Canvas API, no external sprite sheets
- **Pixel art:** All sprites drawn procedurally with `fillRect` calls

## Architecture

- `routes/amity-square.ts` — Single-file React component (~400 lines)
- World map defined as a 34×26 tile grid with hand-coded layout
- Animation loop via `requestAnimationFrame` inside `useEffect`
- Keyboard events attached to `window` for global capture

## Development

Sync with the `zopack` skill in `code/workspace-root/Skills/zopack/`.
