import { isValidHigherBid } from "../rules/bids";
import type { Bid, LiarsDiceG } from "../rules/types";

export type AiAction =
  | { type: "bid"; qty: number; face: number }
  | { type: "challenge" };

/**
 * Dumb AI: prefer face+1; else qty+1 with face 2; else challenge.
 */
export function pickDumbAction(G: LiarsDiceG): AiAction {
  const current = G.currentBid;
  if (current == null) {
    // Opening: modest bid 1 of 3s
    return { type: "bid", qty: 1, face: 3 };
  }

  // Prefer face+1
  if (current.face < 6) {
    const next: Bid = { qty: current.qty, face: current.face + 1 };
    if (isValidHigherBid(current, next)) {
      return { type: "bid", qty: next.qty, face: next.face };
    }
  }

  // Else qty+1 face 2 (or face 1 if that works as higher — face 2 is fine)
  const raiseQty: Bid = { qty: current.qty + 1, face: 2 };
  if (isValidHigherBid(current, raiseQty)) {
    return { type: "bid", qty: raiseQty.qty, face: raiseQty.face };
  }

  // Fallback: qty+1 same face if face was 6
  const raiseSame: Bid = { qty: current.qty + 1, face: current.face };
  if (isValidHigherBid(current, raiseSame)) {
    return { type: "bid", qty: raiseSame.qty, face: raiseSame.face };
  }

  return { type: "challenge" };
}
