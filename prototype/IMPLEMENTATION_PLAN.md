# Implementation Plan — Liar’s Dice Prototype on boardgame.io

| Field | Value |
|-------|--------|
| **PRD** | [PRD.md](./PRD.md) |
| **Design reference** | [../DESIGN.md](../DESIGN.md) (full game; **not** full MVP of this plan) |
| **Scope** | Prototype v1: one blind, 1 human + 1 AI, form UI, DESIGN scoring + one Planet stub |
| **Stack** | **boardgame.io** + **Vite** + **TypeScript** + **Vitest** |
| **Path** | `packages/game-godot-liars-dice/prototype/` |
| **License** | BUSL 1.1 (parent repo) |
| **boardgame.io source** | Prefer monorepo vendored package `packages/boardgame.io` (workspace or path dep) so behavior matches ManaMesh; fallback npm `boardgame.io` if wiring is painful |
| **Last updated** | 2026-07-21 |

This plan implements the **prototype PRD** using boardgame.io as the authoritative game engine (moves, turns, secret state, bots, tests). It does **not** implement the full Balatro ante/shop loop or Godot client.

---

## 1. Goals and done bars

### 1.1 Milestone P — Playable prototype (this plan’s “done”)

| Deliverable | Done when |
|-------------|-----------|
| **Game definition** | boardgame.io `Game` with setup, moves (`bid`, `challenge`), phases/turn order, endIf |
| **Secret dice** | `playerView` redacts opponents’ dice until reveal; own dice visible to each seat |
| **Rules** | Strictly higher bids, wild 1s, challenge resolve, die loss, overbids allowed, challenge loser starts next sub-round |
| **Scoring** | Human-only bid contrib (DESIGN base + HIGH_FACE Planet stub) + flat +30 resolution bonus when human involved |
| **Win/lose** | Score ≥ target **or** AI at 0 dice ⇒ human win; human at 0 dice ⇒ lose |
| **AI** | Dumb bot as second player via boardgame.io bot / Local multiplayer |
| **Seed** | Deterministic rolls from seed (Random plugin and/or seeded setup); seed field in UI |
| **UI** | Vite form board: seed, dice, bid form, challenge, score/target, log |
| **Tests** | Vitest + `boardgame.io/testing` Client scenarios for rules + scoring |

### 1.2 Explicitly out of this plan

- Godot project  
- Full DESIGN ante/shop/jokers/tarots/ranks  
- FairPlay / mental poker / multiplayer networking (SocketIO server optional stretch)  
- 3 AI seats  
- Production deploy  

### 1.3 Why boardgame.io (vs pure custom state)

| Concern | boardgame.io fit |
|---------|------------------|
| Turn ownership | `turn` / `order` / `endTurn` |
| Hidden dice | `playerView` / secret state patterns (see monorepo War / secret-state examples) |
| Illegal moves | `INVALID_MOVE` |
| AI seat | `boardgame.io/ai` bots or Local client with bot |
| Replay / tests | `Client` from `boardgame.io/testing` |
| Future multiplayer | Same `Game` can later attach Local → SocketIO / P2P transport |

Pure rules helpers still live **outside** move handlers where possible for unit tests without a full Client.

---

## 2. Architecture

### 2.1 Layers

```
┌─────────────────────────────────────────────────────────────┐
│  Vite UI (React or vanilla TS)                              │
│  Form: seed, bid qty/face, challenge, score, log            │
│  boardgame.io Client + Local multiplayer + Bot              │
└────────────────────────────▲────────────────────────────────┘
                             │ moves / G / ctx
┌────────────────────────────┴────────────────────────────────┐
│  boardgame.io Game: LiarsDiceBlindGame                      │
│  moves: bid, challenge                                      │
│  turn order · endIf · playerView · Random plugin            │
└────────────────────────────▲────────────────────────────────┘
                             │ pure calls
┌────────────────────────────┴────────────────────────────────┐
│  Pure modules (no boardgame.io imports preferred)           │
│  rules/*  scoring/*  types                                  │
└─────────────────────────────────────────────────────────────┘
```

**Rules:**

1. Move handlers stay thin: validate → pure function → return new `G` (or Immer plugin).  
2. Do **not** use `Date.now()` / `Math.random()` in moves (breaks determinism). Use `ctx.random` / Random plugin.  
3. Secret dice live in per-player structures filtered by `playerView`.  
4. Event log in `G.log` is public (no secret dice values until after a reveal event).

### 2.2 Player seats

| Seat | Role |
|------|------|
| `"0"` | Human |
| `"1"` | AI bot |

