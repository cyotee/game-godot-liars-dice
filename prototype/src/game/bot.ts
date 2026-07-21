import { isValidHigherBid } from "../rules/bids";
import type { Bid, LiarsDiceG } from "../rules/types";

export type AiAction =
  | { type: "bid"; qty: number; face: number }
  | { type: "challenge" };

/** Public dice still in play (sum of living players' counts). */
export function totalDiceInPlay(G: LiarsDiceG): number {
  return Object.values(G.players).reduce((sum, p) => sum + p.diceCount, 0);
}

/**
 * True if AI is willing to make this raise.
 * Rules allow overbids; dumb AI will not raise qty above total dice in play
 * (PRD: prefer raises that stay within table dice; else challenge).
 */
export function isAiAcceptableRaise(G: LiarsDiceG, next: Bid): boolean {
  if (!isValidHigherBid(G.currentBid, next)) return false;
  return next.qty <= totalDiceInPlay(G);
}

/**
 * Dumb AI: prefer face+1; else qty+1 within total_dice; else challenge.
 */
export function pickDumbAction(G: LiarsDiceG): AiAction {
  const current = G.currentBid;
  const total = totalDiceInPlay(G);

  if (current == null) {
    // Opening: modest bid, never above table size
    return { type: "bid", qty: 1, face: 3 };
  }

  // Prefer face+1 (same qty — always within total if current was legal for AI policy)
  if (current.face < 6) {
    const next: Bid = { qty: current.qty, face: current.face + 1 };
    if (isAiAcceptableRaise(G, next)) {
      return { type: "bid", qty: next.qty, face: next.face };
    }
  }

  // qty+1 only if new qty does not exceed total dice in play
  if (current.qty + 1 <= total) {
    const raiseQty: Bid = { qty: current.qty + 1, face: 2 };
    if (isAiAcceptableRaise(G, raiseQty)) {
      return { type: "bid", qty: raiseQty.qty, face: raiseQty.face };
    }
    const raiseSame: Bid = { qty: current.qty + 1, face: current.face };
    if (isAiAcceptableRaise(G, raiseSame)) {
      return { type: "bid", qty: raiseSame.qty, face: raiseSame.face };
    }
  }

  return { type: "challenge" };
}
