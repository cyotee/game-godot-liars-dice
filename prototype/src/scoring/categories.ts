export type BidCategory =
  | "HIGH_QUANTITY"
  | "HIGH_FACE"
  | "RISKY_LOW"
  | "ANY";

/** Priority: HIGH_QUANTITY > HIGH_FACE > RISKY_LOW > ANY */
export function classifyBid(qty: number, face: number): BidCategory {
  if (qty >= 4) return "HIGH_QUANTITY";
  if (face >= 5) return "HIGH_FACE";
  if (face <= 2) return "RISKY_LOW";
  return "ANY";
}
