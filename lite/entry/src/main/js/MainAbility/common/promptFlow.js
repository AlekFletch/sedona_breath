/*
 * The controller of pages/prompt: Sedona questions, emotion choice, check-in and the completion
 * message, restored from the SessionController snapshot (common/sessionPage.js).
 *
 * The full SessionController with its breath engine does not fit in the watch's JS heap next to
 * this page, so the prompt steps are walked here with the core's own plan and rules
 * (SessionPlanner, SupportRules). It mirrors SessionController step by step:
 * tools/node-test/lite.mjs drives both through the same sessions and compares every snapshot and
 * record. As soon as the next step is breathing, the stage changes and the page hands the session
 * back to pages/session.
 */
import { FreeRhythm, PatternCatalog } from '../core/BreathPattern.js';
import { SessionPlanner, StepKind } from '../core/SessionPlan.js';
import {
  Answer, Emotion, QuestionId, RATING_NONE, SessionStatus, Stage, parseDuration, parseEmotion, parseMode
} from '../core/SessionTypes.js';
import { CompletionMessage, SupportRules } from '../core/SupportRules.js';

export function PromptFlow(s, clock, sink, wallClock) {
  this.clock = clock;
  this.sink = sink;
  this.wallClock = wallClock;
  this.durationMin = parseDuration(s.durationMin);
  this.mode = parseMode(s.mode);
  this.patternId = PatternCatalog.parseId(s.patternId);
  this.free = new FreeRhythm(s.freeInhaleSec, s.freeExhaleSec);
  this.vibration = s.vibration;
  this.pattern = PatternCatalog.build(this.patternId, this.free);
  this.steps = SessionPlanner.build(this.durationMin, this.mode, this.pattern);
  this.startedAt = s.startedAt;
  this.activeAccumMs = Math.max(0, s.activeMs);
  this.activeSince = -1;
  this.cyclesBefore = Math.max(0, s.cyclesDone);
  this.messageSeed = 0;
  this.ended = false;
  this.observer = undefined;
  this.view = {
    stage: Stage.INTRO, stepIndex: 0, paused: true, question: 0, questionIndex: 0, questionTotal: 0,
    emotion: parseEmotion(s.emotion), emotionNote: false, rating: s.rating, message: CompletionMessage.GENTLE_1,
    professionalHint: false, notNowReturn: false
  };
  this.enterStep(Math.max(0, Math.min(s.stepIndex, this.steps.length)), true);
}

/** Same signature as SessionController.fromSnapshot; starts PAUSED at the saved step. */
PromptFlow.fromSnapshot = function (s, clock, scheduler, haptics, sink, wallClock) {
  return new PromptFlow(s, clock, sink, wallClock);
};

PromptFlow.prototype.setObserver = function (observer) {
  this.observer = observer;
};
PromptFlow.prototype.setMessageSeed = function (seed) {
  this.messageSeed = seed;
};
PromptFlow.prototype.isPaused = function () {
  return this.view.paused;
};
PromptFlow.prototype.isEnded = function () {
  return this.ended;
};
PromptFlow.prototype.currentStep = function () {
  return this.steps[this.view.stepIndex];
};

// ---------------------------------------------------------------- user actions

PromptFlow.prototype.answer = function (a) {
  var step = this.currentStep();
  if (step === undefined || step.kind !== StepKind.QUESTION || this.view.paused) {
    return;
  }
  if (step.question === QuestionId.WHEN && a === Answer.NOT_NOW) {
    // Gentle return to breathing, no pressure.
    this.view.notNowReturn = true;
    this.enterStep(SessionPlanner.completionIndex(this.steps), false);
    return;
  }
  this.next();
};

PromptFlow.prototype.chooseEmotion = function (e) {
  if (this.view.stage !== Stage.EMOTION || this.view.paused) {
    return;
  }
  this.view.emotion = e;
  if (SupportRules.recommendsProfessional(RATING_NONE, e)) {
    this.view.emotionNote = true;
    this.publish();
    return;
  }
  this.next();
};

PromptFlow.prototype.acknowledgeEmotionNote = function () {
  if (this.view.stage !== Stage.EMOTION) {
    return;
  }
  this.view.emotionNote = false;
  this.next();
};

PromptFlow.prototype.skipEmotion = function () {
  this.chooseEmotion(Emotion.NONE);
};

PromptFlow.prototype.rate = function (rating) {
  if (this.view.stage !== Stage.CHECK_IN) {
    return;
  }
  this.view.rating = rating;
  this.view.message = SupportRules.completionMessage(rating, this.messageSeed);
  this.view.professionalHint = SupportRules.recommendsProfessional(rating, this.view.emotion);
  this.next();
};

