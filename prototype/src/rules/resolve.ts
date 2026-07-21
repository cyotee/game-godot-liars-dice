import { countMatches, flattenDice } from "./count";
import type { Bid } from "./types";

export type ChallengeResult = {
  actualCount: number;
  bidValid: boolean;
  loserId: string;
  winnerId: string;
};

/**
 * Resolve challenge: if actual >= qty, bid was good → challenger loses;
 * else bidder loses.
 */
export function resolveChallenge(
  secretDice: Record<string, number[]>,
  bid: Bid,
  challengerId: string,
  bidderId: string
): ChallengeResult {
  const actualCount = countMatches(flattenDice(secretDice), bid.face);
  const bidValid = actualCount >= bid.qty;
  const loserId = bidValid ? challengerId : bidderId;
  const winnerId = bidValid ? bidderId : challengerId;
  return { actualCount, bidValid, loserId, winnerId };
}

export function applyDieLoss(
  diceCount: number,
  secretDice: number[]
): { diceCount: number; secretDice: number[] } {
  const next = Math.max(0, diceCount - 1);
  return {
    diceCount: next,
    secretDice: secretDice.slice(0, next),
  };
}
