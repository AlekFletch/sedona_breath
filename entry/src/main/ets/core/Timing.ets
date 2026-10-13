/*
 * Time abstractions injected into the engines so they can be unit-tested
 * with a fake clock. Pure logic, portable to the lite-wearable JS build.
 */

export interface Clock {
  /** Monotonic milliseconds. */
  now(): number;
}

export interface Scheduler {
  /** Runs `cb` once after `delayMs`. Returns a handle for cancel(). */
  schedule(delayMs: number, cb: () => void): number;
  cancel(handle: number): void;
}

export function formatMmSs(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}
