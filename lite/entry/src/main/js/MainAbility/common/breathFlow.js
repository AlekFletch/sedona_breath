/*
 * The controller of pages/session: intro, breathing and completion breathing, with the core's own
 * plan, breath engine and vibration (SessionPlanner, BreathEngine, VibrationScheduler).
 *
 * The full SessionController (questions, emotion, check-in, messages, records) left no room in the
 * watch's JS heap for the breathing screen, so this page walks only its own steps; pages/prompt has
 * common/promptFlow.js for the rest. It mirrors SessionController step by step:
 * tools/node-test/lite.mjs drives both through the same sessions and compares views, snapshots,
 * vibration and records. As soon as the next step is a prompt, the stage changes and the page
 * hands the session over to pages/prompt.
 */
import { FreeRhythm, PatternCatalog, PhaseType } from '../core/BreathPattern.js';
import { BreathEngine, EngineState } from '../core/BreathEngine.js';
import { SessionPlanner, StepKind } from '../core/SessionPlan.js';
import { INTENSITY_NONE, SessionStatus, Stage, parseDuration, parseEmotion, parseMode } from '../core/SessionTypes.js';
import { VibrationScheduler } from '../core/Vibration.js';

var INTRO_SLIDES = 3;
var INTRO_SLIDE_MS = 3000;
var MIN_SCALE = 0.55;
var MAX_SCALE = 1.0;

/** Same as BreathVisual.scaleAt: the circle grows on inhale, holds, shrinks on exhale. */
export function circleScale(phase, progress) {
  var p = Math.max(0, Math.min(1, progress));
  var span = MAX_SCALE - MIN_SCALE;
  if (phase === PhaseType.INHALE) {
    return MIN_SCALE + span * p;
  }
  if (phase === PhaseType.HOLD_IN) {
    return MAX_SCALE;
  }
  return phase === PhaseType.EXHALE ? MAX_SCALE - span * p : MIN_SCALE;
}

/**
 * p: durationMin, mode, patternId, freeInhaleSec, freeExhaleSec, vibration (checked values, as in
 * a snapshot), askEmotion (false: emotion and intensityBefore were asked on pages/feel and come in p).
 * clock and scheduler: LiteTime. Starts with start() or, restored, with fromSnapshot().
 */
export function BreathFlow(p, clock, scheduler, haptics, sink, wallClock) {
  this.durationMin = parseDuration(p.durationMin);
  this.mode = parseMode(p.mode);
  this.patternId = PatternCatalog.parseId(p.patternId);
  this.free = new FreeRhythm(p.freeInhaleSec, p.freeExhaleSec);
  this.vibrationOn = p.vibration;
  this.pattern = PatternCatalog.build(this.patternId, this.free);
  this.askEmotion = p.askEmotion !== false;
  this.steps = SessionPlanner.build(this.durationMin, this.mode, this.pattern, 1, this.askEmotion);
  this.clock = clock;
  this.scheduler = scheduler;
  this.sink = sink;
  this.wallClock = wallClock;
  this.vibration = new VibrationScheduler(haptics, scheduler);
  this.vibration.setEnabled(p.vibration);
  this.startedAt = 0;
  this.observer = undefined;
  this.engine = undefined;
  this.introTimer = 0;
  this.activeAccumMs = 0;
  this.activeSince = -1;
  this.cyclesBefore = 0;
  this.pendingEngineStartMs = 0;
  this.ended = false;
  this.view = {
    stage: Stage.INTRO, stepIndex: 0, introIndex: 0, phase: PhaseType.INHALE, cycle: 0, paused: false,
    notNowReturn: false, emotion: parseEmotion(p.emotion || ''),
    intensityBefore: typeof p.intensityBefore === 'number' ? p.intensityBefore : INTENSITY_NONE,
    intensityAfter: INTENSITY_NONE, rounds: 1
  };
}

