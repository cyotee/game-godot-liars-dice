# game-godot-liars-dice

Godot 4 **Liar’s Dice** game (Balatro-like fusion per [DESIGN.md](./DESIGN.md)).

**Status:** Design drafted; **mechanics prototype PRD** ready. Godot game implementation follows after the prototype validates the loop.

## Docs

| Doc | Purpose |
|-----|---------|
| [DESIGN.md](./DESIGN.md) | Full game design (Balatro × Liar’s Dice) |
| [prototype/PRD.md](./prototype/PRD.md) | Vite + boardgame.io mechanics prototype PRD |
| [prototype/IMPLEMENTATION_PLAN.md](./prototype/IMPLEMENTATION_PLAN.md) | boardgame.io implementation plan |

## Planned stack

- **Prototype (now):** Vite + TypeScript form UI — rules + scoring, no graphics  
- **Game (later):** Godot 4.x (GDScript)  
- **Fair play (later / multiplayer):** [fairplay-crypto-godot](https://github.com/cyotee/fairplay-crypto-godot)  
- **Stores (intent):** Steam, Itch.io, GOG, Android Play, Apple App Store; free web multiplayer-only build  

## Monorepo

Submodule of [manamesh-games](https://github.com/cyotee/manamesh-games) at `packages/game-godot-liars-dice`.

## License

**Business Source License 1.1 (BUSL-1.1)** — see [LICENSE](./LICENSE).

- Non-production use is permitted under BUSL 1.1.
- **Change Date:** 2030-07-21  
- **Change License:** GPL-2.0-or-later  

This is **not** an OSI open-source license until the Change Date (or four years after a given version’s first public release, whichever comes first).