`maxPlayers: 2`, `minPlayers: 2` for the Game.

### 2.3 Public vs secret state

| Data | Visibility |
|------|------------|
| Dice counts per player | Public |
| Current bid, turn, score, target, status | Public |
| Own dice faces | Private (`playerView` keeps own) |
| Opponent dice faces | Hidden until `G.reveal` / after challenge |
| Last challenge actual counts / revealed dice | Public **after** challenge (stored on `G` for UI) |
| Private keys / crypto | N/A (out of scope) |

**Suggested `G` shape:**

```ts
type Bid = { qty: number; face: number }; // face 1..6

type PlayerPublic = {
  diceCount: number;
  eliminated: boolean;
};

type LiarsDiceG = {
  seed: string;                 // display / setup input
  targetScore: number;          // default 300
  score: number;                // human only
  planetHighFaceLevel: number;  // stub: 1
  players: Record<string, PlayerPublic>;
  /** Secret: only in full state; stripped for others in playerView */
  secretDice: Record<string, number[]>; // length === diceCount when rolled
  currentBid: Bid | null;
  bidderId: string | null;      // who made currentBid
  phaseTag: "playing" | "reveal" | "ended";
  winner: "0" | "1" | null;     // null if ongoing; interpret with humanPerspective
  outcome: "score" | "elim" | "player_elim" | null;
  log: LogEntry[];
  /** Set on challenge for UI; cleared on next roll */
  lastReveal: null | {
    dice: Record<string, number[]>;
    actualCount: number;
    bid: Bid;
    challengerId: string;
    bidderId: string;
    loserId: string;
  };
  playerBidsMade: number;
  subRoundsCompleted: number;
};
```

`playerView(G, ctx, playerID)`:

- Clone `G`.
- For each `id !== playerID`, set `secretDice[id]` to `[]` or omit faces (keep counts via `players[id].diceCount`).
- Keep `lastReveal` public once set (full table after challenge).

### 2.4 Phases / turns (recommended)

**Option A — single phase (simpler for prototype):**

- One phase `play`.
- Moves: `bid`, `challenge`.
- After `bid`: `endTurn` to other active player.
- After `challenge`: resolve synchronously in the move; if game not over, re-roll both, clear bid, set `ctx.currentPlayer` / use Events to set active players so **loser** is next (see §3.3).

**Option B — stages:**

- Stage `auction`: bid or challenge.  
- Stage `betweenRounds`: auto-roll (or move `ready`) — usually overkill for v1.

**Choose Option A** unless turn-order edge cases force stages.

### 2.5 AI integration

**Recommended for v1:**

1. `Local` multiplayer with two clients, **or** single Client with `numPlayers: 2` and bot on `"1"`.  
2. Use `boardgame.io/ai` with a custom bot that enumerates:

   ```ts
   // Pseudocode enumerate
   if no currentBid → generate opening bids (e.g. 1 of face 2..6, or qty 1..3)
   else → all legal raises (face+1..6 same qty; qty+1..qty+K faces 1..6) OR challenge
   ```

3. Bot policy (PRD dumb AI): prefer `face+1` if legal; else `qty+1` with `face = 2` (or 1 if raising aces); else `challenge`.  
4. Implement bot as pure function `chooseAiAction(G, ctx) → { move, args }` used by bot’s `enumerate` / `play` so unit tests can call it without Client.

**Alternative:** After human move, UI auto-dispatches AI move via `client.moves` when `ctx.currentPlayer === '1'` — works but couples UI to AI; prefer official bot if low friction.

### 2.6 Seeding / Random

boardgame.io Random plugin:

- Pass seed at match creation: `Client({ game, numPlayers: 2, multiplayer: Local(), … })` and game `seed` option if supported by version, **or**  
- Store `seed` in `G` and use a **pure seeded PRNG** module for rolls only, initialized in `setup` from match opts.

**Prototype PRD requires seed field in UI.** Practical approach:

1. `setup(ctx, setupData)` reads `setupData.seed` (string/number).  
2. Rolls call `rollDice(count, rng)` where `rng` is seeded from `setupData.seed` + `subRoundsCompleted` salt (so re-rolls differ but are deterministic).  
3. Document that boardgame.io Random plugin may still be used for bot tie-breaks if needed — prefer **one** RNG source for dice.

**Do not** mix `Math.random()` for dice.

---

## 3. Rules mapping (PRD → moves)

### 3.1 `bid(qty, face)`

**Preconditions:**

- `ctx.currentPlayer` is the mover  
- Game not ended  
- `qty ≥ 1`, `face ∈ [1,6]`  
- If `G.currentBid == null`: always legal (overbids OK)  
- Else: strictly higher per PRD  

