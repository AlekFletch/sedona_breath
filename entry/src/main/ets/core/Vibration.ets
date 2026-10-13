/*
 * Vibration rules (identical for all patterns, scaled by phase length):
 *
 *  INHALE    3 short pulses per second (period ~333 ms) from the start of the
 *            inhale. No pulses in the last second -> ~1 s of silence before
 *            the next phase.
 *  HOLD_IN / HOLD_OUT
 *            one short pulse at the start of every second; a double pulse at
 *            the start of the last second ("one second left").
 *  EXHALE    silence.
 *  END       one long pulse, then silence.
 *
 * The planner is pure (cue lists); VibrationScheduler plays cues through an
 * injected HapticDriver and can stop everything immediately.
 * Pure logic, portable to the lite-wearable JS build.
 */
import { BreathPhase, PhaseType } from './BreathPattern';
import { Scheduler } from './Timing';

export const PULSE_PERIOD_MS: number = 333;
export const SHORT_PULSE_MS: number = 50;
export const DOUBLE_GAP_MS: number = 110;
export const LONG_PULSE_MS: number = 800;

export enum CueKind {
  INHALE_TICK = 'inhaleTick',
  HOLD_TICK = 'holdTick',
  HOLD_LAST = 'holdLast',
  END = 'end'
}

export class VibrationCue {
  /** Offset from the phase start. */
  offsetMs: number;
  durationMs: number;
  kind: CueKind;

  constructor(offsetMs: number, durationMs: number, kind: CueKind) {
    this.offsetMs = offsetMs;
    this.durationMs = durationMs;
    this.kind = kind;
  }
}

export class VibrationPlanner {
  static cuesFor(phase: BreathPhase): VibrationCue[] {
    switch (phase.type) {
      case PhaseType.INHALE:
        return VibrationPlanner.inhale(phase.durationMs);
      case PhaseType.HOLD_IN:
      case PhaseType.HOLD_OUT:
        return VibrationPlanner.hold(phase.durationMs);
      default:
        return [];
    }
  }

  /** Pulses at k*333 ms while inside the first (d - 1 s); the last second stays silent. */
  static inhale(durationMs: number): VibrationCue[] {
    const cues: VibrationCue[] = [];
    const silentFrom = durationMs - 1000;
    const perSecond = 3;
    const count = Math.floor(Math.max(0, silentFrom) / 1000 * perSecond + 1e-6);
    for (let k = 0; k < count; k++) {
      // Integer offsets: 0, 333, 667, 1000, ... (exactly 3 per second, no drift).
      const offset = Math.round(k * 1000 / perSecond);
      cues.push(new VibrationCue(offset, SHORT_PULSE_MS, CueKind.INHALE_TICK));
    }
    return cues;
  }

  /** One pulse per second, the last second is marked by a double pulse. */
  static hold(durationMs: number): VibrationCue[] {
    const cues: VibrationCue[] = [];
    const seconds = Math.floor(durationMs / 1000 + 1e-6);
    if (seconds <= 0) {
      return cues;
    }
    for (let s = 0; s < seconds - 1; s++) {
      cues.push(new VibrationCue(s * 1000, SHORT_PULSE_MS, CueKind.HOLD_TICK));
    }
    const lastStart = (seconds - 1) * 1000;
    cues.push(new VibrationCue(lastStart, SHORT_PULSE_MS, CueKind.HOLD_LAST));
    cues.push(new VibrationCue(lastStart + SHORT_PULSE_MS + DOUBLE_GAP_MS, SHORT_PULSE_MS, CueKind.HOLD_LAST));
    return cues;
  }

  static sessionEnd(): VibrationCue[] {
    return [new VibrationCue(0, LONG_PULSE_MS, CueKind.END)];
  }
}

/** Platform abstraction: the real implementation calls @ohos.vibrator. */
export interface HapticDriver {
  pulse(durationMs: number): void;

  /** Must stop an ongoing pulse immediately. */
  stop(): void;
}

export class VibrationScheduler {
  private driver: HapticDriver;
  private scheduler: Scheduler;
  private handles: number[] = [];
  private enabled: boolean = true;

  constructor(driver: HapticDriver, scheduler: Scheduler) {
    this.driver = driver;
    this.scheduler = scheduler;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stopAll();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Plays the cues of a phase. `phaseElapsedMs` > 0 when resuming mid-phase:
   * cues that are already in the past are skipped (never "catch up").
   */
  playPhase(phase: BreathPhase, phaseElapsedMs: number): void {
    this.stopAll();
    this.play(VibrationPlanner.cuesFor(phase), phaseElapsedMs);
  }

  playSessionEnd(): void {
    this.stopAll();
    this.play(VibrationPlanner.sessionEnd(), 0);
  }

  /** Cancels all pending cues and stops the motor right now (pause, cancel, finish, background). */
  stopAll(): void {
    for (const h of this.handles) {
      this.scheduler.cancel(h);
    }
    this.handles = [];
    this.driver.stop();
  }

  pendingCount(): number {
    return this.handles.length;
  }

  private play(cues: VibrationCue[], fromOffsetMs: number): void {
    if (!this.enabled) {
      return;
    }
    for (const cue of cues) {
      if (cue.offsetMs < fromOffsetMs) {
        continue;
      }
      const delay = cue.offsetMs - fromOffsetMs;
      const duration = cue.durationMs;
      if (delay === 0) {
        this.driver.pulse(duration);
        continue;
      }
      const handle = this.scheduler.schedule(delay, () => {
        this.handles = this.handles.filter((h: number) => h !== handle);
        if (this.enabled) {
          this.driver.pulse(duration);
        }
      });
      this.handles.push(handle);
    }
  }
}
