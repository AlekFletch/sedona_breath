/*
 * Breathing patterns. Pure logic: no ArkUI / Kit imports, so this file can be
 * ported 1:1 to the lite-wearable JS build (Watch Fit series).
 */

export enum PhaseType {
  INHALE = 'inhale',
  HOLD_IN = 'holdIn',
  EXHALE = 'exhale',
  HOLD_OUT = 'holdOut'
}

export enum PatternId {
  CALM_4_6 = 'calm46',
  BOX_4444 = 'box4444',
  LONG_EXHALE_426 = 'longExhale426',
  RELAX_478 = 'relax478',
  FREE = 'free'
}

export const DEFAULT_PATTERN: PatternId = PatternId.RELAX_478;

export const ALL_PATTERNS: PatternId[] = [
  PatternId.RELAX_478,
  PatternId.CALM_4_6,
  PatternId.BOX_4444,
  PatternId.LONG_EXHALE_426,
  PatternId.FREE
];

export class BreathPhase {
  type: PhaseType;
  durationMs: number;

  constructor(type: PhaseType, durationMs: number) {
    this.type = type;
    this.durationMs = durationMs;
  }
}

export class BreathPattern {
  id: PatternId;
  phases: BreathPhase[];

  constructor(id: PatternId, phases: BreathPhase[]) {
    this.id = id;
    this.phases = phases;
  }

  cycleMs(): number {
    let sum = 0;
    for (const p of this.phases) {
      sum += p.durationMs;
    }
    return sum;
  }

  breathsPerMinute(): number {
    return 60000 / this.cycleMs();
  }
}

/** Free rhythm: separately configurable inhale / exhale, whole seconds. */
export class FreeRhythm {
  static readonly INHALE_MIN: number = 3;
  static readonly INHALE_MAX: number = 8;
  static readonly EXHALE_MIN: number = 4;
  static readonly EXHALE_MAX: number = 12;
  static readonly DEFAULT_INHALE: number = 4;
  static readonly DEFAULT_EXHALE: number = 6;
  /** Stress-reduction rule: not more than ~6 breaths/min => cycle >= 10 s. */
  static readonly MIN_CYCLE_SEC: number = 10;

  inhaleSec: number;
  exhaleSec: number;

  constructor(inhaleSec: number = FreeRhythm.DEFAULT_INHALE, exhaleSec: number = FreeRhythm.DEFAULT_EXHALE) {
    this.inhaleSec = inhaleSec;
    this.exhaleSec = exhaleSec;
  }

  /** Clamps to allowed ranges and enforces <= 6 breaths per minute by lengthening the exhale. */
  normalized(): FreeRhythm {
    let inhale = Math.round(clamp(this.inhaleSec, FreeRhythm.INHALE_MIN, FreeRhythm.INHALE_MAX));
    let exhale = Math.round(clamp(this.exhaleSec, FreeRhythm.EXHALE_MIN, FreeRhythm.EXHALE_MAX));
    if (inhale + exhale < FreeRhythm.MIN_CYCLE_SEC) {
      exhale = FreeRhythm.MIN_CYCLE_SEC - inhale;
    }
    return new FreeRhythm(inhale, exhale);
  }
}

export class PatternCatalog {
  static build(id: PatternId, free: FreeRhythm): BreathPattern {
    switch (id) {
      case PatternId.CALM_4_6:
        return new BreathPattern(id, [ph(PhaseType.INHALE, 4), ph(PhaseType.EXHALE, 6)]);
      case PatternId.BOX_4444:
        return new BreathPattern(id, [
          ph(PhaseType.INHALE, 4), ph(PhaseType.HOLD_IN, 4), ph(PhaseType.EXHALE, 4), ph(PhaseType.HOLD_OUT, 4)
        ]);
      case PatternId.LONG_EXHALE_426:
        return new BreathPattern(id, [ph(PhaseType.INHALE, 4), ph(PhaseType.HOLD_IN, 2), ph(PhaseType.EXHALE, 6)]);
      case PatternId.FREE: {
        const f = free.normalized();
        return new BreathPattern(id, [ph(PhaseType.INHALE, f.inhaleSec), ph(PhaseType.EXHALE, f.exhaleSec)]);
      }
      case PatternId.RELAX_478:
      default:
        return new BreathPattern(PatternId.RELAX_478, [
          ph(PhaseType.INHALE, 4), ph(PhaseType.HOLD_IN, 7), ph(PhaseType.EXHALE, 8)
        ]);
    }
  }

  static parseId(value: string): PatternId {
    for (const id of ALL_PATTERNS) {
      if (id === value) {
        return id;
      }
    }
    return DEFAULT_PATTERN;
  }
}

function ph(type: PhaseType, seconds: number): BreathPhase {
  return new BreathPhase(type, seconds * 1000);
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
