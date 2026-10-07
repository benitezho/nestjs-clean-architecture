import { nextAttemptAt } from './backoff';

describe('nextAttemptAt', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');

  it('doubles the delay on every failed attempt', () => {
    const delays = [1, 2, 3, 4].map(
      (attempts) => nextAttemptAt(now, attempts, 1000, 60_000).getTime() - now.getTime(),
    );

    expect(delays).toEqual([1000, 2000, 4000, 8000]);
  });

  it('caps the delay', () => {
    expect(nextAttemptAt(now, 20, 1000, 60_000).getTime() - now.getTime()).toBe(60_000);
  });
});