**Effects:**

1. Set `currentBid`, `bidderId`  
2. If mover is `"0"`: compute score contrib; add to `G.score`; increment `playerBidsMade`; append log with chips/mult/contrib  
3. Check endIf score win  
4. `endTurn`  

**Invalid:** return `INVALID_MOVE`.

### 3.2 `challenge()`

**Preconditions:**

- Current player to move  
- `G.currentBid != null`  
- Game not ended  

**Effects:**

1. `actualCount = countMatches(all secretDice, bid.face)` with wild rules  
2. Determine loser: if `actualCount >= bid.qty` then challenger loses else bidder loses  
3. Decrement loser’s `diceCount`; trim `secretDice` array length  
4. If human is bidder or challenger: `score += 30`  
5. Set `lastReveal` for UI  
6. `subRoundsCompleted++`  
7. If human dice 0 → outcome lose; if AI dice 0 → win elim; if score ≥ target → win score  
8. Else: re-roll remaining players’ dice; clear bid; set next player = **loser** if still alive else the other  

### 3.3 Turn order after challenge

boardgame.io doesn’t always make “set next player to X” trivial. Patterns:

1. **`turn.order` custom** with `first` / `next` reading `G.nextPlayerId` set by challenge move.  
2. Or **`events.endTurn({ next: loserId })`** if API available in vendored version.  

**Spike (Phase 0):** Confirm in vendored boardgame.io how to force active player to challenge loser. Record snippet in plan §12.

### 3.4 Wild counting (pure)

```ts
function countMatches(allDice: number[], face: number): number {
  if (face === 1) return allDice.filter((d) => d === 1).length;
  return allDice.filter((d) => d === face || d === 1).length;
}
```

### 3.5 Scoring (pure)

- `computeBase`, `classifyBid`, `applyPlanetHighFace`, `scoreHumanBid`  
- Planet stub: if category `HIGH_FACE` and `planetHighFaceLevel >= 1`: `+15 chips`, `+0.2 mult`  
- `contrib = Math.floor(chips * mult)`  
- AI bids: no score change  

---

## 4. Repository layout (target)

```
prototype/
├── PRD.md
├── IMPLEMENTATION_PLAN.md          # this file
├── README.md
├── package.json                    # standalone; name: liars-dice-prototype
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── index.html
└── src/
    ├── main.tsx                    # or main.ts
    ├── App.tsx                     # form board
    ├── styles.css
    ├── game/
    │   ├── game.ts                 # boardgame.io Game export
    │   ├── playerView.ts
    │   ├── moves.ts                # thin wrappers
    │   └── bot.ts                  # AI enumerate / policy
    ├── rules/
    │   ├── types.ts
    │   ├── bids.ts
    │   ├── count.ts
    │   ├── roll.ts
    │   └── resolve.ts
    ├── scoring/
    │   ├── base.ts
    │   ├── categories.ts
    │   └── score.ts
    ├── rng/
    │   └── seed.ts                 # mulberry32 or similar
    └── __tests__/
        ├── bids.test.ts
        ├── count.test.ts
        ├── scoring.test.ts
        ├── resolve.test.ts
        ├── bot.test.ts
        └── game.client.test.ts     # boardgame.io Client scenarios
```

---

## 5. Dependency & tooling plan

### 5.1 package.json (sketch)

```json
{
  "name": "liars-dice-prototype",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "boardgame.io": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "vite": "^6.x",
    "vitest": "^3.x",
    "@types/react": "...",
    "@types/react-dom": "...",
    "react": "^18",
    "react-dom": "^18",
    "@vitejs/plugin-react": "..."
  }
}
```

**Dependency strategy:**

1. **Preferred:** Point `boardgame.io` at monorepo package via Yarn workspace / `portal:` / relative file dep from `packages/boardgame.io`.  
2. If PnP resolution is painful for a standalone folder: use `file:../../boardgame.io` or publish-free import from built `dist`.  
3. Phase 0 spike must pick one and document in README.

**UI library:** React recommended (boardgame.io has first-class React client). Vanilla DOM is allowed if React deps are undesired — then use `boardgame.io/client` without React.

### 5.2 boardgame.io modules to use

| Import | Use |
|--------|-----|
| `boardgame.io` Game type | Game definition |
| `boardgame.io/core` `INVALID_MOVE` | Illegal moves |
| `boardgame.io/client` or `/react` | Browser client |
| `boardgame.io/multiplayer` `Local` | 2 seats same browser |
| `boardgame.io/ai` | Bot for seat 1 |
| `boardgame.io/testing` | Automated move sequences |
| Random plugin | Optional; dice may use pure seed module |

