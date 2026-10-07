/** Exponential backoff: base * 2^(attempts-1), capped. `attempts` counts failures so far (>= 1). */
export function nextAttemptAt(now: Date, attempts: number, baseMs: number, maxMs: number): Date {
  const delay = Math.min(baseMs * 2 ** (attempts - 1), maxMs);
  return new Date(now.getTime() + delay);
}
