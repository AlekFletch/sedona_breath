/*
 * Builds the ordered list of steps for a session:
 * intro, the emotion ("What do you feel?"), its intensity, a short lead-in breathing, then the round
 * (questions with breathing pauses, completion breathing, intensity after); each repeated round
 * adds a pause and the same questions before the final message. Without `askEmotion` the emotion
 * and its intensity were asked before the session (the lite app has its own page for them).
 *
 * The chosen duration (2/3/5/7/10 min) is a target for the first round, not a hard limit:
 * questions are never cut and the completion stage is never shortened. Extra time goes into the
 * pauses between the questions, not into the lead-in, so the questions always start early.
 * Pure logic, portable to the lite-wearable JS build.
 */
import { BreathPattern } from './BreathPattern';
import { QuestionId, SessionMode, Stage, questionsFor } from './SessionTypes';

export enum StepKind {
  INTRO = 'intro',
  INTENSITY = 'intensity',
  BREATH = 'breath',
  QUESTION = 'question',
  EMOTION = 'emotion',
  COMPLETION_BREATH = 'completionBreath',
  CHECK_IN = 'checkIn',
  MESSAGE = 'message'
}

export class PlanStep {
  kind: StepKind;
  /** Number of breathing cycles for BREATH / COMPLETION_BREATH. */
  cycles: number;
  /** Question for QUESTION steps, 0 otherwise. */
  question: number;
  /** 1-based question index and total, for "Question N of M". */
  questionIndex: number;
  questionTotal: number;

  constructor(kind: StepKind, cycles: number = 0, question: number = 0, questionIndex: number = 0,
    questionTotal: number = 0) {
    this.kind = kind;
    this.cycles = cycles;
    this.question = question;
    this.questionIndex = questionIndex;
    this.questionTotal = questionTotal;
  }

  stage(): Stage {
    switch (this.kind) {
      case StepKind.INTRO:
        return Stage.INTRO;
      case StepKind.INTENSITY:
        return Stage.INTENSITY;
      case StepKind.QUESTION:
        return Stage.QUESTION;
      case StepKind.EMOTION:
        return Stage.EMOTION;
      case StepKind.COMPLETION_BREATH:
        return Stage.COMPLETION_BREATHING;
      case StepKind.CHECK_IN:
        return Stage.CHECK_IN;
      case StepKind.MESSAGE:
        return Stage.MESSAGE;
      default:
        return Stage.BREATHING;
    }
  }

  isBreathing(): boolean {
    return this.kind === StepKind.BREATH || this.kind === StepKind.COMPLETION_BREATH;
  }
}

export class SessionPlanner {
  /** Estimated time the user spends on non-breathing screens (used only for planning). */
  static readonly INTRO_MS: number = 9000;
  static readonly INTENSITY_MS: number = 8000;
  static readonly QUESTION_MS: number = 12000;
  static readonly EMOTION_MS: number = 10000;
  static readonly CHECK_IN_MS: number = 8000;
  static readonly MESSAGE_MS: number = 6000;
  static readonly MIN_LEAD_IN_CYCLES: number = 2;
  /** Completion breathing should last 30-60 s and contain 2-3 cycles. */
  static readonly COMPLETION_MAX_MS: number = 60000;

  /** 3 cycles if they fit into 60 s, otherwise 2. */
  static completionCycles(pattern: BreathPattern): number {
    return pattern.cycleMs() * 3 <= SessionPlanner.COMPLETION_MAX_MS ? 3 : 2;
  }

  /** Breathing pause after a question: 2 short cycles, or 1 long one (e.g. 4-7-8, box). */
  static pauseCycles(pattern: BreathPattern): number {
    return pattern.cycleMs() <= 12000 ? 2 : 1;
  }