/** Same signature as SessionController.fromSnapshot; starts PAUSED at the saved position. */
BreathFlow.fromSnapshot = function (s, clock, scheduler, haptics, sink, wallClock) {
  var f = new BreathFlow(s, clock, scheduler, haptics, sink, wallClock);
  f.startedAt = s.startedAt;
  f.activeAccumMs = Math.max(0, s.activeMs);
  f.cyclesBefore = Math.max(0, s.cyclesDone);
  f.view.emotion = parseEmotion(s.emotion);
  f.view.intensityBefore = s.intensityBefore;
  f.view.intensityAfter = s.intensityAfter;
  f.setRounds(s.rounds);
  f.enterStep(Math.max(0, Math.min(s.stepIndex, f.steps.length)), s.stepElapsedMs, true);
  return f;
};

BreathFlow.prototype.setObserver = function (observer) {
  this.observer = observer;
};
BreathFlow.prototype.setMessageSeed = function () {
  // The completion message is chosen on pages/prompt.
};
BreathFlow.prototype.start = function () {
  this.startedAt = this.wallClock();
  this.enterStep(0, 0, false);
};
BreathFlow.prototype.isPaused = function () {
  return this.view.paused;
};
BreathFlow.prototype.isEnded = function () {
  return this.ended;
};

// ---------------------------------------------------------------- actions

BreathFlow.prototype.finishIntro = function () {
  if (this.view.stage !== Stage.INTRO || this.view.paused) {
    return;
  }
  this.clearIntroTimer();
  this.next();
};

BreathFlow.prototype.pause = function () {
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
};

BreathFlow.prototype.resume = function () {
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
};

BreathFlow.prototype.interrupt = function () {
  if (this.ended || this.view.stage === Stage.SUMMARY) {
    this.persist();
    return;
  }
  this.pause();
};

BreathFlow.prototype.discard = function () {
  this.shutdown();
  this.sink.clear();
};

BreathFlow.prototype.shutdown = function () {
  this.ended = true;
  this.stopActiveClock();
  if (this.engine !== undefined) {
    this.engine.cancel();
  }
  this.clearIntroTimer();
  this.vibration.stopAll();
};

// ---------------------------------------------------------------- records

BreathFlow.prototype.buildRecord = function (status) {
  return {
    id: 0, startedAt: this.startedAt, endedAt: this.wallClock(), durationSec: Math.round(this.activeMs() / 1000),
    plannedMin: this.durationMin, mode: this.mode, patternId: this.pattern.id, cycles: this.cyclesDone(),
    status: status, stoppedAt: status === SessionStatus.INTERRUPTED ? this.view.stage : '',
    emotionBefore: this.view.emotion, intensityBefore: this.view.intensityBefore,
    intensityAfter: this.view.intensityAfter, rounds: this.view.rounds, heartRateAvg: 0
  };
};

BreathFlow.prototype.snapshot = function () {
  return {
    version: 1, savedAt: this.wallClock(), startedAt: this.startedAt, durationMin: this.durationMin,
    mode: this.mode, patternId: this.patternId, freeInhaleSec: this.free.inhaleSec,
    freeExhaleSec: this.free.exhaleSec, vibration: this.vibrationOn, stepIndex: this.view.stepIndex,
    stepElapsedMs: this.engine !== undefined ? this.engineElapsed() : 0, activeMs: this.activeMs(),
    cyclesDone: this.cyclesBefore, emotion: this.view.emotion, intensityBefore: this.view.intensityBefore,
    intensityAfter: this.view.intensityAfter, rounds: this.view.rounds, askEmotion: this.askEmotion,
    stage: this.view.stage
  };
};

BreathFlow.prototype.activeMs = function () {
  var running = this.activeSince >= 0 ? this.clock.now() - this.activeSince : 0;
  return this.activeAccumMs + running;
};

BreathFlow.prototype.cyclesDone = function () {
  return this.cyclesBefore + (this.engine !== undefined ? this.engine.completedCycles() : 0);
};

/** Estimated time left for the whole session (orientation only). */
BreathFlow.prototype.remainingMs = function () {
  var i = this.view.stepIndex;
  if (i >= this.steps.length) {
    return 0;
  }
  var later = SessionPlanner.estimateRemainingMs(this.steps, i + 1, this.pattern);
  if (this.engine !== undefined) {
    return later + this.engine.remainingMs();
  }
  return later + SessionPlanner.estimateMs(this.steps[i], this.pattern);
};

