/*
 * App-wide services of the lite build. Created once in app.js and shared with
 * pages through this.$app.$def.services (each lite page is a separate bundle,
 * module-level state is NOT shared between pages).
 *
 * All session logic comes from ../core (generated from the ArkTS app).
 */
import { ALL_PATTERNS, DEFAULT_PATTERN, FreeRhythm, PatternCatalog } from '../core/BreathPattern.js';
import { SessionConfig, SessionController, BreathVisual } from '../core/SessionController.js';
import {
  DEFAULT_DURATION_MIN, DURATIONS_MIN, EMOTIONS, QUICK_START_DURATION_MIN, SessionMode, SessionStatus, Stage,
  answersFor, parseDuration, parseMode
} from '../core/SessionTypes.js';
import { formatMmSs } from '../core/Timing.js';
import strings from '../i18n/strings.js';
import {
  JsonFiles, LiteHaptics, LiteTime, buildDictionary, formatString, resolveLanguage, startOfToday
} from './adapters.js';

var SETTINGS_FILE = 'settings.json';
var HISTORY_FILE = 'history.json';
var SNAPSHOT_FILE = 'snapshot.json';
var MAX_HISTORY = 200;
var LOW_BATTERY = 0.10;

export var LANGUAGES = ['system', 'ru', 'en', 'es'];

export function defaultSettings() {
  return {
    onboardingAccepted: false,
    language: 'system',
    defaultPattern: DEFAULT_PATTERN,
    defaultDurationMin: DEFAULT_DURATION_MIN,
    defaultMode: SessionMode.FULL,
    vibration: true,
    freeInhaleSec: FreeRhythm.DEFAULT_INHALE,
    freeExhaleSec: FreeRhythm.DEFAULT_EXHALE
  };
}

/** Enum value -> string key. Keys are literal so tools/build-lite.mjs can collect them. */
var PATTERN_KEYS = {
  relax478: 'pattern_relax478', calm46: 'pattern_calm46', box4444: 'pattern_box4444',
  longExhale426: 'pattern_longExhale426', free: 'pattern_free'
};
var MODE_KEYS = { quick: 'mode_quick', full: 'mode_full' };
var PHASE_KEYS = { inhale: 'phase_inhale', holdIn: 'phase_holdIn', exhale: 'phase_exhale', holdOut: 'phase_holdOut' };
var QUESTION_KEYS = { 1: 'q_1', 2: 'q_2', 3: 'q_3', 4: 'q_4', 5: 'q_5' };
var ANSWER_KEYS = {
  'continue': 'ans_continue', yes: 'ans_yes', no: 'ans_no', dontKnow: 'ans_dontKnow', skip: 'ans_skip',
  now: 'ans_now', later: 'ans_later', notNow: 'ans_notNow'
};
var EMOTION_KEYS = {
  anger: 'emotion_anger', anxiety: 'emotion_anxiety', fear: 'emotion_fear', resentment: 'emotion_resentment',
  shame: 'emotion_shame', guilt: 'emotion_guilt', irritation: 'emotion_irritation', sadness: 'emotion_sadness',
  disappointment: 'emotion_disappointment', fatigue: 'emotion_fatigue', tension: 'emotion_tension',
  other: 'emotion_other'
};
var STAGE_KEYS = {
  intro: 'stage_intro', breathing: 'stage_breathing', question: 'stage_question', emotion: 'stage_emotion',
  completionBreathing: 'stage_completionBreathing', checkIn: 'stage_checkIn', message: 'stage_message',
  summary: 'stage_summary'
};
var MESSAGE_KEYS = {
  gentle1: 'msg_gentle1', gentle2: 'msg_gentle2', gentle3: 'msg_gentle3', supportive: 'msg_supportive'
};
var LANGUAGE_KEYS = { system: 'lang_system', ru: 'lang_ru', en: 'lang_en', es: 'lang_es' };

/**
 * @param sys { vibrator, file, battery, brightness, configuration, timers: { setTimeout, clearTimeout },
 *              now?: () => ms (tests only) }
 */
export function Services(sys) {
  this.sys = sys;
  this.files = new JsonFiles(sys.file);
  this.time = new LiteTime(sys.timers, sys.now);
  this.haptics = new LiteHaptics(sys.vibrator);
  this.settings = defaultSettings();
  this.history = [];
  this.snapshotData = null;
  this.ready = false;
  this.waiters = [];
  this.session = null;
  this.summary = null;
  this.dict = buildDictionary(strings, 'ru');
  this.visual = BreathVisual;
}

// ------------------------------------------------------------------ loading