  /** `rounds`: 1, plus one for every "Once more" after the intensity check. */
  static build(durationMin: number, mode: SessionMode, pattern: BreathPattern, rounds: number = 1,
    askEmotion: boolean = true): PlanStep[] {
    const cycle = pattern.cycleMs();
    const questions = questionsFor(mode);
    const completion = SessionPlanner.completionCycles(pattern);
    const totalMs = durationMin * 60000;

    const fixedMs = SessionPlanner.INTRO_MS
      + (askEmotion ? SessionPlanner.EMOTION_MS + SessionPlanner.INTENSITY_MS : 0)
      + questions.length * SessionPlanner.QUESTION_MS
      + completion * cycle
      + SessionPlanner.CHECK_IN_MS + SessionPlanner.MESSAGE_MS;
    const gaps = questions.length - 1;
    const leadIn = SessionPlanner.MIN_LEAD_IN_CYCLES;

    // Cycles left for the pauses between the questions, spread evenly (the first ones get the rest).
    const free = Math.floor((totalMs - fixedMs) / cycle) - leadIn;
    let pause = SessionPlanner.pauseCycles(pattern);
    if (free < gaps * pause) {
      pause = 1; // short session: 1 cycle after each question
    }
    const extra = Math.max(0, free - gaps * pause);
    const pauses: number[] = [];
    for (let i = 0; i < gaps; i++) {
      pauses.push(pause + Math.floor(extra / gaps) + (i < extra % gaps ? 1 : 0));
    }

    const steps: PlanStep[] = [];
    steps.push(new PlanStep(StepKind.INTRO));
    if (askEmotion) {
      steps.push(new PlanStep(StepKind.EMOTION));
      steps.push(new PlanStep(StepKind.INTENSITY));
    }
    steps.push(new PlanStep(StepKind.BREATH, leadIn));
    SessionPlanner.addRound(steps, questions, pauses, completion);
    const again: number[] = [];
    for (let i = 0; i < gaps; i++) {
      again.push(SessionPlanner.pauseCycles(pattern));
    }
    for (let r = 1; r < rounds; r++) {
      steps.push(new PlanStep(StepKind.BREATH, SessionPlanner.pauseCycles(pattern)));
      SessionPlanner.addRound(steps, questions, again, completion);
    }
    steps.push(new PlanStep(StepKind.MESSAGE));
    return steps;
  }

  /** Questions with breathing pauses, completion breathing and the intensity check. */
  private static addRound(steps: PlanStep[], questions: QuestionId[], pauses: number[], completion: number): void {
    for (let i = 0; i < questions.length; i++) {
      const q: QuestionId = questions[i];
      steps.push(new PlanStep(StepKind.QUESTION, 0, q, i + 1, questions.length));
      if (i < questions.length - 1) {
        steps.push(new PlanStep(StepKind.BREATH, pauses[i]));
      }
    }
    steps.push(new PlanStep(StepKind.COMPLETION_BREATH, completion));
    steps.push(new PlanStep(StepKind.CHECK_IN));
  }

  /** Estimated duration of one step, used for the "remaining time" indicator. */
  static estimateMs(step: PlanStep, pattern: BreathPattern): number {
    switch (step.kind) {
      case StepKind.INTRO:
        return SessionPlanner.INTRO_MS;
      case StepKind.INTENSITY:
        return SessionPlanner.INTENSITY_MS;
      case StepKind.BREATH:
      case StepKind.COMPLETION_BREATH:
        return step.cycles * pattern.cycleMs();
      case StepKind.QUESTION:
        return SessionPlanner.QUESTION_MS;
      case StepKind.EMOTION:
        return SessionPlanner.EMOTION_MS;
      case StepKind.CHECK_IN:
        return SessionPlanner.CHECK_IN_MS;
      default:
        return SessionPlanner.MESSAGE_MS;
    }
  }

  /** Estimated time left from the start of step `fromIndex` (exclusive of the current step's progress). */
  static estimateRemainingMs(steps: PlanStep[], fromIndex: number, pattern: BreathPattern): number {
    let sum = 0;
    for (let i = Math.max(0, fromIndex); i < steps.length; i++) {
      sum += SessionPlanner.estimateMs(steps[i], pattern);
    }
    return sum;
  }

  static totalEstimateMs(steps: PlanStep[], pattern: BreathPattern): number {
    return SessionPlanner.estimateRemainingMs(steps, 0, pattern);
  }

  /** Index of the next completion-breathing step from `from` ("Not now" returns gently to breathing). */
  static completionIndex(steps: PlanStep[], from: number = 0): number {
    for (let i = Math.max(0, from); i < steps.length; i++) {
      if (steps[i].kind === StepKind.COMPLETION_BREATH) {
        return i;
      }
    }
    return steps.length - 1;
  }
}
