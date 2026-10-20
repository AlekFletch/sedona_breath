import app from '@system.app';
import device from '@system.device';
import { DEFAULT_DURATION_MIN } from '../../core/SessionTypes.js';
import { Store } from '../../common/store.js';
import { appendRecord } from '../../common/history.js';
import { pageForStage } from '../../common/stages.js';
import { storeSystem } from '../../common/system.js';
import { focusList, go, isBackSwipe, refocusList, useBackground } from '../../common/ui.js';
import templateKeys from '../../common/keys/index.js';

var store = null;
/** 'summary' | 'session' | 'prompt' | '' — the page "Continue" reopens. */
var unfinishedKind = '';

/** Settings read and the onboarding done: the page can be drawn once the screen shape is known. */
var loaded = false;
/** The onboarding is due: it opens once the screen shape is known too. */
var onboarding = false;
var SCREEN_H = 480; // Watch Fit screen height, px
var ROUND_H = 466;  // WATCH GT round screen, px
var ROUND_TOP = 72; // li-round: rows above it are cut by the circle

/*
 * Screen 1: "Practice" (the emotion and its intensity on pages/feel, then the session with the mode,
 * breathing and vibration from Settings), History, Settings; "Continue" / "Finish" for an
 * unfinished practice. No setup screen on lite.
 */
export default {
  data: {
    bg: '',
    s: {},
    ready: false,
    unfinished: false,
    mainText: '',
    topGap: 0,
    round: ''
  },
  onInit() {
    useBackground(this);
    store = new Store(storeSystem(), templateKeys, (path) => this.$t(path));
    this.s = store.strings();
    unfinishedKind = '';
    loaded = false;
    onboarding = false;
    if (this.round === '') {
      // First page of the app: ask the shape once, then every page gets it in the router params.
      readRound((r) => {
        this.round = r;
        if (onboarding) {
          go(this, 'onboarding');
        } else if (loaded) {
          this.paint();
        }
      });
    }
    store.loadSettings((settings) => {
      if (!settings.onboardingAccepted) {
        onboarding = true;
        if (this.round !== '') {
          // Navigate after the current lifecycle callback has returned.
          setTimeout(() => go(this, 'onboarding'), 0);
        }
        return;
      }
      this.s = store.strings();
      loaded = true;
      this.paint();
      // An interrupted session saved with "End and save" goes to history here, not on the session page:
      // reading the history there would not fit next to the running session in the JS heap.
      store.readPending((pending) => {
        if (pending !== null && pending.status === 'interrupted') {
          appendRecord(store, pending, (ok) => {
            if (ok) {
              store.clearPending();
            }
            this.refresh(null);
          });
        } else {
          this.refresh(pending);
        }
      });
    });
  },
  onShow() {
    focusList(this, true);
  },
  refresh(pending) {
    if (pending !== null) {
      unfinishedKind = 'summary';
      this.paint();
      return;
    }
    store.readSnapshot((snap) => {
      unfinishedKind = snap !== null ? pageForStage(snap.stage) : '';
      this.paint();
    });
  },
  paint() {
    this.unfinished = unfinishedKind !== '';
    this.mainText = store.t(this.unfinished ? 'btn_resume' : 'btn_practice');
    // Title (64) and buttons (76 each), plus the warning line (46) and "Finish" when unfinished.
    var h = 64 + 3 * 76 + (this.unfinished ? 46 + 76 : 0);
    if (this.round === '') {
      return; // the shape is not known yet: nothing is drawn before the right layout
    }
    var round = this.round === '1';
    this.topGap = Math.max(round ? ROUND_TOP : 0, Math.floor(((round ? ROUND_H : SCREEN_H) - h) / 2));
    if (!this.ready) {
      // The list appears now: give it the crown (onShow found no list yet).
      this.ready = true;
      refocusList(this);
    }
  },
  /* "Practice", or "Continue" an unfinished one. */
  tapMain() {
    if (unfinishedKind === '') {
      var st = store.settings;
      // The emotion and its intensity first (pages/feel), then the session.
      // One length for every practice: there is no duration in Settings (a saved one is ignored).
      go(this, 'feel', store.sessionParams(DEFAULT_DURATION_MIN, st.defaultMode, st.defaultPattern, st.vibration));
    } else if (unfinishedKind === 'summary') {
      go(this, 'summary', { lang: store.lang });
    } else {
      go(this, unfinishedKind, { launch: 'resume', lang: store.lang });
    }
  },
  /* "Finish": drop the unfinished practice. */
  dropUnfinished() {
    store.discardAll();
    unfinishedKind = '';
    this.paint();
  },
  openHistory() {
    go(this, 'history');
  },
  openSettings() {
    go(this, 'settings');
  },
  /* Swipe back on the home screen closes the app. */
  onSwipe(e) {
    if (isBackSwipe(e)) {
      focusList(this, false);
      app.terminate();
    }
  }
};

/** cb('1' | '0'). The simulator reports 'rect' for any shape, so a square screen of 440+ px is round. */
function readRound(cb) {
  var done = false;
  function once(v) {
    if (!done) {
      done = true;
      cb(v);
    }
  }
  try {
    device.getInfo({
      success: function (info) {
        var w = info.windowWidth || 0;
        var h = info.windowHeight || 0;
        once(info.screenShape === 'circle' || (w === h && w >= 440) ? '1' : '0');
      },
      fail: function () {
        once('0');
      }
    });
  } catch (e) {
    once('0');
  }
}
