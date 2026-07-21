import type { Game } from "boardgame.io";
import { INVALID_MOVE } from "boardgame.io/core";
import { isValidHigherBid, isValidFace, isValidQty } from "../rules/bids";
import { createRng, rollDice, saltSeed } from "../rng/seed";
import { applyDieLoss, resolveChallenge } from "../rules/resolve";
import { scoreHumanBid } from "../scoring/score";
import {
  AI,
  DEFAULT_TARGET,
  HUMAN,
  RESOLUTION_BONUS,
  START_DICE,
  type LiarsDiceG,
  type LogEntry,
} from "../rules/types";

function pushLog(G: LiarsDiceG, text: string): void {
  const entry: LogEntry = { t: G.log.length, text };
  G.log = [...G.log, entry];
}

function rollAll(G: LiarsDiceG): void {
  const rng = createRng(saltSeed(G.seed, G.subRoundsCompleted));
  const next: Record<string, number[]> = {};
  for (const id of [HUMAN, AI]) {
    const p = G.players[id];
    if (p.eliminated || p.diceCount <= 0) {
      next[id] = [];
    } else {
      next[id] = rollDice(p.diceCount, rng);
    }
  }
  G.secretDice = next;
  // Keep lastReveal for UI until next bid overwrites context
  G.currentBid = null;
  G.bidderId = null;
}

function checkEnd(G: LiarsDiceG): void {
  if (G.players[HUMAN].diceCount <= 0) {
    G.phaseTag = "ended";
    G.winner = AI;
    G.outcome = "player_elim";
    pushLog(G, "You are out of dice — defeat.");
    return;
  }
  if (G.players[AI].diceCount <= 0) {
    G.phaseTag = "ended";
    G.winner = HUMAN;
    G.outcome = "elim";
    pushLog(G, "AI eliminated — victory!");
    return;
  }
  if (G.score >= G.targetScore) {
    G.phaseTag = "ended";
    G.winner = HUMAN;
    G.outcome = "score";
    pushLog(G, `Score target reached (${G.score} ≥ ${G.targetScore}) — victory!`);
  }
}

export type SetupData = {
  seed?: string;
  targetScore?: number;
};

function initialG(setupData?: SetupData): LiarsDiceG {
  const seed =
    setupData?.seed && setupData.seed.length > 0
      ? setupData.seed
      : "default-seed";
  const G: LiarsDiceG = {
    seed,
    targetScore: setupData?.targetScore ?? DEFAULT_TARGET,
    score: 0,
    planetHighFaceLevel: 1,
    players: {
      [HUMAN]: { diceCount: START_DICE, eliminated: false },
      [AI]: { diceCount: START_DICE, eliminated: false },
    },
    secretDice: { [HUMAN]: [], [AI]: [] },
    currentBid: null,
    bidderId: null,
    nextPlayerId: HUMAN,
    rngCounter: 0,
    phaseTag: "playing",
    winner: null,
    outcome: null,
    log: [],
    lastReveal: null,
    playerBidsMade: 0,
    subRoundsCompleted: 0,
  };
  rollAll(G);
  pushLog(G, `Blind started (seed=${G.seed}, target=${G.targetScore}).`);
  return G;
}