Services.prototype.load = function () {
  var self = this;
  self.files.read(SETTINGS_FILE, null, function (s) {
    self.settings = mergeSettings(s);
    self.applyLanguage();
    self.files.read(HISTORY_FILE, [], function (h) {
      self.history = Array.isArray(h) ? h : [];
      self.files.read(SNAPSHOT_FILE, null, function (snap) {
        self.snapshotData = snap && typeof snap.stepIndex === 'number' ? snap : null;
        self.ready = true;
        var w = self.waiters;
        self.waiters = [];
        for (var i = 0; i < w.length; i++) {
          w[i]();
        }
      });
    });
  });
};

/** Runs cb once files are loaded (immediately if they already are). */
Services.prototype.whenReady = function (cb) {
  if (this.ready) {
    cb();
  } else {
    this.waiters.push(cb);
  }
};

function mergeSettings(s) {
  var d = defaultSettings();
  if (!s || typeof s !== 'object') {
    return d;
  }
  d.onboardingAccepted = s.onboardingAccepted === true;
  d.language = LANGUAGES.indexOf(s.language) >= 0 ? s.language : 'system';
  d.defaultPattern = PatternCatalog.parseId(String(s.defaultPattern));
  d.defaultDurationMin = parseDuration(Number(s.defaultDurationMin));
  d.defaultMode = parseMode(String(s.defaultMode));
  d.vibration = s.vibration !== false;
  var f = new FreeRhythm(Number(s.freeInhaleSec) || FreeRhythm.DEFAULT_INHALE,
    Number(s.freeExhaleSec) || FreeRhythm.DEFAULT_EXHALE).normalized();
  d.freeInhaleSec = f.inhaleSec;
  d.freeExhaleSec = f.exhaleSec;
  return d;
}

// ------------------------------------------------------------------ strings

Services.prototype.applyLanguage = function () {
  var system = '';
  try {
    system = this.sys.configuration.getLocale().language;
  } catch (e) {
    system = '';
  }
  this.dict = buildDictionary(strings, resolveLanguage(this.settings.language, system));
};

Services.prototype.strings = function () {
  return this.dict;
};

Services.prototype.t = function (key) {
  return this.dict[key] !== undefined ? this.dict[key] : key;
};

Services.prototype.fmt = function (key) {
  var args = [];
  for (var i = 1; i < arguments.length; i++) {
    args.push(arguments[i]);
  }
  return formatString(this.t(key), args);
};

Services.prototype.patternLabel = function (id) {
  return this.t(PATTERN_KEYS[id] || 'pattern_relax478');
};
Services.prototype.modeLabel = function (mode) {
  return this.t(MODE_KEYS[mode] || 'mode_full');
};
Services.prototype.phaseLabel = function (phase) {
  return this.t(PHASE_KEYS[phase] || 'phase_inhale');
};
Services.prototype.questionText = function (q) {
  return this.t(QUESTION_KEYS[q] || 'q_1');
};
Services.prototype.answerLabel = function (a) {
  return this.t(ANSWER_KEYS[a] || 'ans_skip');
};
Services.prototype.emotionLabel = function (e) {
  return EMOTION_KEYS[e] ? this.t(EMOTION_KEYS[e]) : this.t('dash');
};
Services.prototype.stageLabel = function (s) {
  return this.t(STAGE_KEYS[s] || 'stage_breathing');
};
Services.prototype.messageText = function (m) {
  return this.t(MESSAGE_KEYS[m] || 'msg_gentle1');
};
Services.prototype.languageLabel = function (l) {
  return this.t(LANGUAGE_KEYS[l] || 'lang_system');
};
Services.prototype.onOff = function (on) {
  return this.t(on ? 'on' : 'off');
};
Services.prototype.mmss = function (ms) {
  return formatMmSs(ms);
};
Services.prototype.answersFor = function (q) {
  return answersFor(q);
};
Services.prototype.emotions = function () {
  return EMOTIONS;
};
Services.prototype.durations = function () {
  return DURATIONS_MIN;
};
Services.prototype.patterns = function () {
  return ALL_PATTERNS;
};

// ------------------------------------------------------------------ settings

Services.prototype.saveSettings = function () {
  this.settings = mergeSettings(this.settings);
  this.applyLanguage();
  this.files.write(SETTINGS_FILE, this.settings);
};

// ------------------------------------------------------------------ history

Services.prototype.latest = function (n) {
  return this.history.slice(0, n);
};

Services.prototype.todayCount = function () {
  var from = startOfToday(Date.now());
  var n = 0;
  for (var i = 0; i < this.history.length; i++) {
    if (this.history[i].startedAt >= from) {
      n++;
    }
  }
  return n;
};

Services.prototype.lastCompleted = function () {
  for (var i = 0; i < this.history.length; i++) {
    if (this.history[i].status === SessionStatus.COMPLETED) {
      return this.history[i];
    }
  }
  return null;
};

Services.prototype.addRecord = function (r, cb) {
  r.id = Date.now();
  this.history.unshift(plainRecord(r));
  if (this.history.length > MAX_HISTORY) {
    this.history.length = MAX_HISTORY;
  }
  this.files.write(HISTORY_FILE, this.history, cb);
};

