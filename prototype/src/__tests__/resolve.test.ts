import { describe, expect, it } from "vitest";
import { resolveChallenge, applyDieLoss } from "../rules/resolve";

describe("resolveChallenge", () => {
  it("bidder loses when count too low", () => {
    const secret = {
      "0": [2, 2, 3],
      "1": [4, 5, 6],
    };
    const r = resolveChallenge(secret, { qty: 5, face: 6 }, "0", "1");
    expect(r.bidValid).toBe(false);
    expect(r.loserId).toBe("1");
    expect(r.actualCount).toBe(1); // one 6, no 1s
  });

  it("challenger loses when bid is good (wild 1s)", () => {
    const secret = {
      "0": [1, 6, 2],
      "1": [6, 1, 3],
    };
    // face 6: two 6s + two 1s = 4
    const r = resolveChallenge(secret, { qty: 3, face: 6 }, "0", "1");
    expect(r.actualCount).toBe(4);
    expect(r.bidValid).toBe(true);
    expect(r.loserId).toBe("0");
  });
});

describe("applyDieLoss", () => {
  it("reduces count and trims dice", () => {
    const r = applyDieLoss(5, [1, 2, 3, 4, 5]);
    expect(r.diceCount).toBe(4);
    expect(r.secretDice).toEqual([1, 2, 3, 4]);
  });
});
