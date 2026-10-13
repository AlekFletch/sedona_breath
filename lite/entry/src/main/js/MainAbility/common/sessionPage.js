/*
 * What the two pages of a running session share: pages/session (intro, breathing, completion
 * breathing) and pages/prompt (Sedona questions, emotion, check-in, completion message).
 *
 * A single page with all of it needs ~106 KB of JS heap in the simulator, more than the watch
 * has. So the session is split and moves between the pages through the SessionController
 * snapshot: when the controller enters a stage of the other page, this page saves the snapshot
 * and opens the other one, which restores it and resumes at once. pages/prompt walks its steps
 * with common/promptFlow.js instead of the full controller (see there).
 *
 * Router params (strings): launch = 'new' | 'resume' | 'handoff', lang = 'ru' | 'en' | 'es';
 * for 'new' also durationMin, mode, patternId, vibration ('1' / '0'), freeIn, freeEx (Store.sessionParams);
 * notNow = '1' when the user answered "Not now". These pages do not read settings.json.
 * The controller lives in module variables, not in page data, so the framework does not observe it.
 */
import router from '@system.router';
import vibrator from '@system.vibrator';
import battery from '@system.battery';
import brightness from '@system.brightness';
import file from '@system.file';
import { FreeRhythm, PatternCatalog } from '../core/BreathPattern.js';
import { SessionStatus, parseDuration, parseMode } from '../core/SessionTypes.js';
import { formatMmSs } from '../core/Timing.js';
import { JsonFiles, LiteHaptics, LiteTime } from './adapters.js';
import { SessionFiles } from './records.js';
import { pageForStage } from './stages.js';
import { Strings } from './strings.js';
import { timers } from './system.js';
import { textHeight } from './textSize.js';
import { focusList, isBackSwipe, refocusList, useBackground } from './ui.js';

export var MODAL_NONE = 0;
var MODAL_PAUSED = 1;
var MODAL_END = 2;
var MODAL_INTERRUPTED = 3;
var MODAL_LOW_BATTERY = 4;

var TICK_MS = 100;
var REMAINING_EVERY = 5;        // remaining time refresh: every 500 ms
var BATTERY_EVERY = 300;        // battery check: every 30 s
var SNAPSHOT_EVERY = 50;        // periodic snapshot while running: every 5 s
var LOW_BATTERY = 0.10;

/** Shared state of the current page (one page is alive at a time): texts, session files, controller. */
export var current = {
  strings: null,
  files: null,
  c: null
};
var timer = null;
var ticks = 0;
var leaving = false;

function keepScreenOn(on) {
  try {
    brightness.setKeepScreenOn({ keepScreenOn: on, success: function () {}, fail: function () {} });
  } catch (e) {
    // not critical
  }
}