BreathFlow.prototype.phaseProgress = function () {
  if (this.engine === undefined) {
    return 0;
  }
  var pos = this.engine.position();
  return pos.phase.durationMs > 0 ? pos.phaseElapsedMs / pos.phase.durationMs : 0;
};

BreathFlow.prototype.currentPhase = function () {
  return this.engine !== undefined ? this.engine.position().phase.type : PhaseType.INHALE;
};

// ---------------------------------------------------------------- BreathListener

BreathFlow.prototype.onPhase = function (pos) {
  this.view.phase = pos.phase.type;
  this.view.cycle = pos.cycle + 1;
  this.vibration.playPhase(pos.phase, pos.phaseElapsedMs);
  this.publish();
};

BreathFlow.prototype.onFinish = function () {
  var step = this.steps[this.view.stepIndex];
  this.vibration.stopAll();
  if (step !== undefined && step.kind === StepKind.COMPLETION_BREATH) {
    this.vibration.playSessionEnd();
  }
  this.next();
};

// ---------------------------------------------------------------- steps

BreathFlow.prototype.next = function () {
  this.enterStep(this.view.stepIndex + 1, 0, false);
};

BreathFlow.prototype.enterStep = function (index, elapsedInStepMs, restoredPaused) {
  if (this.engine !== undefined) {
    this.cyclesBefore += this.engine.completedCycles();
    this.engine.cancel();
    this.engine = undefined;
  }
  this.clearIntroTimer();
  this.view.stepIndex = index;
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
  var step = this.steps[index];
  this.view.stage = step.stage();
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
    var engine = new BreathEngine(this.pattern, step.cycles, this.clock, this.scheduler, this);
    this.engine = engine;
    var startAt = Math.max(0, Math.min(elapsedInStepMs, engine.totalMs()));
    var pos = BreathEngine.positionAt(this.pattern, step.cycles, startAt);
    this.view.phase = pos.phase.type;
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
  // A prompt step: the snapshot points at it and the page hands over to pages/prompt.
  this.persist();
  this.publish();
};

/** Same as SessionController.setRounds: the plan for this many rounds of questions. */
BreathFlow.prototype.setRounds = function (rounds) {
  var n = rounds >= 1 ? Math.floor(rounds) : 1;
  this.view.rounds = n;
  this.steps = SessionPlanner.build(this.durationMin, this.mode, this.pattern, n, this.askEmotion);
};

BreathFlow.prototype.armIntroTimer = function () {
  var self = this;
  this.clearIntroTimer();
  this.introTimer = this.scheduler.schedule(INTRO_SLIDE_MS, function () {
    self.introTimer = 0;
    if (self.view.introIndex < INTRO_SLIDES - 1) {
      self.view.introIndex++;
      self.publish();
      self.armIntroTimer();
    } else {
      self.finishIntro();
    }
  });
};

BreathFlow.prototype.clearIntroTimer = function () {
  if (this.introTimer !== 0) {
    this.scheduler.cancel(this.introTimer);
    this.introTimer = 0;
  }
};

BreathFlow.prototype.engineElapsed = function () {
  return this.engine.getState() === EngineState.IDLE ? this.pendingEngineStartMs : this.engine.elapsedMs();
};

BreathFlow.prototype.startActiveClock = function () {
  if (this.activeSince < 0) {
    this.activeSince = this.clock.now();
  }
};

BreathFlow.prototype.stopActiveClock = function () {
  if (this.activeSince >= 0) {
    this.activeAccumMs += this.clock.now() - this.activeSince;
    this.activeSince = -1;
  }
};

BreathFlow.prototype.persist = function () {
  if (!this.ended) {
    this.sink.save(this.snapshot());
  }
};

BreathFlow.prototype.publish = function () {
  if (this.observer !== undefined) {
    this.observer.onUpdate(this.view);
  }
};
