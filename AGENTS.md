# amity-square

Pokémon-style Amity Square reconstruction on Zo Space. WASD/arrow key movement, camera follow, authentic Platinum Lucas/Pikachu overworld sprites, and a map-image background tied to an OBJ-derived walk mask.

**Live:** https://etok.zo.space/amity-square

## Mirror Status

This repo is a mirror of the live Zo Space route at `https://etok.zo.space/amity-square`.
Treat repo updates and Zo Space updates as a paired sync operation so Git history matches the live route.

## Routes

| Path | Type | Description |
|------|------|-------------|
| `/amity-square` | page | Interactive park explorer (canvas-based) |

## Controls

- WASD or Arrow keys — move
- Collision follows the extracted Amity Square walk mask
- Debug overlay toggle — top-right button

## Technical Details

- Pure canvas rendering (no library)
- Camera lerp with world bounds clamping
- Lucas player sprite uses the first Platinum overworld walk-cycle block (4 directions)
- Pikachu follower uses Platinum overworld strip poses mapped to down/up/left/right
- Background image: Platinum Amity Square map rendered at 3x scale
- Collision mask asset: `amity-walk-mask.png`, generated from Models Resource asset `468903`
- Runtime assets are published as a zo.pub bundle: `https://zo.pub/etok/amity-square-assets`
- Lucas and Pikachu both render from authentic 32x32 Platinum overworld sheets

## Sync

- Routes live at: https://github.com/EthanThatOneKid/amity-square
- Export from zo.space → `bun export.ts --name amity-square`
- Import to zo.space → `bun import.ts` (from repo root)
