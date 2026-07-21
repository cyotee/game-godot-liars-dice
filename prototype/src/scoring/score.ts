import { computeBase } from "./base";
import { classifyBid, type BidCategory } from "./categories";

export type ScoreBreakdown = {
  chips: number;
  mult: number;
  contrib: number;
  category: BidCategory;
};

const PLANET_HIGH_FACE = { chips: 15, mult: 0.2 };

/**
 * Human bid scoring: base + HIGH_FACE planet stub (level >= 1).
 */
export function scoreHumanBid(
  bidQty: number,
  bidFace: number,
  planetHighFaceLevel: number
): ScoreBreakdown {
  const base = computeBase(bidQty, bidFace);
  const category = classifyBid(bidQty, bidFace);
  let chips = base.chips;
  let mult = base.mult;
  if (category === "HIGH_FACE" && planetHighFaceLevel >= 1) {
    chips += PLANET_HIGH_FACE.chips;
    mult += PLANET_HIGH_FACE.mult;
  }
  const contrib = Math.floor(chips * mult);
  return { chips, mult, contrib, category };
}
