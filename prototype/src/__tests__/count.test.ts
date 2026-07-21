import { describe, expect, it } from "vitest";
import { countMatches } from "../rules/count";

describe("countMatches wild 1s", () => {
  const dice = [1, 1, 6, 6, 3, 2, 1, 6, 4, 5];

  it("face 6 counts sixes and ones", () => {
    expect(countMatches(dice, 6)).toBe(3 + 3); // 3 sixes + 3 ones
  });

  it("face 1 counts only ones", () => {
    expect(countMatches(dice, 1)).toBe(3);
  });

  it("face 3 counts threes and ones", () => {
    expect(countMatches(dice, 3)).toBe(1 + 3);
  });
});
