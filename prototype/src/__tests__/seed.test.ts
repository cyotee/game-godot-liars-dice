import { describe, expect, it } from "vitest";
import { createRng, rollDice, saltSeed } from "../rng/seed";

describe("seeded rng", () => {
  it("same seed same rolls", () => {
    const a = rollDice(5, createRng(saltSeed("abc", 0)));
    const b = rollDice(5, createRng(saltSeed("abc", 0)));
    expect(a).toEqual(b);
  });

  it("different sub-round differs", () => {
    const a = rollDice(5, createRng(saltSeed("abc", 0)));
    const b = rollDice(5, createRng(saltSeed("abc", 1)));
    expect(a).not.toEqual(b);
  });
});
