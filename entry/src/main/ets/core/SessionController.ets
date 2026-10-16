/*
 * Session orchestration: walks the plan (intro -> emotion -> intensity -> breathing / questions ->
 * completion breathing -> intensity check, once more if the emotion is still there ->
 * message -> summary), drives the breath
 * engine and the vibration scheduler, tracks active time and cycles, and
 * produces snapshots for interruption recovery.
 *
 * UI-agnostic: pages observe it through SessionObserver and read `view`.
 * Pure logic, portable to the lite-wearable JS build.
 */
import { BreathPattern, FreeRhythm, PatternCatalog, PatternId, PhaseType } from './BreathPattern';
import { BreathEngine, BreathListener, BreathPosition, EngineState } from './BreathEngine';
import { PlanStep, SessionPlanner, StepKind } from './SessionPlan';
import { SessionRecord, SessionSnapshot } from './SessionRecord';
import {
  Answer, Emotion, INTENSITY_FREE, INTENSITY_MAX, INTENSITY_MIN, INTENSITY_NONE, QuestionId, SessionMode, SessionStatus,
  Stage, parseDuration, parseEmotion, parseMode
} from './SessionTypes';
import { CompletionMessage, SupportRules } from './SupportRules';
import { Clock, Scheduler } from './Timing';
import { HapticDriver, VibrationScheduler } from './Vibration';

export class SessionConfig {
  durationMin: number = 3;
  mode: SessionMode = SessionMode.FULL;
  patternId: PatternId = PatternId.RELAX_478;
  free: FreeRhythm = new FreeRhythm();
  vibration: boolean = true;
  /** The emotion and its intensity were asked before the session: the plan skips them. */
  presetEmotion: boolean = false;
  emotion: Emotion = Emotion.NONE;
  intensityBefore: number = INTENSITY_NONE;
}

/** Read-only state for the UI. Plain fields: copy into @State on onUpdate(). */
export class SessionView {
  stage: Stage = Stage.INTRO;
  stepIndex: number = 0;
  introIndex: number = 0;
  phase: PhaseType = PhaseType.INHALE;
  phaseDurationMs: number = 0;
  /** Elapsed ms inside the phase at the moment it was (re)entered. */
  phaseElapsedMs: number = 0;
  /** 1-based cycle inside the current breathing step. */
  cycle: number = 0;
  cyclesInStep: number = 0;
  question: number = 0;
  questionIndex: number = 0;
  questionTotal: number = 0;
  paused: boolean = false;
  /** Shown after "Not now": a gentle return to breathing. */
  notNowReturn: boolean = false;
  /** Shown after choosing "Fear": suggestion to talk to someone. */
  emotionNote: boolean = false;
  emotion: Emotion = Emotion.NONE;
  intensityBefore: number = INTENSITY_NONE;
  intensityAfter: number = INTENSITY_NONE;
  /** On the intensity check, after 1..5: "Once more?" */
  repeatOffer: boolean = false;
  /** Rounds started (1 + "Once more"). */
  rounds: number = 1;
  message: CompletionMessage = CompletionMessage.GENTLE_1;
  professionalHint: boolean = false;
  /** Increments on each update so observers can cheaply detect changes. */
  revision: number = 0;
}

export interface SessionObserver {
  onUpdate(view: SessionView): void;

  /** Summary reached: the session is ready to be saved. */
  onSummary(): void;
}

export interface SnapshotSink {
  save(snapshot: SessionSnapshot): void;

  clear(): void;
}

export class SessionController implements BreathListener {
  static readonly INTRO_SLIDES: number = 3;
  static readonly INTRO_SLIDE_MS: number = 3000;

  readonly config: SessionConfig;
  readonly pattern: BreathPattern;
  steps: PlanStep[];
  readonly view: SessionView = new SessionView();
  startedAt: number = 0;

  private clock: Clock;
  private scheduler: Scheduler;
  private vibration: VibrationScheduler;
  private sink: SnapshotSink;
  private observer: SessionObserver | undefined = undefined;
  private wallClock: () => number;

  private engine: BreathEngine | undefined = undefined;
  private introTimer: number = 0;
  private activeAccumMs: number = 0;
  private activeSince: number = -1;
  private cyclesBefore: number = 0;
  private messageSeed: number = 0;
  private ended: boolean = false;

