# amity-square

Pokémon-style isometric park explorer on Zo Space. WASD/arrow key movement, tile-based collision, camera lerp, and a pixel-art Pichu follower.

**Live:** https://etok.zo.space/amity-square

## Routes

| Path | Type | Description |
|------|------|-------------|
| `/amity-square` | page | Interactive park explorer (canvas-based) |

## Controls

- WASD or Arrow keys — move
- Collision with: water, trees, fences, bushes
- Debug overlay toggle — top-right button

## Technical Details

- Pure canvas rendering (no library)
- Camera lerp with world bounds clamping
- Pichu follower via trailing anchor-point system
- Tile world: 34×26 tiles at 16×16 px, scaled 3×

## Sync

- Routes live at: https://github.com/EthanThatOneKid/amity-square
- Export from zo.space → `bun export.ts --name amity-square`
- Import to zo.space → `bun import.ts` (from repo root)
