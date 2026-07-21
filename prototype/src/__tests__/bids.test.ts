import { describe, expect, it } from "vitest";
import { isValidHigherBid } from "../rules/bids";

describe("isValidHigherBid", () => {
  it("allows any first bid", () => {
    expect(isValidHigherBid(null, { qty: 1, face: 1 })).toBe(true);
    expect(isValidHigherBid(null, { qty: 99, face: 6 })).toBe(true);
  });

  it("rejects equal bid", () => {
    expect(isValidHigherBid({ qty: 2, face: 3 }, { qty: 2, face: 3 })).toBe(
      false
    );
  });

  it("accepts higher face same qty", () => {
    expect(isValidHigherBid({ qty: 2, face: 3 }, { qty: 2, face: 4 })).toBe(
      true
    );
  });

  it("accepts higher qty", () => {
    expect(isValidHigherBid({ qty: 2, face: 6 }, { qty: 3, face: 1 })).toBe(
      true
    );
  });

  it("allows overbids beyond total dice", () => {
    expect(isValidHigherBid(null, { qty: 20, face: 6 })).toBe(true);
  });
});
