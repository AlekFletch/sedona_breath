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

/**
 * Clock + Scheduler. Lite has no monotonic clock API: Date.now() is used (injectable for tests).
 *
 * No setTimeout per task: the core schedules every vibration tick and phase end at once (10+ on a
 * 4-7-8 inhale), and the watch runs only a few timers at a time. On Watch Fit 4 Pro the phase
 * timer was never set: the first inhale vibrated, then the phase, the label and the steps stood
 * still. Tasks wait in a queue instead and the page runs the due ones from its one interval (poll).
 */
export function LiteTime(now) {
  this.nowFn = now || function () {
    return Date.now();
  };
  this.tasks = [];
  this.nextId = 1;
  this.last = 0;
}

/** Never goes back: the wall clock can step back on a time sync, and the circle would jump. */
LiteTime.prototype.now = function () {
  var t = this.nowFn();
  if (t < this.last) {
    t = this.last;
  }
  this.last = t;
  return t;
};

LiteTime.prototype.schedule = function (delayMs, cb) {
  var id = this.nextId++;
  this.tasks.push({ id: id, due: this.now() + Math.max(0, delayMs), cb: cb });
  return id;
};

LiteTime.prototype.cancel = function (handle) {
  for (var i = 0; i < this.tasks.length; i++) {
    if (this.tasks[i].id === handle) {
      this.tasks.splice(i, 1);
      return;
    }
  }
};

/** Runs the due tasks, earliest first (a task may schedule or cancel others). */
LiteTime.prototype.poll = function () {
  var now = this.now();
  // A guard: a task that keeps scheduling itself with no delay waits for the next poll.
  for (var n = 0; n < 100; n++) {
    var first = -1;
    for (var i = 0; i < this.tasks.length; i++) {
      if (this.tasks[i].due <= now && (first < 0 || this.tasks[i].due < this.tasks[first].due)) {
        first = i;
      }
    }
    if (first < 0) {
      return;
    }
    var task = this.tasks.splice(first, 1)[0];
    task.cb();
  }
};

/** Drops every task (the page is leaving). */
LiteTime.prototype.clear = function () {
  this.tasks = [];
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
