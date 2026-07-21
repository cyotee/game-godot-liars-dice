/**
 * Wild 1s: face 1 counts only 1s; other faces count face or 1.
 */
export function countMatches(allDice: number[], face: number): number {
  if (face === 1) {
    return allDice.filter((d) => d === 1).length;
  }
  return allDice.filter((d) => d === face || d === 1).length;
}

export function flattenDice(secretDice: Record<string, number[]>): number[] {
  const out: number[] = [];
  for (const id of Object.keys(secretDice).sort()) {
    out.push(...secretDice[id]);
  }
  return out;
}
