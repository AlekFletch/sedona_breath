/*
 * State of the lite build for the pages outside a running session: settings, the page's texts
 * (strings.js) and the session files (records.js); the history is in history.js.
 *
 * Lite pages share nothing in memory: there is no this.$app.$def, every page is its own
 * bundle, and the JS heap holds one page at a time. So each page creates its own Store, and
 * data travels between pages in files and router params. Files are used instead of
 * @system.storage: storage callbacks sometimes never arrive on Watch Fit 4 Pro and values
 * are limited to 128 characters.
 */
import { DEFAULT_PATTERN, FreeRhythm, PatternCatalog } from '../core/BreathPattern.js';
import { DEFAULT_DURATION_MIN, SessionMode, parseDuration, parseMode } from '../core/SessionTypes.js';
import { JsonFiles } from './adapters.js';
import { SessionFiles } from './records.js';
import { Strings } from './strings.js';

var SETTINGS_FILE = 'settings.json';

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

export function mergeSettings(s) {
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

/**
 * @param sys           { file, configuration } (@system modules, fakes in tests)
 * @param templateKeys  string keys the page template shows as s.key (common/keys/<page>.js)
 * @param translate     the page's $t: path -> text
 */
export function Store(sys, templateKeys, translate) {
  Strings.call(this, templateKeys, translate);
  this.sys = sys;
  this.files = new JsonFiles(sys.file);
  this.settings = defaultSettings();
}
Store.prototype = Object.create(Strings.prototype);
Store.prototype.constructor = Store;

// Store = Strings + settings + the session files (snapshot, pending record).
var k;
for (k in SessionFiles.prototype) {
  Store.prototype[k] = SessionFiles.prototype[k];
}

Store.prototype.loadSettings = function (cb) {
  var self = this;
  this.files.read(SETTINGS_FILE, null, function (s) {
    self.settings = mergeSettings(s);
    self.applyLanguage();
    cb(self.settings);
  });
};

Store.prototype.saveSettings = function (cb) {
  this.settings = mergeSettings(this.settings);
  this.applyLanguage();
  this.files.write(SETTINGS_FILE, this.settings, cb);
};

Store.prototype.applyLanguage = function () {
  var system = '';
  try {
    system = this.sys.configuration.getLocale().language;
  } catch (e) {
    system = '';
  }
  this.lang = resolveLanguage(this.settings.language, system);
};

/**
 * Router params that start a session page with these settings: the session pages do not read
 * settings.json (less code next to the session in the heap).
 */
Store.prototype.sessionParams = function (durationMin, mode, patternId, vibration) {
  var st = this.settings;
  return {
    launch: 'new',
    lang: this.lang,
    durationMin: String(durationMin),
    mode: mode,
    patternId: patternId,
    vibration: vibration ? '1' : '0',
    freeIn: String(st.freeInhaleSec),
    freeEx: String(st.freeExhaleSec)
  };
};

/** 'system' -> system language if supported, otherwise Russian. */
export function resolveLanguage(setting, systemLanguage) {
  if (setting === 'ru' || setting === 'en' || setting === 'es') {
    return setting;
  }
  // No RegExp anywhere in watch code: the watch's JS engine is built without it and the
  // installer rejects the HAP with error 34 when a .js file fails to compile.
  var l = (systemLanguage || '').toLowerCase().substring(0, 2);
  return l === 'en' || l === 'es' ? l : 'ru';
}
