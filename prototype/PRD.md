# PRD — Liar’s Dice Mechanics Prototype (Vite)

| Field | Value |
|-------|--------|
| **Product** | Liar’s Dice **mechanics prototype** (form UI, no graphics) |
| **Parent game** | [game-godot-liars-dice](https://github.com/cyotee/game-godot-liars-dice) (Balatro-like fusion per `DESIGN.md`) |
| **Path** | `packages/game-godot-liars-dice/prototype/` |
| **Status** | Planning → ready for implementation |
| **Stack** | **Vite + TypeScript + Vitest** |
| **License** | **BUSL 1.1** (same as parent game repo) |
| **Last updated** | 2026-07-21 |

---

## 0. Requirements decisions (locked)

| # | Topic | Decision |
|---|--------|----------|
| 1 | **Purpose** | Validate **rules + scoring feel** of Balatro-like Liar’s Dice with minimal overhead before Godot. |
| 2 | **UI** | Simple **form-based web UI** (numbers, buttons, log). No art, no Godot. |
| 3 | **Done bar** | **One playable blind** + **automated unit tests** for rules and scoring. |
| 4 | **Match** | **1 human + 1 AI** (dumb heuristic only). |
| 5 | **Scoring** | **DESIGN.md formulas** (`compute_base`-style) + **one Planet stub** (one bid category). |
| 6 | **Win condition** | Blind ends when **player score ≥ target** **or** **AI has 0 dice**, whichever first. Player eliminated (0 dice) before target ⇒ lose. |
| 7 | **RNG** | **Seeded** PRNG; seed input in UI; same seed + same actions ⇒ same rolls. |
| 8 | **Location** | Live under `prototype/` in the game submodule. |
| 9 | **License** | BUSL 1.1 (repo root LICENSE applies). |
| 10 | **Out of scope (v1)** | Godot project; shop / full ante run; real AI ranks/personalities; polish UI/art; FairPlay/crypto; multiplayer; Tarots/Vouchers catalog; Boss modifiers. |
| 11 | **Resolution bonus** | Flat **+30** to player score when human is bidder or challenger on a challenge. |
| 12 | **Overbids** | **Allowed** — qty may exceed total dice in play (bluffs). |
| 13 | **Next sub-round starter** | **Loser of the challenge** (if still has dice); if loser is out, the remaining player starts. |
| 14 | **Package layout** | **Standalone** `prototype/package.json` (install/run inside `prototype/`; not a root Yarn workspace). |

### Relationship to DESIGN.md

| DESIGN.md concept | Prototype v1 |
|-------------------|--------------|
| Full 8-ante / 3 blinds / shop | **No** — single blind only |
| 1 human + 3 AI | **No** — 1 human + **1 AI** |
| Chips × Mult + Planets + Jokers | **Partial** — base scoring + **one** Planet stub; **no** joker pipeline unless trivial stub |
| Rank ladder / personalities | **No** — dumb AI only |
| Godot scenes / pixel art | **No** |
| Seeded runs | **Yes** (seed field) |
| Pure logic vs presentation | **Yes** — pure TS modules + thin form UI |

---

## 1. Problem

`DESIGN.md` specifies a deep Balatro × Liar’s Dice fusion. Implementing that first in Godot (project bootstrap, art pipeline, scene graph) delays feedback on the **hard product questions**:

- Do **strict bids + challenges** feel right with **score targets**?
- Do **DESIGN scoring constants** produce sensible scores vs a target (~300)?
- Is “win by score **or** elimination” clear and fun in a short session?

A **Vite form prototype** answers these with low overhead and **unit-testable pure logic** that can later port to Godot (`LiarsDiceLogic` / `ScoringSystem`).

---

## 2. Goals

### 2.1 Product goals

1. Play a **complete single blind** in a browser form UI without tutorials beyond on-screen labels.
2. Enforce **classic Liar’s Dice** rules used by DESIGN: private rolls, strictly higher bids (qty or face), wild **1s**, challenge → full reveal → loser loses 1 die.
3. Apply **player-only scoring** on each human bid and on resolutions involving the human, using DESIGN-style base formula + **one Planet** bonus for a single bid category.
4. End the blind when **score ≥ target** or **AI eliminated**; detect **player loss** if human reaches 0 dice first.
5. Support **seeded** matches for reproducible playtests.

### 2.2 Engineering goals

1. **Pure logic** in TypeScript modules (no DOM inside rules/scoring).
2. **Vitest** coverage for bid validity, wild counts, challenge outcomes, scoring contributions, seed stability for rolls.
3. One-command dev (`yarn`/`npm` + `vite`) and `vitest` from the prototype package.
4. Keep code **portable** (clear function boundaries for future Godot GDScript ports).

### 2.3 Non-goals (v1)

| Non-goal | Rationale |
|----------|-----------|
| Godot project / scenes | Deferred until mechanics validated |
| Shop, antes, cash-out, interest | Full loop later |
| 3+ AI, rank ladder, tells | Dumb AI only |
| Joker full pipeline / Tarots / Vouchers | One Planet stub is enough |
| FairPlay / multiplayer | Solo trust model (seeded RNG) |
| Pixel art, audio, particles | Form + log only |
| Deployed production hosting | Local `vite` / preview enough |
| Mobile touch optimization | Desktop form OK |

---

## 3. Users & use cases

### 3.1 Personas

| Persona | Need |
|---------|------|
| Designer / you | Play 5–10 blinds quickly; tweak constants; share a seed |
| Implementer | Green unit tests; no engine ceremony |
| Future Godot port | Pure functions that map to DESIGN systems |

### 3.2 Core use cases

1. Enter seed (or randomize) → start blind with target score (default **300**).
2. See own dice; place legal bids; see AI respond (bid or challenge).
3. Challenge or be challenged → reveal → dice loss → score update → new roll if match continues.
4. Win by target or elimination; lose if out of dice; see event log.
5. Run Vitest suite without opening a browser.

---

## 4. Rules specification (prototype)

### 4.1 Setup

| Parameter | Default |
|-----------|---------|
| Human dice | 5 |
| AI dice | 5 |
| Faces | 1–6 |
| Wilds | **1s are wild** (count toward bid face F for F ≠ 1; for face=1 bids, count 1s only — standard “1s wild for other faces”) |
| Target score | **300** (constant; configurable in code/UI optional) |
| Starting money / shop | N/A |

**Wild rule (explicit):** When counting matches for bid face `F`:

- If `F == 1`: count dice showing **1** only.
- If `F != 1`: count dice showing **F** or **1**.

(Matches common “aces wild” Liar’s Dice; document in UI help line.)

### 4.2 Bidding

- Bid = `(qty, face)` with `qty ≥ 1`, `face ∈ 1..6`.
- First bid of a sub-round: any `qty ≥ 1`, `face ∈ 1..6`. **Overbids allowed** (qty may exceed total dice in play).
- Subsequent bid must be **strictly higher**:
  - `new_qty > old_qty`, **or**
  - `new_qty == old_qty` and `new_face > old_face`.
- Invalid bids rejected by logic and disabled/blocked in UI.

### 4.3 Challenge

- On challenge: reveal all dice; compute actual count for current bid face with wilds.
- If `actual >= bid.qty`: bid was good → **challenger loses 1 die**.
- Else: bid was bad → **bidder loses 1 die**.
- If a player reaches 0 dice: they are out. With only 2 players, match ends.
- After a challenge that does not end the blind: **new roll** for remaining players with dice; clear current bid; **loser of the challenge starts** the next sub-round if they still have dice; if the loser is eliminated, the remaining player starts.

### 4.4 Turns

- Human and AI alternate. First bidder of first sub-round: **human** (simplifies UI).
- AI policy (dumb, fixed for v1):
  1. If a higher bid exists that does not increase qty beyond `total_dice`, prefer **+1 face** if face &lt; 6, else **+1 qty** with face reset to 2 (or keep face 1 if bidding aces — implement simply: try face+1, else qty+1 face=2).
  2. If no legal raise, **challenge**.
  3. Optional simple heuristic: if estimated EV low, challenge earlier — **not required for v1**; pure “raise else challenge” is enough.

---

## 5. Scoring specification (prototype)

**Only the human player’s contributions** add to `score`. AI bids do not.

### 5.1 Base (from DESIGN.md, provisional constants)

```ts
// Conceptual — implement in pure TS
function computeBase(bidQty: number, bidFace: number): { chips: number; mult: number } {
  const faceVal = bidFace === 1 ? 6 : bidFace;
  let chips = bidQty * faceVal * 8;
  let mult = 1.0 + Math.max(0, (bidQty - 2) * 0.05);
  if (bidFace === 6) mult += 0.15;
  else if (bidFace <= 2) mult += 0.10;
  return { chips, mult };
}
```

### 5.2 Bid categories + one Planet stub

Classify (from DESIGN):

| Category | Rule |
|----------|------|
| `HIGH_QUANTITY` | `qty >= 4` |
| `HIGH_FACE` | `face >= 5` (and not already higher-priority if both — **priority: HIGH_QUANTITY first, else HIGH_FACE, else RISKY_LOW if face≤2, else ANY**) |
| `RISKY_LOW` | `face <= 2` |
| `ANY` | default |

**Planet stub (v1):** Only **one** category is leveled, e.g. `HIGH_FACE` at level **1**:

- `+15 chips`, `+0.2 mult` when bid classifies as `HIGH_FACE`  
  (Align with DESIGN worked example; constants in one config module.)

No other Planets, no Jokers required in v1.

### 5.3 When score is applied

1. **On each successful human bid:** compute base → apply Planet if category matches → `contrib = floor(chips * mult)` → add to score; log breakdown.
2. **On challenge resolution if human is bidder or challenger:** add flat **`RESOLUTION_BONUS = 30`** to player score (not run through Planet/mult).

### 5.4 Actions tracking (optional for v1)

Track `playerBidsMade` and `subRoundsCompleted` for future economy; **no cash-out UI** required. May show in debug log only.

---

## 6. UI specification (form)

Single page:

```
[Seed: ____] [Randomize] [New blind]

Target: 300    Score: 0    Status: in progress | won | lost

You: 5 dice    AI: 5 dice
Your dice: 2 4 6 1 3     (hidden for AI until reveal)
Current bid: none / 2 of 6s
Turn: You | AI

Qty [ number ] Face [ select 1-6 ]  [Bid]  [Challenge]

Event log (newest last or first — pick one, stick to it)
```

Requirements:

- Disable illegal Bid / Challenge when not human turn or no current bid (challenge only if bid exists).
- After AI acts, auto-refresh state (no multi-second delays required; optional 300ms for readability).
- On reveal, show all dice in the log (and temporarily on screen).
- Terminal state message: “Won: score” / “Won: elimination” / “Lost: no dice”.

---

## 7. Architecture

```
prototype/
├── PRD.md                 # this file
├── package.json
├── vite.config.ts
├── vitest.config.ts
├── index.html
├── src/
│   ├── main.ts            # wire form ↔ state machine
│   ├── ui.ts              # DOM helpers (thin)
│   ├── rng.ts             # seeded PRNG
│   ├── rules/
│   │   ├── types.ts
│   │   ├── bids.ts        # isValidHigherBid
│   │   ├── count.ts       # wild counting
│   │   ├── match.ts       # roll, challenge resolve, die loss
│   │   └── ai.ts          # dumb AI
│   ├── scoring/
│   │   ├── base.ts
│   │   ├── categories.ts
│   │   └── score.ts       # apply bid/resolution contrib
│   └── state/
│       └── blind.ts       # BlindState + transitions
└── src/**/*.test.ts
```

**Principles:**

- `rules/` and `scoring/` have **zero** DOM imports.
- UI only calls pure functions + mutates a single blind state object/class.
- Standalone package: `package.json` name e.g. `liars-dice-prototype` with scripts `dev`, `test`, `build`. Install and run **inside** `prototype/` (not registered as a root monorepo workspace unless we choose to later).

---

## 8. Testing requirements

| Area | Tests (minimum) |
|------|-----------------|
| Bid validity | First bid OK; equal not higher rejected; qty+ and face+ accepted |
| Wild count | Face 6 with 1s; face 1 counts only 1s |
| Challenge | Correct bid → challenger loses die; false bid → bidder loses die |
| Scoring | Known bid → expected contrib with Planet on HIGH_FACE; AI bid does not add score |
| Seed | Same seed → same initial roll sequence (fixed API for rng) |
| Win | Score reaches target; AI at 0 dice; human at 0 dice loses |

Run: `yarn test` (or `npm test`) in `prototype/`.

---

## 9. Success metrics

| Metric | Target |
|--------|--------|
| Playable blind | Human can finish a blind in the form UI without console hacks |
| Tests | All required tests green in CI or local |
| Duration of a test play | Typically under ~5 minutes |
| Portability | Rules/scoring modules free of Vite/DOM |
| Docs | README in `prototype/` with `dev` / `test` commands |

---

## 10. Implementation plan (high level)

| Phase | Deliverable |
|-------|-------------|
| **P0** | Scaffold Vite+TS+Vitest; package scripts; README |
| **P1** | Pure rules: types, bids, count, roll, challenge, die loss |
| **P2** | Scoring: base, categories, one Planet, player-only score |
| **P3** | Blind state machine + dumb AI |
| **P4** | Form UI wired to state machine |
| **P5** | Seed field; polish log; verify success metrics |

Suggested order of PRs if splitting: P0+P1 → P2 → P3+P4 → P5.

---

## 11. Risks

| Risk | Mitigation |
|------|------------|
| Score targets vs formula mismatch | Constants in one file; log chips/mult each bid |
| Wild-1 edge cases confuse players | One-line rule text in UI |
| AI too weak/strong | Keep dumb + deterministic given seed; tune later |
| Scope creep into shop/Godot | Hard non-goals; reject extras until PRD amended |

---

## 12. Open items (non-blocking)

1. Exact dumb-AI raise priority micro-table (document in `ai.ts` header; PRD allows simple raise-else-challenge).

---

## 13. Acceptance criteria (leave “planning”)

Implementation of the prototype may be considered **done** when:

- [x] This PRD captures locked stakeholder decisions (including resolution bonus, overbids, next-starter, package layout)  
- [ ] `prototype/` runs via Vite and presents the form UI  
- [ ] One human + one AI blind is playable end-to-end  
- [ ] Win by score or elimination; loss on 0 human dice  
- [ ] DESIGN-style scoring + one Planet stub applied to human bids  
- [ ] Seeded RNG with seed input  
- [ ] Vitest suite covers rules + scoring minimums above  
- [ ] README documents how to run and test  

---

## 14. Document history

| Date | Change |
|------|--------|
| 2026-07-21 | Initial PRD for Vite form-based mechanics prototype |
| 2026-07-21 | Lock: flat +30 resolution bonus; overbids OK; challenge loser starts next; standalone package.json |
