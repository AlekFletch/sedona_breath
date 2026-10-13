/*
 * Persisted models. Pure logic, portable to the lite-wearable JS build.
 */
import { PatternId } from './BreathPattern';
import { Emotion, RATING_NONE, SessionMode, SessionStatus, Stage } from './SessionTypes';

/** One row of the history. */
export class SessionRecord {
  id: number = 0;
  startedAt: number = 0;
  endedAt: number = 0;
  /** Active practice time (pauses excluded), seconds. */
  durationSec: number = 0;
  plannedMin: number = 0;
  mode: SessionMode = SessionMode.FULL;
  patternId: PatternId = PatternId.RELAX_478;
  cycles: number = 0;
  status: SessionStatus = SessionStatus.COMPLETED;
  /** Stage at which an interrupted session stopped; empty for completed ones. */
  stoppedAt: string = '';
  emotionBefore: Emotion = Emotion.NONE;
  ratingAfter: number = RATING_NONE;
  /** Average heart rate from Health Kit (0 = not available / not consented). */
  heartRateAvg: number = 0;
}

/**
 * Everything needed to restore an unfinished session after an interruption
 * (screen off, watch face, call, low battery, process kill).
 */
export class SessionSnapshot {
  version: number = 1;
  savedAt: number = 0;
  startedAt: number = 0;
  durationMin: number = 3;
  mode: string = SessionMode.FULL;
  patternId: string = PatternId.RELAX_478;
  freeInhaleSec: number = 4;
  freeExhaleSec: number = 6;
  vibration: boolean = true;
  stepIndex: number = 0;
  /** Active elapsed ms inside the current breathing step. */
  stepElapsedMs: number = 0;
  /** Active practice time before the current step, ms. */
  activeMs: number = 0;
  cyclesDone: number = 0;
  emotion: string = Emotion.NONE;
  rating: number = RATING_NONE;
  stage: string = Stage.INTRO;
}