  constructor(config: SessionConfig, clock: Clock, scheduler: Scheduler, haptics: HapticDriver, sink: SnapshotSink,
    wallClock: () => number) {
    this.config = config;
    this.config.durationMin = parseDuration(config.durationMin);
    this.pattern = PatternCatalog.build(config.patternId, config.free);
    this.steps = SessionPlanner.build(this.config.durationMin, config.mode, this.pattern, 1, !config.presetEmotion);
    this.view.emotion = config.emotion;
    this.view.intensityBefore = config.intensityBefore;
    this.clock = clock;
    this.scheduler = scheduler;
    this.sink = sink;
    this.wallClock = wallClock;
    this.vibration = new VibrationScheduler(haptics, scheduler);
    this.vibration.setEnabled(config.vibration);
  }

  /** Rebuilds a controller from a snapshot; it starts PAUSED at the saved position. */
  static fromSnapshot(s: SessionSnapshot, clock: Clock, scheduler: Scheduler, haptics: HapticDriver,
    sink: SnapshotSink, wallClock: () => number): SessionController {
    const cfg = new SessionConfig();
    cfg.durationMin = parseDuration(s.durationMin);
    cfg.mode = parseMode(s.mode);
    cfg.patternId = PatternCatalog.parseId(s.patternId);
    cfg.free = new FreeRhythm(s.freeInhaleSec, s.freeExhaleSec);
    cfg.vibration = s.vibration;
    cfg.presetEmotion = s.askEmotion === false;
    const c = new SessionController(cfg, clock, scheduler, haptics, sink, wallClock);
    c.startedAt = s.startedAt;
    c.activeAccumMs = Math.max(0, s.activeMs);
    c.cyclesBefore = Math.max(0, s.cyclesDone);
    c.view.emotion = parseEmotion(s.emotion);
    c.view.intensityBefore = s.intensityBefore;
    c.view.intensityAfter = s.intensityAfter;
    c.setRounds(s.rounds);
    const index = Math.max(0, Math.min(s.stepIndex, c.steps.length));
    c.enterStep(index, s.stepElapsedMs, true);
    return c;
  }

  setObserver(observer: SessionObserver | undefined): void {
    this.observer = observer;
  }

  setMessageSeed(seed: number): void {
    this.messageSeed = seed;
  }

  setVibrationEnabled(enabled: boolean): void {
    this.config.vibration = enabled;
    this.vibration.setEnabled(enabled);
  }

  start(): void {
    this.startedAt = this.wallClock();
    this.enterStep(0, 0, false);
  }

  currentStep(): PlanStep | undefined {
    return this.view.stepIndex < this.steps.length ? this.steps[this.view.stepIndex] : undefined;
  }

  isPaused(): boolean {
    return this.view.paused;
  }

  isEnded(): boolean {
    return this.ended;
  }

  // ---------------------------------------------------------------- actions

  /** Tap on the intro or end of the intro timer. */
  finishIntro(): void {
    if (this.view.stage !== Stage.INTRO || this.view.paused) {
      return;
    }
    this.clearIntroTimer();
    this.next();
  }

  answer(a: Answer): void {
    const step = this.currentStep();
    if (step === undefined || step.kind !== StepKind.QUESTION || this.view.paused) {
      return;
    }
    if (step.question === QuestionId.WHEN && a === Answer.NOT_NOW) {
      // Gentle return to breathing, no pressure.
      this.view.notNowReturn = true;
      this.enterStep(SessionPlanner.completionIndex(this.steps, this.view.stepIndex), 0, false);
      return;
    }
    this.next();
  }

  chooseEmotion(e: Emotion): void {
    if (this.view.stage !== Stage.EMOTION || this.view.paused) {
      return;
    }
    this.view.emotion = e;
    if (SupportRules.recommendsProfessional(INTENSITY_NONE, e)) {
      this.view.emotionNote = true;
      this.publish();
      return;
    }
    this.next();
  }