/** cb(true) when the battery is at or below 10 % and not charging. */
function checkLowBattery(cb) {
  try {
    battery.getStatus({
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
}

function wallClock() {
  return Date.now();
}

/**
 * Builds a session page. `page` gives its name ('session' | 'prompt'), template keys, the
 * controller module ({ SessionController, SessionConfig }: the core one, or PromptFlow for
 * pages/prompt), own data fields, paint(view) and its own tap handlers.
 */
export function sessionPage(page) {
  var data = {
    launch: '',
    lang: 'ru',
    durationMin: '',
    mode: '',
    patternId: '',
    vibration: '',
    freeIn: '',
    freeEx: '',
    notNow: '',
    bg: '',
    s: {},
    modal: 0,
    dialogTitle: '',
    dialogH: 42,
    dialogR: 54,
    dialogBody: '',
    remainingText: ''
  };
  var k;
  for (k in page.data) {
    data[k] = page.data[k];
  }

  var vm = {
    data: data,

    onInit() {
      useBackground(this);
      var strings = new Strings(page.keys, (path) => this.$t(path));
      strings.lang = this.lang;
      var files = new SessionFiles(new JsonFiles(file));
      current.strings = strings;
      current.files = files;
      current.c = null;
      timer = null;
      ticks = 0;
      leaving = false;
      this.s = strings.strings();
      var time = new LiteTime(timers);
      var haptics = new LiteHaptics(vibrator);
      if (this.launch !== 'new') {
        files.readSnapshot((snap) => {
          if (snap === null) {
            this.leave('index');
            return;
          }
          var restored = page.core.SessionController.fromSnapshot(snap, time, time, haptics, files, wallClock);
          restored.setMessageSeed(snap.savedAt);
          if (this.notNow === '1') {
            restored.view.notNowReturn = true;
          }
          this.attach(restored, this.launch === 'handoff');
        });
        return;
      }
      var config = new page.core.SessionConfig();
      config.durationMin = parseDuration(Number(this.durationMin));
      config.mode = parseMode(this.mode);
      config.patternId = PatternCatalog.parseId(this.patternId);
      config.vibration = this.vibration !== '0';
      config.free = new FreeRhythm(Number(this.freeIn), Number(this.freeEx)).normalized();
      var c = new page.core.SessionController(config, time, time, haptics, files, wallClock);
      c.setMessageSeed(Math.floor(Date.now() / 1000));
      this.attach(c, false);
      c.start();
    },

    attach(c, resumeNow) {
      current.c = c;
      c.setObserver({
        onUpdate: (v) => this.update(v),
        onSummary: () => this.toSummary()
      });
      if (resumeNow) {
        c.resume();
      }
      this.update(c.view);
      if (c.isPaused()) {
        this.showModal(MODAL_INTERRUPTED); // restored after an interruption
      } else {
        keepScreenOn(true);
      }
      timer = setInterval(() => this.tick(), TICK_MS);
      refocusList(this);
    },

    /* Named update/paint, not render: the lite loader puts the compiled template into `render`. */
    update(v) {
      if (leaving) {
        return;
      }
      if (v.stage !== 'summary' && pageForStage(v.stage) !== page.name) {
        this.handoff(pageForStage(v.stage), v.notNowReturn);
        return;
      }
      if (this.modal === MODAL_NONE) {
        page.paint.call(this, v);
      }
      this.remainingText = current.strings.fmt('remaining', formatMmSs(current.c.remainingMs()));
    },

    /* The controller entered a stage of the other page: hand the session over through the snapshot. */
    handoff(target, notNow) {
      var c = current.c;
      leaving = true;
      var snap = c.snapshot();
      c.shutdown();
      current.files.save(snap, () => {
        this.go(target, { launch: 'handoff', notNow: notNow ? '1' : '' });
      });
    },

    onShow() {
      var c = current.c;
      if (c !== null && c.isPaused() && this.modal === MODAL_NONE) {
        this.showModal(MODAL_INTERRUPTED);
      }
    },

    /* Screen off / watch face / call: pause, stop vibration, persist. */
    onHide() {
      this.interrupt(MODAL_INTERRUPTED);
    },

    onDestroy() {
      this.stopTimer();
      keepScreenOn(false);
      var c = current.c;
      if (c !== null) {
        c.setObserver(undefined);
        if (!leaving) {
          c.interrupt();
        }
        current.c = null;
      }
    },

    stopTimer() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    },

    tick() {
      var c = current.c;
      if (c === null || c.isEnded() || leaving) {
        return;
      }
      ticks++;
      var running = !c.isPaused() && this.modal === MODAL_NONE;
      if (running && page.onTick) {
        page.onTick.call(this, c);
      }
      if (ticks % REMAINING_EVERY === 0) {
        var text = current.strings.fmt('remaining', formatMmSs(c.remainingMs()));
        if (text !== this.remainingText) {
          this.remainingText = text;
        }
      }
      if (running && ticks % SNAPSHOT_EVERY === 0) {
        current.files.save(c.snapshot());
      }
      if (running && ticks % BATTERY_EVERY === 0) {
        checkLowBattery((low) => {
          if (low) {
            this.interrupt(MODAL_LOW_BATTERY);
          }
        });
      }
    },

    /* Pause / end / interruption dialog (on pages/session it covers the breathing screen). */
    showModal(kind) {
      var strings = current.strings;
      var title;
      var body = '';
      if (kind === MODAL_PAUSED) {
        title = strings.t('paused_title');
      } else if (kind === MODAL_END) {
        title = strings.t('end_title');
      } else if (kind === MODAL_LOW_BATTERY) {
        title = strings.t('low_battery');
      } else {
        title = strings.t('interrupted_title');
        body = strings.t('interrupted_body');
      }
      this.dialogH = textHeight(title, true);
      this.dialogR = this.dialogH + 12;
      this.dialogTitle = title;
      this.dialogBody = body;
      if (this.modal !== MODAL_NONE) {
        this.modal = kind;
        return;
      }
      // The breathing / question screen goes away: release the crown first (see ui.focusList).
      focusList(this, false);
      this.modal = kind;
      refocusList(this);
    },

    interrupt(kind) {
      var c = current.c;
      if (c === null || c.isEnded() || leaving) {
        return;
      }
      c.interrupt();
      keepScreenOn(false);
      this.showModal(kind);
    },

    /*
     * The next page is loaded before this one is freed, so both must fit in the heap together:
     * drop the controller and the rendered screen first.
     */
    go(target, params) {
      leaving = true;
      this.stopTimer();
      focusList(this, false);
      var lang = current.strings !== null ? current.strings.lang : 'ru';
      if (current.c !== null) {
        current.c.setObserver(undefined);
      }
      current.c = null;
      current.strings = null;
      current.files = null;
      this.modal = 0;
      this.screen = '';
      var options = { uri: 'pages/' + target + '/' + target, params: params || {} };
      options.params.lang = lang;
      router.replace(options);
    },

    leave(target) {
      this.go(target, null);
    },

    act() {
      return current.c !== null && this.modal === MODAL_NONE && !leaving;
    },
    pause() {
      if (!this.act()) {
        return;
      }
      current.c.pause();
      keepScreenOn(false);
      this.showModal(MODAL_PAUSED);
    },
    resume() {
      var c = current.c;
      if (c === null) {
        return;
      }
      // The dialog list goes away on pages/session: release the crown first (see ui.focusList).
      focusList(this, false);
      this.modal = MODAL_NONE;
      if (c.isPaused()) {
        c.resume();
      } else {
        page.paint.call(this, c.view);
      }
      keepScreenOn(true);
      refocusList(this);
    },
    askEnd() {
      if (current.c === null) {
        return;
      }
      current.c.pause();
      this.showModal(MODAL_END);
    },
    /* "End now": nothing is saved. */
    endNow() {
      if (current.c !== null) {
        current.c.discard();
      }
      this.leave('index');
    },
    /* "End and save": the home page moves the INTERRUPTED record from pending.json to history. */
    endAndSave() {
      this.finish(SessionStatus.INTERRUPTED, 'index');
    },
    toSummary() {
      this.finish(SessionStatus.COMPLETED, 'summary');
    },
    finish(status, target) {
      var c = current.c;
      if (c === null) {
        return;
      }
      var files = current.files;
      leaving = true;
      c.shutdown();
      files.writePending(c.buildRecord(status), () => {
        files.clear();
        this.leave(target);
      });
    },

    /* Swipe back never silently drops a practice: it opens the end dialog. */
    onSwipe(e) {
      if (!isBackSwipe(e)) {
        return;
      }
      if (this.modal === MODAL_NONE) {
        this.askEnd();
      } else if (this.modal === MODAL_END) {
        this.resume();
      }
    }
  };
  for (k in page.methods) {
    vm[k] = page.methods[k];
  }
  return vm;
}
