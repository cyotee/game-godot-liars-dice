import { describe, expect, it } from "vitest";
import {
  isAiAcceptableRaise,
  pickDumbAction,
  totalDiceInPlay,
} from "../game/bot";
import type { LiarsDiceG } from "../rules/types";
import { AI, HUMAN } from "../rules/types";

function baseG(over: Partial<LiarsDiceG> = {}): LiarsDiceG {
  return {
    seed: "t",
    targetScore: 300,
    score: 0,
    planetHighFaceLevel: 1,
    players: {
      [HUMAN]: { diceCount: 5, eliminated: false },
      [AI]: { diceCount: 5, eliminated: false },
    },
    secretDice: { [HUMAN]: [1, 2, 3, 4, 5], [AI]: [1, 2, 3, 4, 5] },
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
    ...over,
  };
}

describe("pickDumbAction", () => {
  it("opens with modest bid when no current bid", () => {
    const a = pickDumbAction(baseG());
    expect(a).toEqual({ type: "bid", qty: 1, face: 3 });
  });

  it("prefers face+1 when legal and within table dice", () => {
    const a = pickDumbAction(
      baseG({ currentBid: { qty: 2, face: 3 }, bidderId: HUMAN })
    );
    expect(a).toEqual({ type: "bid", qty: 2, face: 4 });
  });

  it("challenges when current bid qty is already at total dice and face is 6", () => {
    // total dice = 10; cannot face+1; qty+1 would be 11 > 10
    const G = baseG({
      currentBid: { qty: 10, face: 6 },
      bidderId: HUMAN,
    });
    expect(totalDiceInPlay(G)).toBe(10);
    expect(isAiAcceptableRaise(G, { qty: 11, face: 2 })).toBe(false);
    const a = pickDumbAction(G);
    expect(a).toEqual({ type: "challenge" });
  });

  it("challenges after absurd overbid 20×6 (not raise to 21)", () => {
    const G = baseG({
      currentBid: { qty: 20, face: 6 },
      bidderId: HUMAN,
    });
    const a = pickDumbAction(G);
    expect(a.type).toBe("challenge");
    expect(a).toEqual({ type: "challenge" });
  });

  it("still raises face when qty equals total but face < 6", () => {
    const G = baseG({
      currentBid: { qty: 10, face: 5 },
      bidderId: HUMAN,
    });
    const a = pickDumbAction(G);
    expect(a).toEqual({ type: "bid", qty: 10, face: 6 });
  });
});
