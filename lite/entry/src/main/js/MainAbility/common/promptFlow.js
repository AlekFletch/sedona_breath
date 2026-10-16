/*
 * The controller of pages/prompt: intensity before, Sedona questions, emotion choice, intensity
 * after ("Free", or 1..5 and "Once more?") and the completion message, restored from the
 * SessionController snapshot (common/sessionPage.js).
 *
 * The full SessionController with its breath engine does not fit in the watch's JS heap next to
 * this page, so the prompt steps are walked here with the core's rules (SupportRules) and the plan
 * pages/session writes to plan.json (common/plan.js; passed in as s.plan): the planner and the
 * breath patterns are not bundled either. It mirrors SessionController step by step:
 * tools/node-test/lite.mjs drives both through the same sessions and compares every snapshot and
 * record. As soon as the next step is breathing, the stage changes and the page hands the session
 * back to pages/session.
 */
import {
  Answer, Emotion, INTENSITY_FREE, INTENSITY_MAX, INTENSITY_MIN, INTENSITY_NONE, QuestionId, SessionStatus, Stage,
  parseDuration, parseEmotion, parseMode
} from '../core/SessionTypes.js';
import { CompletionMessage, SupportRules } from '../core/SupportRules.js';

// Fields of a plan step, read from the plan string (common/plan.js).
var STAGE = 0;
var QUESTION = 1;
var QUESTION_INDEX = 2;
var QUESTION_TOTAL = 3;
var ESTIMATED_MS = 4;

/**
 * 'stage:question:estimatedMs,...' -> [stage, question, questionIndex, questionTotal, estimatedMs] per
 * step. Questions are numbered within their round (a round ends with the intensity check).
 */
function readPlan(text) {
  var parts = text.split(',');
  var steps = [];
  var roundStart = 0;
  var n = 0;
  var i;
  var k;
  for (i = 0; i < parts.length; i++) {
    var f = parts[i].split(':');
    var question = f[0] === Stage.QUESTION;
    if (question) {
      n++;
    }
    steps.push([f[0], Number(f[1]), question ? n : 0, 0, Number(f[2])]);
    if (f[0] === Stage.CHECK_IN || i === parts.length - 1) {
      for (k = roundStart; k <= i; k++) {
        if (steps[k][STAGE] === Stage.QUESTION) {
          steps[k][QUESTION_TOTAL] = n;
        }
      }
      roundStart = i + 1;
      n = 0;
    }
  }
  return steps;
}

export function PromptFlow(s, clock, sink, wallClock) {
  this.clock = clock;
  this.sink = sink;
  this.wallClock = wallClock;
  this.durationMin = parseDuration(s.durationMin);
  this.mode = parseMode(s.mode);
  // Passed on as they are: they came from SessionController, which has checked them.
  this.patternId = s.patternId;
  this.freeInhaleSec = s.freeInhaleSec;
  this.freeExhaleSec = s.freeExhaleSec;
  this.vibration = s.vibration;
  this.askEmotion = s.askEmotion !== false;
  this.steps = readPlan(s.plan);
  this.startedAt = s.startedAt;
  this.activeAccumMs = Math.max(0, s.activeMs);
  this.activeSince = -1;
  this.cyclesBefore = Math.max(0, s.cyclesDone);
  this.messageSeed = 0;
  this.ended = false;
  this.observer = undefined;
  this.view = {
    stage: Stage.INTRO, stepIndex: 0, paused: true, question: 0, questionIndex: 0, questionTotal: 0,
    emotion: parseEmotion(s.emotion), emotionNote: false, intensityBefore: s.intensityBefore,
    intensityAfter: s.intensityAfter, repeatOffer: false, rounds: s.rounds >= 1 ? Math.floor(s.rounds) : 1,
    message: CompletionMessage.GENTLE_1, professionalHint: false, notNowReturn: false
  };
  this.enterStep(Math.max(0, Math.min(s.stepIndex, this.steps.length)), true);
}

/**
 * Same signature as SessionController.fromSnapshot; starts PAUSED at the saved step. null for a
 * missing plan (no plan.json): pages/session has to restore the session.
 */
