/*
 * Shared session vocabulary. Pure logic, portable to the lite-wearable JS build.
 */

export enum SessionMode {
  /** Breathing + questions 1-4. */
  QUICK = 'quick',
  /** Breathing + questions 1-5, emotion choice after question 1. */
  FULL = 'full'
}

export enum QuestionId {
  FEEL = 1,
  ALLOW = 2,
  COULD_RELEASE = 3,
  WOULD_RELEASE = 4,
  WHEN = 5
}

export enum Answer {
  NONE = 'none',
  CONTINUE = 'continue',
  YES = 'yes',
  NO = 'no',
  DONT_KNOW = 'dontKnow',
  SKIP = 'skip',
  NOW = 'now',
  LATER = 'later',
  NOT_NOW = 'notNow'
}

export enum Emotion {
  NONE = '',
  ANGER = 'anger',
  ANXIETY = 'anxiety',
  FEAR = 'fear',
  RESENTMENT = 'resentment',
  SHAME = 'shame',
  GUILT = 'guilt',
  IRRITATION = 'irritation',
  SADNESS = 'sadness',
  DISAPPOINTMENT = 'disappointment',
  FATIGUE = 'fatigue',
  TENSION = 'tension',
  OTHER = 'other'
}

/** Exactly the 12 options from the spec, in display order. */
export const EMOTIONS: Emotion[] = [
  Emotion.ANGER, Emotion.ANXIETY, Emotion.FEAR, Emotion.RESENTMENT,
  Emotion.SHAME, Emotion.GUILT, Emotion.IRRITATION, Emotion.SADNESS,
  Emotion.DISAPPOINTMENT, Emotion.FATIGUE, Emotion.TENSION, Emotion.OTHER
];

export enum SessionStatus {
  COMPLETED = 'completed',
  INTERRUPTED = 'interrupted'
}

/** Stages of a session; stored with interrupted sessions as "where it stopped". */
export enum Stage {
  INTRO = 'intro',
  BREATHING = 'breathing',
  QUESTION = 'question',
  EMOTION = 'emotion',
  COMPLETION_BREATHING = 'completionBreathing',
  CHECK_IN = 'checkIn',
  MESSAGE = 'message',
  SUMMARY = 'summary'
}

export const DURATIONS_MIN: number[] = [2, 3, 5, 7, 10];
export const DEFAULT_DURATION_MIN: number = 3;
export const QUICK_START_DURATION_MIN: number = 3;

/** Rating scale 1..5, 0 = not given / skipped. */
export const RATING_MIN: number = 1;
export const RATING_MAX: number = 5;
export const RATING_NONE: number = 0;

export function parseEmotion(value: string): Emotion {
  for (const e of EMOTIONS) {
    if (e === value) {
      return e;
    }
  }
  return Emotion.NONE;
}

export function parseMode(value: string): SessionMode {
  return value === SessionMode.QUICK ? SessionMode.QUICK : SessionMode.FULL;
}

export function parseStage(value: string): Stage {
  const all: Stage[] = [Stage.INTRO, Stage.BREATHING, Stage.QUESTION, Stage.EMOTION,
    Stage.COMPLETION_BREATHING, Stage.CHECK_IN, Stage.MESSAGE, Stage.SUMMARY];
  for (const s of all) {
    if (s === value) {
      return s;
    }
  }
  return Stage.BREATHING;
}

export function parseDuration(value: number): number {
  for (const d of DURATIONS_MIN) {
    if (d === value) {
      return d;
    }
  }
  return DEFAULT_DURATION_MIN;
}

/** Answer buttons per question. */
export function answersFor(q: QuestionId): Answer[] {
  switch (q) {
    case QuestionId.FEEL:
      return [Answer.CONTINUE, Answer.SKIP];
    case QuestionId.WHEN:
      return [Answer.NOW, Answer.LATER, Answer.NOT_NOW];
    default:
      return [Answer.YES, Answer.NO, Answer.DONT_KNOW, Answer.SKIP];
  }
}

export function questionsFor(mode: SessionMode): QuestionId[] {
  return mode === SessionMode.QUICK
    ? [QuestionId.FEEL, QuestionId.ALLOW, QuestionId.COULD_RELEASE, QuestionId.WOULD_RELEASE]
    : [QuestionId.FEEL, QuestionId.ALLOW, QuestionId.COULD_RELEASE, QuestionId.WOULD_RELEASE, QuestionId.WHEN];
}