---

## 6. Phased work packages

### Phase 0 — Scaffold + boardgame.io wiring spike (0.5–1 day)

| ID | Task | Output | Verify |
|----|------|--------|--------|
| 0.1 | Create Vite+TS(+React) app under `prototype/` | `package.json`, vite config | `yarn dev` serves page |
| 0.2 | Depend on monorepo boardgame.io | Working import `Game` | Compile |
| 0.3 | Minimal Game: `click` counter + Local Client | Smoke | Two-seat or single client works |
| 0.4 | Spike: force `next` player after move | Document API for challenge loser | Note in §12 |
| 0.5 | Spike: `playerView` hides field | Unit test with Client | Pass |
| 0.6 | README: install/dev/test | Docs | |

**Exit:** Hello boardgame.io in Vite green; turn-order + playerView spikes recorded.

### Phase 1 — Pure rules + scoring (1–2 days)

| ID | Task | Tests |
|----|------|-------|
| 1.1 | Types: Bid, Blind-like structures | — |
| 1.2 | `isValidHigherBid` + overbids | bids.test.ts |
| 1.3 | `countMatches` wild rules | count.test.ts |
| 1.4 | `rollDice(n, rng)` | seed stability |
| 1.5 | `resolveChallenge(...)` pure | resolve.test.ts |
| 1.6 | `computeBase` + categories + Planet HIGH_FACE | scoring.test.ts |
| 1.7 | Constants module: TARGET=300, RESOLUTION=30, planet bonuses | — |

**Exit:** Pure modules fully tested; no Game yet required.

### Phase 2 — boardgame.io Game definition (1–2 days)

| ID | Task | Tests |
|----|------|-------|
| 2.1 | `setup` from `setupData.seed` | initial dice deterministic |
| 2.2 | `moves.bid` | Client scenario |
| 2.3 | `moves.challenge` + re-roll + loser next | Client scenario |
| 2.4 | `playerView` | Opponent cannot see faces pre-reveal |
| 2.5 | `endIf` / outcome fields | score win, elim win, player lose |
| 2.6 | Public log entries on each move | Log length grows |

**Exit:** Full blind playable via testing Client without UI.

### Phase 3 — Bot (0.5–1 day)

| ID | Task | Tests |
|----|------|-------|
| 3.1 | `enumerateLegalActions(G, playerID)` | Includes challenge iff bid exists |
| 3.2 | `pickDumbAction` policy | Prefers face+1 etc. |
| 3.3 | Wire bot to Client for seat `"1"` | Headless or UI auto-play |

**Exit:** Human vs bot match completes without manual AI clicks (if Local+bot); or UI auto-moves seat 1.

### Phase 4 — Form UI (1–2 days)

| ID | Task | Verify |
|----|------|--------|
| 4.1 | Seed input + New match (`setupData`) | New seed new rolls |
| 4.2 | Display score, target, dice counts, own dice | Manual |
| 4.3 | Bid controls + validation feedback | Illegal bid no-op / disabled |
| 4.4 | Challenge button | Reveal panel shows lastReveal |
| 4.5 | Event log panel | Readable history |
| 4.6 | Terminal state banner | Win/lose messages |
| 4.7 | Disable inputs when not human turn / game over | Manual |

**Exit:** PRD playable form experience.

### Phase 5 — Hardening + docs (0.5 day)

| ID | Task |
|----|------|
| 5.1 | Full Vitest suite CI script |
| 5.2 | README: architecture, how to run, seed tips |
| 5.3 | Cross-link PRD acceptance checklist |
| 5.4 | Note port path to Godot / full DESIGN |

---

## 7. Testing strategy

### 7.1 Layers

| Layer | Tool | Content |
|-------|------|---------|
| Pure unit | Vitest | bids, count, resolve, scoring, seed, bot policy |
| Game integration | Vitest + `boardgame.io/testing` Client | Multi-move scripts: opening bid → AI raise → challenge → score |
| Secret state | Client with playerView | Assert stripped dice |
| Manual | Browser | Form UX |

### 7.2 Required scenarios (game.client.test.ts)

1. Human bids 2×6 → score increases by expected HIGH_FACE planet contrib.  
2. Illegal equal bid → INVALID / state unchanged.  
3. Challenge false bid → bidder loses die.  
4. Challenge true bid → challenger loses die.  
5. Score reaches ≥ 300 → game over win score.  
6. AI dice to 0 → win elim.  
7. Human dice to 0 → lose.  
8. Same seed two setups → same initial `secretDice` for both players (compare full state in test without playerView).  
9. Overbid qty > total dice still legal.  
10. After challenge, next `ctx.currentPlayer` is loser (if alive).