PromptFlow.fromSnapshot = function (s, clock, scheduler, haptics, sink, wallClock) {
  if (typeof s.plan !== 'string' || s.plan === '') {
    return null;
  }
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
  if (step === undefined || step[STAGE] !== Stage.QUESTION || this.view.paused) {
    return;
  }
  if (step[QUESTION] === QuestionId.WHEN && a === Answer.NOT_NOW) {
    // Gentle return to breathing, no pressure.
    this.view.notNowReturn = true;
    this.enterStep(this.completionIndex(this.view.stepIndex), false);
    return;
  }
  this.next();
};

PromptFlow.prototype.chooseEmotion = function (e) {
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

PromptFlow.prototype.rateBefore = function (intensity) {
  if (this.view.stage !== Stage.INTENSITY || this.view.paused) {
    return;
  }
  this.view.intensityBefore = Math.max(INTENSITY_MIN, Math.min(INTENSITY_MAX, Math.round(intensity)));
  this.next();
};

PromptFlow.prototype.rate = function (intensity) {
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
};

/**
 * "Once more": the next round starts with breathing, so the snapshot points at it and the page
 * hands over to pages/session, which rebuilds the plan for the new number of rounds.
 */
PromptFlow.prototype.repeat = function () {
  if (this.view.stage !== Stage.CHECK_IN || !this.view.repeatOffer) {
    return;
  }
  this.view.rounds++;
  this.view.repeatOffer = false;
  this.view.stepIndex++;
  this.view.stage = Stage.BREATHING;
  this.view.notNowReturn = false;
  this.view.paused = false;
  this.startActiveClock();
  this.persist();
  this.publish();
};

PromptFlow.prototype.finishRounds = function () {
  if (this.view.stage !== Stage.CHECK_IN || this.view.intensityAfter === INTENSITY_NONE) {
    return;
  }
  this.view.message = SupportRules.completionMessage(this.view.intensityAfter, this.messageSeed);
  this.view.professionalHint = SupportRules.recommendsProfessional(this.view.intensityAfter, this.view.emotion);
  this.enterStep(this.steps.length - 1, false);
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
    plannedMin: this.durationMin, mode: this.mode, patternId: this.patternId, cycles: this.cyclesBefore,
    status: status, stoppedAt: status === SessionStatus.INTERRUPTED ? this.view.stage : '',
    emotionBefore: this.view.emotion, intensityBefore: this.view.intensityBefore,
    intensityAfter: this.view.intensityAfter, rounds: this.view.rounds, heartRateAvg: 0
  };
};

PromptFlow.prototype.snapshot = function () {
  return {
    version: 1, savedAt: this.wallClock(), startedAt: this.startedAt, durationMin: this.durationMin,
    mode: this.mode, patternId: this.patternId, freeInhaleSec: this.freeInhaleSec,
    freeExhaleSec: this.freeExhaleSec, vibration: this.vibration, stepIndex: this.view.stepIndex,
    stepElapsedMs: 0, activeMs: this.activeMs(), cyclesDone: this.cyclesBefore, emotion: this.view.emotion,
    intensityBefore: this.view.intensityBefore, intensityAfter: this.view.intensityAfter, rounds: this.view.rounds,
    askEmotion: this.askEmotion, stage: this.view.stage
  };
};

/** Estimated time left for the whole session (orientation only). */
PromptFlow.prototype.remainingMs = function () {
  var sum = 0;
  for (var i = this.view.stepIndex; i < this.steps.length; i++) {
    sum += this.steps[i][ESTIMATED_MS];
  }
  return sum;
};

/** Same as SessionPlanner.completionIndex: the next completion breathing step from `from`. */
PromptFlow.prototype.completionIndex = function (from) {
  for (var i = from; i < this.steps.length; i++) {
    if (this.steps[i][STAGE] === Stage.COMPLETION_BREATHING) {
      return i;
    }
  }
  return this.steps.length - 1;
};

// ---------------------------------------------------------------- steps

PromptFlow.prototype.next = function () {
  this.enterStep(this.view.stepIndex + 1, false);
};

PromptFlow.prototype.enterStep = function (index, restoredPaused) {
  this.view.stepIndex = index;
  this.view.emotionNote = false;
  this.view.repeatOffer = false;
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
  this.view.stage = step[STAGE];
  this.view.question = step[QUESTION];
  this.view.questionIndex = step[QUESTION_INDEX];
  this.view.questionTotal = step[QUESTION_TOTAL];
  if (step[STAGE] !== Stage.COMPLETION_BREATHING) {
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
