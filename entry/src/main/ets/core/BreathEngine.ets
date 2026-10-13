/*
 * Breathing engine: runs N cycles of a pattern.
 *
 * Timing is derived from a monotonic clock (not from counting timer ticks), so
 * late or early timers never accumulate drift. Pause stores the active elapsed
 * time; resume continues from the exact position (mid-phase). A snapshot of the
 * elapsed time is enough to restore a session after an interruption.
 * Pure logic, portable to the lite-wearable JS build.
 */
import { BreathPattern, BreathPhase } from './BreathPattern';
import { Clock, Scheduler } from './Timing';

export enum EngineState {
  IDLE = 'idle',
  RUNNING = 'running',
  PAUSED = 'paused',
  FINISHED = 'finished',
  CANCELLED = 'cancelled'
}

export class BreathPosition {
  /** 0-based cycle index. */
  cycle: number;
  phaseIndex: number;
  phase: BreathPhase;
  phaseElapsedMs: number;
  finished: boolean;

  constructor(cycle: number, phaseIndex: number, phase: BreathPhase, phaseElapsedMs: number, finished: boolean) {
    this.cycle = cycle;
    this.phaseIndex = phaseIndex;
    this.phase = phase;
    this.phaseElapsedMs = phaseElapsedMs;
    this.finished = finished;
  }

  phaseRemainingMs(): number {
    return Math.max(0, this.phase.durationMs - this.phaseElapsedMs);
  }

  /** True when the phase is entered from its very beginning (not resumed mid-phase). */
  isPhaseStart(): boolean {
    return this.phaseElapsedMs === 0;
  }
}

export interface BreathListener {
  /** A phase begins, or a phase continues after resume (then pos.phaseElapsedMs > 0). */
  onPhase(pos: BreathPosition): void;

  /** All cycles are done. Not called on cancel. */
  onFinish(): void;
}

export class BreathEngine {
  private pattern: BreathPattern;
  private cycles: number;
  private clock: Clock;
  private scheduler: Scheduler;
  private listener: BreathListener;

  private state: EngineState = EngineState.IDLE;
  private baseElapsedMs: number = 0;
  private runStartedAt: number = 0;
  private timer: number = 0;
  private lastPhaseKey: number = -1;

  constructor(pattern: BreathPattern, cycles: number, clock: Clock, scheduler: Scheduler, listener: BreathListener) {
    this.pattern = pattern;
    this.cycles = Math.max(1, Math.floor(cycles));
    this.clock = clock;
    this.scheduler = scheduler;
    this.listener = listener;
  }

  /** Position for a given active elapsed time. Exactly on a boundary -> start of the next phase. */
  static positionAt(pattern: BreathPattern, cycles: number, elapsedMs: number): BreathPosition {
    const cycleMs = pattern.cycleMs();
    const total = cycleMs * cycles;
    const last = pattern.phases.length - 1;
    if (elapsedMs >= total) {
      const lp = pattern.phases[last];
      return new BreathPosition(cycles - 1, last, lp, lp.durationMs, true);
    }
    const e = Math.max(0, elapsedMs);
    const cycle = Math.floor(e / cycleMs);
    let within = e - cycle * cycleMs;
    for (let i = 0; i <= last; i++) {
      const p = pattern.phases[i];
      if (within < p.durationMs) {
        return new BreathPosition(cycle, i, p, within, false);
      }
      within -= p.durationMs;
    }
    // Floating point safety net: treat as the start of the next cycle.
    return new BreathPosition(cycle + 1, 0, pattern.phases[0], 0, cycle + 1 >= cycles);
  }

  getState(): EngineState {
    return this.state;
  }

  getPattern(): BreathPattern {
    return this.pattern;
  }

  totalCycles(): number {
    return this.cycles;
  }

  totalMs(): number {
    return this.pattern.cycleMs() * this.cycles;
  }

  elapsedMs(): number {
    const running = this.state === EngineState.RUNNING ? this.clock.now() - this.runStartedAt : 0;
    return Math.min(this.totalMs(), this.baseElapsedMs + running);
  }

  remainingMs(): number {
    return Math.max(0, this.totalMs() - this.elapsedMs());
  }

  position(): BreathPosition {
    return BreathEngine.positionAt(this.pattern, this.cycles, this.elapsedMs());
  }

  /** Fully completed cycles so far. */
  completedCycles(): number {
    return Math.min(this.cycles, Math.floor(this.elapsedMs() / this.pattern.cycleMs()));
  }

  /** Starts from the beginning, or from a restored elapsed time. */
  start(fromElapsedMs: number = 0): void {
    if (this.state !== EngineState.IDLE) {
      return;
    }
    this.baseElapsedMs = Math.max(0, Math.min(fromElapsedMs, this.totalMs()));
    this.run();
  }

  pause(): void {
    if (this.state !== EngineState.RUNNING) {
      return;
    }
    this.baseElapsedMs = this.elapsedMs();
    this.state = EngineState.PAUSED;
    this.clearTimer();
  }

  resume(): void {
    if (this.state !== EngineState.PAUSED) {
      return;
    }
    this.run();
  }

  cancel(): void {
    if (this.state === EngineState.FINISHED || this.state === EngineState.CANCELLED) {
      return;
    }
    if (this.state === EngineState.RUNNING) {
      this.baseElapsedMs = this.elapsedMs();
    }
    this.state = EngineState.CANCELLED;
    this.clearTimer();
  }

  private run(): void {
    this.runStartedAt = this.clock.now();
    this.state = EngineState.RUNNING;
    // Force onPhase on (re)start, even mid-phase, so UI and vibration resync.
    this.lastPhaseKey = -1;
    this.step();
  }

  private step(): void {
    this.timer = 0;
    if (this.state !== EngineState.RUNNING) {
      return;
    }
    const pos = this.position();
    if (pos.finished) {
      this.baseElapsedMs = this.totalMs();
      this.state = EngineState.FINISHED;
      this.listener.onFinish();
      return;
    }
    const key = pos.cycle * this.pattern.phases.length + pos.phaseIndex;
    if (key !== this.lastPhaseKey) {
      this.lastPhaseKey = key;
      this.listener.onPhase(pos);
      if (this.state !== EngineState.RUNNING) {
        return; // listener paused or cancelled us
      }
    }
    // Wake exactly at the next boundary; if the timer fires early we just re-arm.
    this.timer = this.scheduler.schedule(Math.max(1, pos.phaseRemainingMs()), () => this.step());
  }

  private clearTimer(): void {
    if (this.timer !== 0) {
      this.scheduler.cancel(this.timer);
      this.timer = 0;
    }
  }
}
