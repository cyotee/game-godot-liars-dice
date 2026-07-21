import type { Bid } from "./types";

export function isValidFace(face: number): boolean {
  return Number.isInteger(face) && face >= 1 && face <= 6;
}

export function isValidQty(qty: number): boolean {
  return Number.isInteger(qty) && qty >= 1;
}

/** Overbids allowed — no cap at total dice in play. */
export function isValidHigherBid(current: Bid | null, next: Bid): boolean {
  if (!isValidQty(next.qty) || !isValidFace(next.face)) return false;
  if (current == null) return true;
  if (next.qty > current.qty) return true;
  if (next.qty === current.qty && next.face > current.face) return true;
  return false;
}
