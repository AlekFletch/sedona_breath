/*
 * Lite-wearable platform adapters. Every @system.* module is injected (see common/system.js),
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

/**
 * Files are read in 4 KB chunks (the way RepPulse reads them on the same watch). All the JSON
 * written here is ASCII (ids, enum values, numbers), so characters and bytes match.
 */
export var READ_CHUNK = 4096;

JsonFiles.prototype.read = function (name, fallback, cb) {
  var file = this.file;
  var text = '';
  function done(value) {
    text = '';
    cb(value);
  }
  function readFrom(position) {
    file.readText({
      uri: FILE_ROOT + name,
      position: position,
      length: READ_CHUNK,
      success: function (data) {
        var chunk = (data && data.text) || '';
        text += chunk;
        if (chunk.length === READ_CHUNK) {
          readFrom(position + READ_CHUNK);
          return;
        }
        var value = fallback;
        try {
          value = JSON.parse(text);
        } catch (e) {
          value = fallback;
        }
        done(value);
      },
      fail: function () {
        done(fallback);
      }
    });
  }
  try {
    readFrom(0);
  } catch (e) {
    done(fallback);
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
  // No RegExp anywhere in watch code: the watch's JS engine is built without it and the
  // installer rejects the HAP with error 34 when a .js file fails to compile.
  var l = (systemLanguage || '').toLowerCase().substring(0, 2);
  return l === 'en' || l === 'es' ? l : 'ru';
}

function isDigit(c) {
  return c >= '0' && c <= '9';
}

/** Replaces %d / %s / %1$s placeholders, like resource formatting in the ArkTS app. */
export function formatString(template, args) {
  var out = '';
  var next = 0;
  var i = 0;
  while (i < template.length) {
    var c = template.charAt(i);
    if (c !== '%') {
      out += c;
      i++;
      continue;
    }
    // Optional "N$" position, then 's' or 'd'.
    var j = i + 1;
    while (j < template.length && isDigit(template.charAt(j))) {
      j++;
    }
    var pos = -1;
    if (j > i + 1 && template.charAt(j) === '$') {
      pos = parseInt(template.substring(i + 1, j), 10) - 1;
      j++;
    } else {
      j = i + 1;
    }
    var type = template.charAt(j);
    if (type !== 's' && type !== 'd') {
      out += c;
      i++;
      continue;
    }
    var idx = pos >= 0 ? pos : next++;
    out += idx < args.length ? String(args[idx]) : template.substring(i, j + 1);
    i = j + 1;
  }
  return out;
}

export function startOfToday(now) {
  var d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
