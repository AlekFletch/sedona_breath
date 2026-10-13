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

/** Fake clock + scheduler for unit tests: time advances only via advance(). */
export class ManualTime implements Clock, Scheduler {
  private current: number = 0;
  private nextId: number = 1;
  private tasks: ManualTask[] = [];

  now(): number {
    return this.current;
  }

  schedule(delayMs: number, cb: () => void): number {
    const id = this.nextId++;
    this.tasks.push(new ManualTask(id, this.current + Math.max(0, delayMs), cb));
    return id;
  }

  cancel(handle: number): void {
    this.tasks = this.tasks.filter((t: ManualTask) => t.id !== handle);
  }

  pending(): number {
    return this.tasks.length;
  }

  /** Advances time, firing due tasks in chronological order (including ones scheduled meanwhile). */
  advance(ms: number): void {
    const target = this.current + ms;
    for (;;) {
      let due: ManualTask | undefined = undefined;
      for (const t of this.tasks) {
        if (t.at <= target && (due === undefined || t.at < due.at || (t.at === due.at && t.id < due.id))) {
          due = t;
        }
      }
      if (due === undefined) {
        break;
      }
      const task: ManualTask = due;
      this.tasks = this.tasks.filter((t: ManualTask) => t.id !== task.id);
      this.current = Math.max(this.current, task.at);
      task.cb();
    }
    this.current = target;
  }
}

class ManualTask {
  id: number;
  at: number;
  cb: () => void;

  constructor(id: number, at: number, cb: () => void) {
    this.id = id;
    this.at = at;
    this.cb = cb;
  }
}

export function formatMmSs(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}