  /** Closes the "fear" note shown on the emotion screen. */
  acknowledgeEmotionNote(): void {
    if (this.view.stage !== Stage.EMOTION) {
      return;
    }
    this.view.emotionNote = false;
    this.next();
  }

  skipEmotion(): void {
    this.chooseEmotion(Emotion.NONE);
  }

  /** Intensity of the emotion before the practice, 1..5. */
  rateBefore(intensity: number): void {
    if (this.view.stage !== Stage.INTENSITY || this.view.paused) {
      return;
    }
    this.view.intensityBefore = Math.max(INTENSITY_MIN, Math.min(INTENSITY_MAX, Math.round(intensity)));
    this.next();
  }

  /** Intensity after the round: INTENSITY_FREE ("Free") ends the practice, 1..5 offers one more round. */
  rate(intensity: number): void {
    if (this.view.stage !== Stage.CHECK_IN || this.view.repeatOffer) {
      return;
    }
    this.view.intensityAfter = Math.max(INTENSITY_FREE, Math.min(INTENSITY_MAX, Math.round(intensity)));
    if (this.view.intensityAfter === INTENSITY_FREE) {
      this.finishRounds();
      return;
    }
    this.view.repeatOffer = true;
    this.publish();
  }

  /** "Once more": another round of the questions. */
  repeat(): void {
    if (this.view.stage !== Stage.CHECK_IN || !this.view.repeatOffer) {
      return;
    }
    this.setRounds(this.view.rounds + 1);
    this.next();
  }

  /** "Finish" after 1..5, or "Free": to the completion message. */
  finishRounds(): void {
    if (this.view.stage !== Stage.CHECK_IN || this.view.intensityAfter === INTENSITY_NONE) {
      return;
    }
    this.view.message = SupportRules.completionMessage(this.view.intensityAfter, this.messageSeed);
    this.view.professionalHint = SupportRules.recommendsProfessional(this.view.intensityAfter, this.view.emotion);
    this.enterStep(this.steps.length - 1, 0, false);
  }

  /** "Next" on the completion message -> summary. */
  finishMessage(): void {
    if (this.view.stage !== Stage.MESSAGE) {
      return;
    }
    this.next();
  }

  pause(): void {
    if (this.view.paused || this.ended || this.view.stage === Stage.SUMMARY) {
      return;
    }
    this.stopActiveClock();
    if (this.engine !== undefined) {
      this.engine.pause();
    }
    this.clearIntroTimer();
    this.vibration.stopAll();
    this.view.paused = true;
    this.persist();
    this.publish();
  }

  resume(): void {
    if (!this.view.paused || this.ended) {
      return;
    }
    this.view.paused = false;
    this.startActiveClock();
    if (this.engine !== undefined) {
      if (this.engine.getState() === EngineState.IDLE) {
        this.engine.start(this.pendingEngineStartMs);
      } else {
        this.engine.resume();
      }
    } else if (this.view.stage === Stage.INTRO) {
      this.armIntroTimer();
    }
    this.publish();
  }

  /** App went to background / screen off / call / low battery: pause and persist. */
  interrupt(): void {
    if (this.ended || this.view.stage === Stage.SUMMARY) {
      this.persist();
      return;
    }
    this.pause();
  }

  /** "End now" (not saved). Stops everything and drops the snapshot. */
  discard(): void {
    this.shutdown();
    this.sink.clear();
  }

  /** Stops timers/vibration; the caller saves buildRecord() itself. */
  shutdown(): void {
    this.ended = true;
    this.stopActiveClock();
    if (this.engine !== undefined) {
      this.engine.cancel();
    }
    this.clearIntroTimer();
    this.vibration.stopAll();
  }

  /** Record for the history. INTERRUPTED records remember the stage where they stopped. */
  buildRecord(status: SessionStatus): SessionRecord {
    const r = new SessionRecord();
    r.startedAt = this.startedAt;
    r.endedAt = this.wallClock();
    r.durationSec = Math.round(this.activeMs() / 1000);
    r.plannedMin = this.config.durationMin;
    r.mode = this.config.mode;
    r.patternId = this.pattern.id;
    r.cycles = this.cyclesDone();
    r.status = status;
    r.stoppedAt = status === SessionStatus.INTERRUPTED ? this.view.stage : '';
    r.emotionBefore = this.view.emotion;
    r.intensityBefore = this.view.intensityBefore;
    r.intensityAfter = this.view.intensityAfter;
    r.rounds = this.view.rounds;
    return r;
  }