Services.prototype.deleteHistory = function (cb) {
  this.history = [];
  this.files.write(HISTORY_FILE, this.history, cb);
};

function plainRecord(r) {
  return {
    id: r.id, startedAt: r.startedAt, endedAt: r.endedAt, durationSec: r.durationSec, plannedMin: r.plannedMin,
    mode: r.mode, patternId: r.patternId, cycles: r.cycles, status: r.status, stoppedAt: r.stoppedAt,
    emotionBefore: r.emotionBefore, ratingAfter: r.ratingAfter, heartRateAvg: 0
  };
}

// ------------------------------------------------------------------ SnapshotSink

Services.prototype.save = function (snapshot) {
  this.snapshotData = snapshot;
  this.files.write(SNAPSHOT_FILE, snapshot);
};

Services.prototype.clear = function () {
  this.snapshotData = null;
  this.files.remove(SNAPSHOT_FILE);
};

Services.prototype.hasUnfinished = function () {
  return this.snapshotData !== null;
};

// ------------------------------------------------------------------ sessions

Services.prototype.config = function (durationMin, mode, patternId, vibration) {
  var c = new SessionConfig();
  c.durationMin = durationMin;
  c.mode = mode;
  c.patternId = patternId;
  c.free = new FreeRhythm(this.settings.freeInhaleSec, this.settings.freeExhaleSec);
  c.vibration = vibration;
  return c;
};

Services.prototype.wall = function () {
  return Date.now();
};

Services.prototype.startSession = function (config) {
  this.dispose();
  var self = this;
  var c = new SessionController(config, this.time, this.time, this.haptics, this, function () {
    return self.wall();
  });
  c.setMessageSeed(this.history.length);
  this.session = c;
  c.start();
  return c;
};

Services.prototype.startQuick = function () {
  var s = this.settings;
  return this.startSession(this.config(QUICK_START_DURATION_MIN, SessionMode.QUICK, s.defaultPattern, s.vibration));
};

/** Restores the persisted session (paused at the saved point), or returns null. */
Services.prototype.restoreSession = function () {
  if (this.session !== null && !this.session.isEnded()) {
    return this.session;
  }
  if (this.snapshotData === null) {
    return null;
  }
  var self = this;
  var c = SessionController.fromSnapshot(this.snapshotData, this.time, this.time, this.haptics, this, function () {
    return self.wall();
  });
  c.setMessageSeed(this.history.length);
  this.session = c;
  return c;
};

Services.prototype.activeSession = function () {
  return this.session;
};

Services.prototype.isRunning = function () {
  return this.session !== null && !this.session.isEnded();
};

/** "End now": nothing is saved. */
Services.prototype.discard = function () {
  if (this.session !== null) {
    this.session.discard();
  } else {
    this.clear();
  }
  this.session = null;
  this.summary = null;
};

/** "End and save": INTERRUPTED with the stage where it stopped. */
Services.prototype.saveInterrupted = function (cb) {
  var c = this.session !== null ? this.session : this.restoreSession();
  if (c === null) {
    cb(false);
    return;
  }
  c.shutdown();
  var r = c.buildRecord(SessionStatus.INTERRUPTED);
  var self = this;
  this.addRecord(r, function (ok) {
    self.discard();
    cb(ok);
  });
};

Services.prototype.prepareSummary = function () {
  if (this.session === null) {
    return this.summary;
  }
  this.session.shutdown();
  this.summary = plainRecord(this.session.buildRecord(SessionStatus.COMPLETED));
  return this.summary;
};

Services.prototype.saveCompleted = function (cb) {
  var r = this.summary;
  if (r === null) {
    cb(false);
    return;
  }
  var self = this;
  this.addRecord(r, function (ok) {
    if (ok) {
      self.discard();
    }
    cb(ok);
  });
};

Services.prototype.dispose = function () {
  if (this.session !== null) {
    this.session.shutdown();
  }
  this.session = null;
  this.summary = null;
};

Services.prototype.isSummaryStage = function (c) {
  return c.view.stage === Stage.SUMMARY;
};

// ------------------------------------------------------------------ device

Services.prototype.keepScreenOn = function (on) {
  try {
    this.sys.brightness.setKeepScreenOn({ keepScreenOn: on, success: function () {}, fail: function () {} });
  } catch (e) {
    // not critical
  }
};

/** cb(true) when the battery is at or below 10 % and not charging. */
Services.prototype.checkLowBattery = function (cb) {
  try {
    this.sys.battery.getStatus({
      success: function (d) {
        cb(d.level >= 0 && d.level <= LOW_BATTERY && !d.charging);
      },
      fail: function () {
        cb(false);
      }
    });
  } catch (e) {
    cb(false);
  }
};
