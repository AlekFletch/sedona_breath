/*
 * Lite-wearable platform adapters. Every @system.* module is injected (see app.js),
 * so this file runs unchanged under Node tests with fakes.
 */

/** Pulses at or above this length use the long system pattern. */
export var LONG_PULSE_THRESHOLD_MS = 300;

/**
 * HapticDriver on @system.vibrator. Lite only has two fixed patterns:
 * 'short' (very short tick) and 'long' (about 1 s). There is no stop():
 * short ticks end by themselves, so "stop immediately" is satisfied by
 * cancelling all pending ticks (VibrationScheduler.stopAll()).
 */
export function LiteHaptics(vibrator) {
  this.vibrator = vibrator;
  this.count = 0;
}

LiteHaptics.prototype.pulse = function (durationMs) {
  this.count++;
  try {
    this.vibrator.vibrate({ mode: durationMs >= LONG_PULSE_THRESHOLD_MS ? 'long' : 'short' });
  } catch (e) {
    // vibration is best-effort
  }
};

LiteHaptics.prototype.stop = function () {
  // Not available on lite wearables; pending ticks are cancelled by the scheduler.
};

/** Clock + Scheduler. Lite has no monotonic clock API: Date.now() is used (injectable for tests). */
export function LiteTime(timers, now) {
  this.timers = timers;
  this.nowFn = now || function () {
    return Date.now();
  };
}

LiteTime.prototype.now = function () {
  return this.nowFn();
};

LiteTime.prototype.schedule = function (delayMs, cb) {
  return this.timers.setTimeout(cb, Math.max(0, delayMs));
};

LiteTime.prototype.cancel = function (handle) {
  this.timers.clearTimeout(handle);
};

/**
 * JSON files in the app sandbox (@system.file). @system.storage is not used:
 * on lite devices its values are limited to 128 characters.
 */
export var FILE_ROOT = 'internal://app/';

export function JsonFiles(file) {
  this.file = file;
}

JsonFiles.prototype.read = function (name, fallback, cb) {
  try {
    this.file.readText({
      uri: FILE_ROOT + name,
      success: function (data) {
        var value = fallback;
        try {
          value = JSON.parse(data.text);
        } catch (e) {
          value = fallback;
        }
        cb(value);
      },
      fail: function () {
        cb(fallback);
      }
    });
  } catch (e) {
    cb(fallback);
  }
};

JsonFiles.prototype.write = function (name, value, cb) {
  try {
    this.file.writeText({
      uri: FILE_ROOT + name,
      text: JSON.stringify(value),
      success: function () {
        if (cb) {
          cb(true);
        }
      },
      fail: function () {
        if (cb) {
          cb(false);
        }
      }
    });
  } catch (e) {
    if (cb) {
      cb(false);
    }
  }
};

JsonFiles.prototype.remove = function (name) {
  try {
    this.file.delete({ uri: FILE_ROOT + name, success: function () {}, fail: function () {} });
  } catch (e) {
    // nothing to delete
  }
};

/** 'system' -> system language if supported, otherwise Russian. */
export function resolveLanguage(setting, systemLanguage) {
  if (setting === 'ru' || setting === 'en' || setting === 'es') {
    return setting;
  }
  var l = (systemLanguage || '').toLowerCase().split(/[-_]/)[0];
  return l === 'en' || l === 'es' ? l : 'ru';
}

/** Replaces %d / %s / %1$s placeholders, like resource formatting in the ArkTS app. */
export function formatString(template, args) {
  var next = 0;
  return template.replace(/%(\d+\$)?[sd]/g, function (m, pos) {
    var i = pos ? parseInt(pos, 10) - 1 : next++;
    return i < args.length ? String(args[i]) : m;
  });
}

/** Strings of one language with Russian fallback for missing keys. */
export function buildDictionary(all, lang) {
  var out = {};
  var base = all.ru;
  var cur = all[lang] || base;
  var k;
  for (k in base) {
    if (Object.prototype.hasOwnProperty.call(base, k)) {
      out[k] = Object.prototype.hasOwnProperty.call(cur, k) ? cur[k] : base[k];
    }
  }
  return out;
}

export function startOfToday(now) {
  var d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
