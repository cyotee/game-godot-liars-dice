# Liar’s Dice mechanics prototype

Form-based **boardgame.io** prototype (1 human + 1 AI, single blind).  
See [PRD.md](./PRD.md) and [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md).

## Requirements

- Node ≥ 20
- npm (standalone package; not a monorepo workspace)

## Install & run

```bash
cd packages/game-godot-liars-dice/prototype
npm install
# If Vite fails to start (esbuild blocked), allow its install script once:
#   npm install-scripts approve esbuild && npm rebuild esbuild
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

## Playtest

1. Set a **seed** (or Randomize).
2. Note **your dice**, **target** (300), **score**.
3. **Bid** qty/face (must be strictly higher than current).
4. **Challenge** when you think the AI (or you) is lying.
5. After a challenge: full reveal, ±die, +30 score if you were involved, new roll.
6. Win by **score ≥ target** or **AI at 0 dice**; lose if you hit **0 dice**.

## Tests

```bash
npm test
```

## Stack

- boardgame.io (moves, turns, playerView, Local multiplayer)
- Vite + React form UI
- Vitest unit + Client integration tests