  snapshot(): SessionSnapshot {
    const s = new SessionSnapshot();
    s.savedAt = this.wallClock();
    s.startedAt = this.startedAt;
    s.durationMin = this.config.durationMin;
    s.mode = this.config.mode;
    s.patternId = this.config.patternId;
    s.freeInhaleSec = this.config.free.inhaleSec;
    s.freeExhaleSec = this.config.free.exhaleSec;
    s.vibration = this.config.vibration;
    s.stepIndex = this.view.stepIndex;
    s.stepElapsedMs = this.engine !== undefined ? this.engineElapsed() : 0;
    s.activeMs = this.activeMs();
    s.cyclesDone = this.cyclesBefore;
    s.emotion = this.view.emotion;
    s.intensityBefore = this.view.intensityBefore;
    s.intensityAfter = this.view.intensityAfter;
    s.rounds = this.view.rounds;
    s.askEmotion = !this.config.presetEmotion;
    s.stage = this.view.stage;
    return s;
  }

  // ---------------------------------------------------------------- metrics

  activeMs(): number {
    const running = this.activeSince >= 0 ? this.clock.now() - this.activeSince : 0;
    return this.activeAccumMs + running;
  }

  cyclesDone(): number {
    return this.cyclesBefore + (this.engine !== undefined ? this.engine.completedCycles() : 0);
  }

  /** Estimated time left for the whole session (orientation only). */
  remainingMs(): number {
    const i = this.view.stepIndex;
    if (i >= this.steps.length) {
      return 0;
    }
    const later = SessionPlanner.estimateRemainingMs(this.steps, i + 1, this.pattern);
    if (this.engine !== undefined) {
      return later + this.engine.remainingMs();
    }
    return later + SessionPlanner.estimateMs(this.steps[i], this.pattern);
  }

  /** Current phase progress 0..1 (for drawing a frozen circle while paused). */
  phaseProgress(): number {
    if (this.engine === undefined) {
      return 0;
    }
    const pos = this.engine.position();
    return pos.phase.durationMs > 0 ? pos.phaseElapsedMs / pos.phase.durationMs : 0;
  }

  currentPhase(): PhaseType {
    return this.engine !== undefined ? this.engine.position().phase.type : PhaseType.INHALE;
  }

  // ---------------------------------------------------------- BreathListener

  onPhase(pos: BreathPosition): void {
    this.view.phase = pos.phase.type;
    this.view.phaseDurationMs = pos.phase.durationMs;
    this.view.phaseElapsedMs = pos.phaseElapsedMs;
    this.view.cycle = pos.cycle + 1;
    this.vibration.playPhase(pos.phase, pos.phaseElapsedMs);
    this.publish();
  }

  onFinish(): void {
    const step = this.currentStep();
    this.vibration.stopAll();
    if (step !== undefined && step.kind === StepKind.COMPLETION_BREATH) {
      this.vibration.playSessionEnd();
    }
    this.next();
  }

  // ---------------------------------------------------------------- internal

  private pendingEngineStartMs: number = 0;

  private next(): void {
    this.enterStep(this.view.stepIndex + 1, 0, false);
  }