export const LiarsDiceGame: Game<LiarsDiceG> = {
  name: "liars-dice-blind",
  minPlayers: 2,
  maxPlayers: 2,

  setup: (_ctx, setupData: SetupData | undefined) => initialG(setupData),

  playerView: ({ G, playerID }) => {
    if (!G || playerID == null) return G;
    // Always redact live opponent dice; UI uses lastReveal for post-challenge faces.
    const secretDice: Record<string, number[]> = {};
    for (const id of Object.keys(G.secretDice)) {
      secretDice[id] = id === playerID ? [...(G.secretDice[id] ?? [])] : [];
    }
    return { ...G, secretDice };
  },

  turn: {
    minMoves: 1,
    maxMoves: 1,
    order: {
      // boardgame.io expects playOrder *positions* (numbers), not playerID strings
      first: ({ G, ctx }) => {
        const id = G?.nextPlayerId ?? HUMAN;
        const pos = ctx.playOrder.indexOf(id);
        return pos >= 0 ? pos : 0;
      },
      next: ({ G, ctx }) => {
        if (!G) return (ctx.playOrderPos + 1) % ctx.numPlayers;
        const id =
          G.nextPlayerId && G.nextPlayerId !== ctx.currentPlayer
            ? G.nextPlayerId
            : ctx.currentPlayer === HUMAN
              ? AI
              : HUMAN;
        if (G.players[id]?.eliminated || G.players[id]?.diceCount <= 0) {
          const other = id === HUMAN ? AI : HUMAN;
          const pos = ctx.playOrder.indexOf(other);
          return pos >= 0 ? pos : 0;
        }
        const pos = ctx.playOrder.indexOf(id);
        return pos >= 0 ? pos : 0;
      },
    },
  },

  endIf: ({ G }) => {
    if (!G || G.phaseTag !== "ended") return;
    return { winner: G.winner, outcome: G.outcome };
  },

  moves: {
    bid: ({ G, playerID, events }, qty: number, face: number) => {
      if (G.phaseTag === "ended") return INVALID_MOVE;
      if (playerID == null) return INVALID_MOVE;
      if (!isValidQty(qty) || !isValidFace(face)) return INVALID_MOVE;
      if (!isValidHigherBid(G.currentBid, { qty, face })) return INVALID_MOVE;

      G.currentBid = { qty, face };
      G.bidderId = playerID;
      G.lastReveal = null; // clear previous reveal UI when auction continues
      // After a normal bid, next is the other player
      G.nextPlayerId = playerID === HUMAN ? AI : HUMAN;

      if (playerID === HUMAN) {
        const br = scoreHumanBid(qty, face, G.planetHighFaceLevel);
        G.score += br.contrib;
        G.playerBidsMade += 1;
        pushLog(
          G,
          `You bid ${qty}×${face} [${br.category}] → +${br.contrib} (chips=${br.chips}, mult=${br.mult.toFixed(2)}) | score=${G.score}`
        );
        checkEnd(G);
      } else {
        pushLog(G, `AI bids ${qty}×${face}`);
      }

      if (G.phaseTag === "ended") {
        events.endGame({ winner: G.winner, outcome: G.outcome });
        return;
      }
      events.endTurn({ next: G.nextPlayerId });
    },

    challenge: ({ G, playerID, events }) => {
      if (G.phaseTag === "ended") return INVALID_MOVE;
      if (playerID == null) return INVALID_MOVE;
      if (!G.currentBid || !G.bidderId) return INVALID_MOVE;

      const bid = G.currentBid;
      const bidderId = G.bidderId;
      const challengerId = playerID;

      const result = resolveChallenge(G.secretDice, bid, challengerId, bidderId);

      // Snapshot reveal for UI
      G.lastReveal = {
        dice: {
          [HUMAN]: [...G.secretDice[HUMAN]],
          [AI]: [...G.secretDice[AI]],
        },
        actualCount: result.actualCount,
        bid: { ...bid },
        challengerId,
        bidderId,
        loserId: result.loserId,
      };

      pushLog(
        G,
        `${challengerId === HUMAN ? "You" : "AI"} challenge ${bid.qty}×${bid.face}: actual=${result.actualCount} (${result.bidValid ? "bid good" : "liar!"}) → loser ${result.loserId === HUMAN ? "You" : "AI"}`
      );

      // Die loss
      const loser = result.loserId;
      const loss = applyDieLoss(
        G.players[loser].diceCount,
        G.secretDice[loser] ?? []
      );
      G.players[loser] = {
        diceCount: loss.diceCount,
        eliminated: loss.diceCount <= 0,
      };
      G.secretDice[loser] = loss.secretDice;

      // Resolution bonus if human involved
      if (challengerId === HUMAN || bidderId === HUMAN) {
        G.score += RESOLUTION_BONUS;
        pushLog(G, `Resolution bonus +${RESOLUTION_BONUS} | score=${G.score}`);
      }

      G.subRoundsCompleted += 1;
      checkEnd(G);

      if (G.phaseTag === "ended") {
        events.endGame({ winner: G.winner, outcome: G.outcome });
        return;
      }

      // Next sub-round: re-roll; loser starts if alive
      rollAll(G);
      const loserAlive =
        !G.players[loser].eliminated && G.players[loser].diceCount > 0;
      G.nextPlayerId = loserAlive
        ? loser
        : loser === HUMAN
          ? AI
          : HUMAN;
      pushLog(
        G,
        `New roll. Next: ${G.nextPlayerId === HUMAN ? "You" : "AI"}`
      );
      events.endTurn({ next: G.nextPlayerId });
    },
  },
};

export { initialG };
