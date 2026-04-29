# amity-square

A self-contained Pokémon-style park explorer built on Zo Space. Navigate with WASD/arrows, avoid water/trees/fences, and watch an authentic Pikachu follower trail behind Lucas with animated lag.

**Live:** [https://etok.zo.space/amity-square](https://etok.zo.space/amity-square)

> **Zo Space mirror repo:** this repository is a tracked mirror of the live Zo Space route at `https://etok.zo.space/amity-square`. Keep the repo and the deployed route in sync so Git reflects what is running now.

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

- `routes/amity-square.ts` — Single-file React component (~400 lines)
- World map defined as a 34×26 tile grid with hand-coded layout
- Animation loop via `requestAnimationFrame` inside `useEffect`
- Keyboard events attached to `window` for global capture

## Development

Sync with the `zopack` skill in `code/workspace-root/Skills/zopack/`.