  private enterStep(index: number, elapsedInStepMs: number, restoredPaused: boolean): void {
    // Close the previous breathing step.
    if (this.engine !== undefined) {
      this.cyclesBefore += this.engine.completedCycles();
      this.engine.cancel();
      this.engine = undefined;
    }
    this.clearIntroTimer();
    this.view.stepIndex = index;
    this.view.emotionNote = false;
    this.view.repeatOffer = false;

    if (index >= this.steps.length) {
      this.view.stage = Stage.SUMMARY;
      this.stopActiveClock();
      this.vibration.stopAll();
      this.view.paused = false;
      this.persist();
      this.publish();
      if (this.observer !== undefined) {
        this.observer.onSummary();
      }
      return;
    }

    const step = this.steps[index];
    this.view.stage = step.stage();
    this.view.question = step.question;
    this.view.questionIndex = step.questionIndex;
    this.view.questionTotal = step.questionTotal;
    this.view.cyclesInStep = step.cycles;
    if (step.kind !== StepKind.COMPLETION_BREATH) {
      this.view.notNowReturn = false;
    }
    if (step.kind === StepKind.INTRO) {
      this.view.introIndex = 0;
    }

    if (restoredPaused) {
      this.view.paused = true;
      this.stopActiveClock();
    } else {
      this.view.paused = false;
      this.startActiveClock();
    }

    if (step.isBreathing()) {
      const engine = new BreathEngine(this.pattern, step.cycles, this.clock, this.scheduler, this);
      this.engine = engine;
      const startAt = Math.max(0, Math.min(elapsedInStepMs, engine.totalMs()));
      const pos = BreathEngine.positionAt(this.pattern, step.cycles, startAt);
      this.view.phase = pos.phase.type;
      this.view.phaseDurationMs = pos.phase.durationMs;
      this.view.phaseElapsedMs = pos.phaseElapsedMs;
      this.view.cycle = pos.cycle + 1;
      if (restoredPaused) {
        this.pendingEngineStartMs = startAt;
      } else {
        this.persist();
        engine.start(startAt); // emits onPhase -> publish
        return;
      }
    } else if (step.kind === StepKind.INTRO && !restoredPaused) {
      this.armIntroTimer();
    }
    this.persist();
    this.publish();
  }

  /** Rebuilds the plan for `rounds` rounds; the steps before the new round stay the same. */
  private setRounds(rounds: number): void {
    const n = rounds >= 1 ? Math.floor(rounds) : 1;
    this.view.rounds = n;
    this.steps = SessionPlanner.build(this.config.durationMin, this.config.mode, this.pattern, n,
      !this.config.presetEmotion);
  }

  private armIntroTimer(): void {
    this.clearIntroTimer();
    this.introTimer = this.scheduler.schedule(SessionController.INTRO_SLIDE_MS, () => {
      this.introTimer = 0;
      if (this.view.introIndex < SessionController.INTRO_SLIDES - 1) {
        this.view.introIndex++;
        this.publish();
        this.armIntroTimer();
      } else {
        this.finishIntro();
      }
    });
  }

  private clearIntroTimer(): void {
    if (this.introTimer !== 0) {
      this.scheduler.cancel(this.introTimer);
      this.introTimer = 0;
    }
  }

  private engineElapsed(): number {
    if (this.engine === undefined) {
      return 0;
    }
    return this.engine.getState() === EngineState.IDLE ? this.pendingEngineStartMs : this.engine.elapsedMs();
  }

  private startActiveClock(): void {
    if (this.activeSince < 0) {
      this.activeSince = this.clock.now();
    }
  }

  private stopActiveClock(): void {
    if (this.activeSince >= 0) {
      this.activeAccumMs += this.clock.now() - this.activeSince;
      this.activeSince = -1;
    }
  }

  private persist(): void {
    if (!this.ended) {
      this.sink.save(this.snapshot());
    }
  }

  private publish(): void {
    this.view.revision++;
    if (this.observer !== undefined) {
      this.observer.onUpdate(this.view);
    }
  }
}

/** Circle scale for the breathing animation: grows on inhale, holds, shrinks on exhale. */
export class BreathVisual {
  static readonly MIN_SCALE: number = 0.55;
  static readonly MAX_SCALE: number = 1.0;

  static scaleAt(phase: PhaseType, progress: number): number {
    const p = Math.max(0, Math.min(1, progress));
    const span = BreathVisual.MAX_SCALE - BreathVisual.MIN_SCALE;
    switch (phase) {
      case PhaseType.INHALE:
        return BreathVisual.MIN_SCALE + span * p;
      case PhaseType.HOLD_IN:
        return BreathVisual.MAX_SCALE;
      case PhaseType.EXHALE:
        return BreathVisual.MAX_SCALE - span * p;
      default:
        return BreathVisual.MIN_SCALE;
    }
  }

  /** Target scale at the end of the phase. */
  static targetScale(phase: PhaseType): number {
    return BreathVisual.scaleAt(phase, 1);
  }
}
