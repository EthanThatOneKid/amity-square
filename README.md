# amity-square

A self-contained Pokémon-style park explorer built on Zo Space. Navigate with WASD/arrows, avoid water/trees/fences, and watch an authentic Pikachu follower trail behind Lucas with animated lag.

**Live:** [https://etok.zo.space/amity-square](https://etok.zo.space/amity-square)

> **Zo Space mirror repo:** this repository is a tracked mirror of the live Zo Space route family for Amity Square. Keep the repo and the deployed routes in sync so Git reflects what is running now.

## Routes

| Path | Type | Description |
|------|------|-------------|
| `/amity-square` | page | Isometric park explorer |
| `/amity-square-mask-editor` | page | Collision-mask and object editor |
| `/api/amity-square-config` | API | Shared editor/game config and asset paths |
| `/api/amity-square-publish` | API | Publish mask and object changes back to the live game |
| `/api/amity-square-rollback` | API | Roll back to a saved Amity Square version |

## Controls

| Key | Action |
|-----|--------|
| `W` / `↑` | Move up |
| `S` / `↓` | Move down |
| `A` / `←` | Move left |
| `D` / `→` | Move right |

## Features

- **Authentic map art:** The live route now uses the original Platinum Amity Square map image as the background reference.
- **OBJ-derived movement mask:** Walkability is constrained by a mask generated from the original Amity Square model asset.
- **Authentic Gen 4 sprites:** Lucas overworld walk cycle plus Pikachu overworld follower sourced from Pokémon Platinum sprite sheets.
- **Camera follow:** Smooth camera tracking across the full Amity Square footprint.
- **Debug HUD:** Toggle with the "Show debug" button.

## Tech

- **Rendering:** HTML5 Canvas (pixel-perfect, 384×288 viewport via CSS `image-rendering: pixelated`)
- **No dependencies:** Pure React + Canvas API
- **Map source:** Bulbapedia `Amity_Square_Pt.png` for the top-down visual reference
- **Collision source:** The Models Resource asset `468903` (`Amity Square.zip`) for the walk mask and terrain textures
- **Sprite sourcing:** The Spriters Resource Lucas and Pokémon overworld sheets

## Architecture

- `routes/amity-square.ts` — live game route
- `routes/amity-square-mask-editor.ts` — browser editor for the walk mask and placed objects
- `routes/api/amity-square-config.ts` — shared config endpoint for the game and editor
- `routes/api/amity-square-publish.ts` — publish endpoint for new mask/object versions
- `routes/api/amity-square-rollback.ts` — rollback endpoint for restoring prior versions

## Development

Sync with the `zopack` skill in `code/workspace-root/Skills/zopack/`.