PromptFlow.prototype.finishMessage = function () {
  if (this.view.stage !== Stage.MESSAGE) {
    return;
  }
  this.next();
};

// ---------------------------------------------------------------- pause / end

PromptFlow.prototype.pause = function () {
  if (this.view.paused || this.ended || this.view.stage === Stage.SUMMARY) {
    return;
  }
  this.stopActiveClock();
  this.view.paused = true;
  this.persist();
  this.publish();
};

PromptFlow.prototype.resume = function () {
  if (!this.view.paused || this.ended) {
    return;
  }
  this.view.paused = false;
  this.startActiveClock();
  this.publish();
};

PromptFlow.prototype.interrupt = function () {
  if (this.ended || this.view.stage === Stage.SUMMARY) {
    this.persist();
    return;
  }
  this.pause();
};

PromptFlow.prototype.discard = function () {
  this.shutdown();
  this.sink.clear();
};

PromptFlow.prototype.shutdown = function () {
  this.ended = true;
  this.stopActiveClock();
};

// ---------------------------------------------------------------- records

PromptFlow.prototype.activeMs = function () {
  var running = this.activeSince >= 0 ? this.clock.now() - this.activeSince : 0;
  return this.activeAccumMs + running;
};

PromptFlow.prototype.buildRecord = function (status) {
  return {
    id: 0, startedAt: this.startedAt, endedAt: this.wallClock(), durationSec: Math.round(this.activeMs() / 1000),
    plannedMin: this.durationMin, mode: this.mode, patternId: this.pattern.id, cycles: this.cyclesBefore,
    status: status, stoppedAt: status === SessionStatus.INTERRUPTED ? this.view.stage : '',
    emotionBefore: this.view.emotion, ratingAfter: this.view.rating, heartRateAvg: 0
  };
};

PromptFlow.prototype.snapshot = function () {
  return {
    version: 1, savedAt: this.wallClock(), startedAt: this.startedAt, durationMin: this.durationMin,
    mode: this.mode, patternId: this.patternId, freeInhaleSec: this.free.inhaleSec,
    freeExhaleSec: this.free.exhaleSec, vibration: this.vibration, stepIndex: this.view.stepIndex,
    stepElapsedMs: 0, activeMs: this.activeMs(), cyclesDone: this.cyclesBefore, emotion: this.view.emotion,
    rating: this.view.rating, stage: this.view.stage
  };
};

/** Estimated time left for the whole session (orientation only). */
PromptFlow.prototype.remainingMs = function () {
  var i = this.view.stepIndex;
  if (i >= this.steps.length) {
    return 0;
  }
  return SessionPlanner.estimateRemainingMs(this.steps, i + 1, this.pattern) +
    SessionPlanner.estimateMs(this.steps[i], this.pattern);
};

// ---------------------------------------------------------------- steps

PromptFlow.prototype.next = function () {
  this.enterStep(this.view.stepIndex + 1, false);
};

PromptFlow.prototype.enterStep = function (index, restoredPaused) {
  this.view.stepIndex = index;
  this.view.emotionNote = false;
  if (index >= this.steps.length) {
    this.view.stage = Stage.SUMMARY;
    this.stopActiveClock();
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
  this.view.question = step.question;
  this.view.questionIndex = step.questionIndex;
  this.view.questionTotal = step.questionTotal;
  if (step.kind !== StepKind.COMPLETION_BREATH) {
    this.view.notNowReturn = false;
  }
  if (restoredPaused) {
    this.view.paused = true;
    this.stopActiveClock();
  } else {
    this.view.paused = false;
    this.startActiveClock();
  }
  // A breathing step: the snapshot points at its start and the page hands over to pages/session.
  this.persist();
  this.publish();
};

PromptFlow.prototype.startActiveClock = function () {
  if (this.activeSince < 0) {
    this.activeSince = this.clock.now();
  }
};

PromptFlow.prototype.stopActiveClock = function () {
  if (this.activeSince >= 0) {
    this.activeAccumMs += this.clock.now() - this.activeSince;
    this.activeSince = -1;
  }
};

PromptFlow.prototype.persist = function () {
  if (!this.ended) {
    this.sink.save(this.snapshot());
  }
};

PromptFlow.prototype.publish = function () {
  if (this.observer !== undefined) {
    this.observer.onUpdate(this.view);
  }
};
