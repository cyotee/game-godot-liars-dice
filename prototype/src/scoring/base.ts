/** DESIGN.md provisional compute_base. */
export function computeBase(
  bidQty: number,
  bidFace: number
): { chips: number; mult: number } {
  const faceVal = bidFace === 1 ? 6 : bidFace;
  let chips = bidQty * faceVal * 8;
  let mult = 1.0 + Math.max(0, (bidQty - 2) * 0.05);
  if (bidFace === 6) mult += 0.15;
  else if (bidFace <= 2) mult += 0.1;
  return { chips, mult };
}
