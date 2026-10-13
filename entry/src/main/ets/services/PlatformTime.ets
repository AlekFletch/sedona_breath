import { systemDateTime } from '@kit.BasicServicesKit';
import { Clock, Scheduler } from '../core/Timing';

/** Monotonic clock (time since boot) + setTimeout-based scheduler. */
export class PlatformTime implements Clock, Scheduler {
  static readonly INSTANCE: PlatformTime = new PlatformTime();

  now(): number {
    try {
      return systemDateTime.getUptime(systemDateTime.TimeType.STARTUP, false);
    } catch (e) {
      return Date.now();
    }
  }

  schedule(delayMs: number, cb: () => void): number {
    return setTimeout(cb, Math.max(0, delayMs));
  }

  cancel(handle: number): void {
    clearTimeout(handle);
  }
}

export function wallClock(): number {
  return Date.now();
}
