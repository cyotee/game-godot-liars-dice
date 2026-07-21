import { describe, expect, it } from "vitest";
import { scoreHumanBid } from "../scoring/score";
import { computeBase } from "../scoring/base";
import { classifyBid } from "../scoring/categories";
import { RESOLUTION_BONUS } from "../rules/types";

describe("scoring", () => {
  it("computeBase matches DESIGN example shape for 2×6", () => {
    const b = computeBase(2, 6);
    expect(b.chips).toBe(2 * 6 * 8);
    expect(b.mult).toBeCloseTo(1.15);
  });

  it("HIGH_FACE planet adds chips and mult", () => {
    expect(classifyBid(2, 6)).toBe("HIGH_FACE");
    const withPlanet = scoreHumanBid(2, 6, 1);
    const base = computeBase(2, 6);
    expect(withPlanet.chips).toBe(base.chips + 15);
    expect(withPlanet.mult).toBeCloseTo(base.mult + 0.2);
    expect(withPlanet.contrib).toBe(
      Math.floor(withPlanet.chips * withPlanet.mult)
    );
  });

  it("HIGH_QUANTITY does not get HIGH_FACE planet", () => {
    expect(classifyBid(4, 3)).toBe("HIGH_QUANTITY");
    const s = scoreHumanBid(4, 3, 1);
    const base = computeBase(4, 3);
    expect(s.chips).toBe(base.chips);
    expect(s.mult).toBeCloseTo(base.mult);
  });

  it("resolution bonus constant is 30", () => {
    expect(RESOLUTION_BONUS).toBe(30);
  });
});