### 7.3 CI

- Prototype standalone: `cd prototype && yarn test`  
- Optional later: monorepo script `yarn workspace` if registered  

---

## 8. UI ↔ Client wiring (React sketch)

```tsx
// Conceptual
const { Client } = await import("boardgame.io/react");
const { Local } = await import("boardgame.io/multiplayer");
// Bot setup per boardgame.io AI docs for vendored version

function Board({ G, ctx, moves, playerID }: BoardProps<LiarsDiceG>) {
  // form fields bound to moves.bid / moves.challenge
  // show G.secretDice[playerID], G.score, G.targetScore, G.log
}
```

**Match start:** recreate Client when seed changes (new `game` seed / `setupData`).

**Debug:** optional boardgame.io debug panel — disable for clean form prototype if it conflicts with Vite (ManaMesh stubs Svelte debug; avoid enabling unless easy).

---

## 9. Mapping to monorepo patterns

| Monorepo pattern | Apply here |
|------------------|------------|
| `INVALID_MOVE` on bad input | Yes |
| Pure logic separate from Game wrapper | Yes (`rules/`, `scoring/`) |
| No `Math.random` in moves | Yes |
| Secret state + playerView | Yes (dice) |
| Testing Client | Yes |
| P2P / CryptoPlugin | **No** for prototype |
| Full multiplayer server | **No** for prototype |

Reference implementations for reading only:

- `packages/manamesh/packages/frontend/src/game/modules/war/game.ts` — Game shape  
- boardgame.io docs: secret state, AI, testing  
- `packages/boardgame.io/examples/.../secret-state`  

---

## 10. Path to full DESIGN.md / Godot (out of scope but directional)

| Later product | Reuse from this prototype |
|---------------|---------------------------|
| Godot single-player | Port pure `rules/` + `scoring/` to GDScript; drop boardgame.io or keep TS tools |
| 4 players + ranks | Extend seats + bot params |
| Shop / antes | New phases outside single blind Game or parent RunState |
| Multiplayer humans | Same Game + SocketIO or boardgameIO-p2p |
| FairPlay | Commit–reveal dice instead of server-trusted `secretDice` |

boardgame.io prototype validates **feel and formulas**; Godot remains DESIGN’s presentation target.

---

## 11. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Turn-order “set next to loser” awkward | Phase 0 spike; fallback `G.activePlayer` custom order |
| Yarn PnP + boardgame.io resolve pain | `file:` dep or use built dist; document |
| Seed vs Random plugin double-entropy | Single dice RNG from setup seed only |
| playerView leaks | Tests; never put opponent faces in `log` before reveal |
| Bot infinite loop | Max enumerate size; always allow challenge when bid exists |
| Scope creep to shop | Hard non-goals; separate plan later |

---

## 12. Phase 0 decision log (fill during spike)

| Decision | Choice | Notes |
|----------|--------|-------|
| boardgame.io package source | _TBD_ | workspace / file / npm |
| React vs vanilla Client | _TBD_ | Prefer React if trivial |
| Force next player API | _TBD_ | endTurn next / custom order |
| Dice RNG | Pure seed module vs Random plugin | Prefer pure seed for PRD seed field |
| Bot: official AI vs UI auto-move | _TBD_ | Prefer official if works |

---

## 13. Acceptance checklist (Milestone P)

- [ ] Phase 0 spikes complete; §12 filled  
- [ ] Pure rules + scoring tests green  
- [ ] boardgame.io Game: bid, challenge, end conditions  
- [ ] playerView hides opponent dice pre-reveal  
- [ ] Seeded setup deterministic  
- [ ] Dumb AI plays seat 1  
- [ ] Form UI playable end-to-end  
- [ ] Overbids, wilds, loser-starts-next, +30 resolution, HIGH_FACE planet stub  
- [ ] `yarn test` (or npm) green in `prototype/`  
- [ ] README run instructions  

---

## 14. Suggested calendar (solo)

| Phase | Effort |
|-------|--------|
| 0 Scaffold + spikes | 0.5–1 d |
| 1 Pure rules/scoring | 1–2 d |
| 2 Game definition | 1–2 d |
| 3 Bot | 0.5–1 d |
| 4 UI | 1–2 d |
| 5 Harden | 0.5 d |
| **Total** | **~5–8 days** |

---

## 15. Document history

| Date | Change |
|------|--------|
| 2026-07-21 | Initial boardgame.io implementation plan for prototype PRD |
