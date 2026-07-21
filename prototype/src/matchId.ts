/** Unique Local multiplayer match id per boot (avoids reusing stale G). */
export function makeMatchId(
  seed: string,
  serial: number,
  now = Date.now()
): string {
  return `liars-${seed}-${serial}-${now}`;
}
