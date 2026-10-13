import app from '@system.app';
import { QUICK_START_DURATION_MIN, SessionMode } from '../../core/SessionTypes.js';
import { formatMmSs } from '../../core/Timing.js';
import { Store } from '../../common/store.js';
import { appendRecord, lastCompleted, loadHistory, todayCount } from '../../common/history.js';
import { pageForStage } from '../../common/stages.js';
import { storeSystem } from '../../common/system.js';
import { focusList, go, isBackSwipe, useBackground } from '../../common/ui.js';
import templateKeys from '../../common/keys/index.js';

var store = null;
/** 'summary' | 'session' | 'prompt' | '' — the page "Continue" reopens. */
var unfinishedKind = '';

/* Screen 1: start, quick 3-min start (no watch-face cards on lite), last session, today count. */
export default {
  data: {
    bg: '',
    s: {},
    unfinished: false,
    mainText: '',
    secondText: '',
    lastText: '',
    todayText: ''
  },
  onInit() {
    useBackground(this);
    store = new Store(storeSystem(), templateKeys, (path) => this.$t(path));
    this.s = store.strings();
    unfinishedKind = '';
    store.loadSettings((settings) => {
      if (!settings.onboardingAccepted) {
        // Navigate after the current lifecycle callback has returned.
        setTimeout(() => go(this, 'onboarding'), 0);
        return;
      }
      this.s = store.strings();
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
    loadHistory(store, (history) => {
      var last = lastCompleted(history);
      this.todayText = store.fmt('home_today', todayCount(history, Date.now()));
      this.lastText = last !== null
        ? store.fmt('home_last', formatMmSs(last.durationSec * 1000)) + ' · ' +
          store.label('pattern_', last.patternId, 'relax478')
        : store.t('home_last_none');
      if (pending !== null) {
        unfinishedKind = 'summary';
        this.paint();
        return;
      }
      store.readSnapshot((snap) => {
        unfinishedKind = snap !== null ? pageForStage(snap.stage) : '';
        this.paint();
      });
    });
  },
  paint() {
    this.unfinished = unfinishedKind !== '';
    this.mainText = store.t(this.unfinished ? 'btn_resume' : 'btn_start_practice');
    this.secondText = store.t(this.unfinished ? 'btn_finish' : 'home_quick');
  },
  /* "Start practice", or "Continue" an unfinished one. */
  tapMain() {
    if (unfinishedKind === '') {
      go(this, 'setup');
    } else if (unfinishedKind === 'summary') {
      go(this, 'summary', { lang: store.lang });
    } else {
      go(this, unfinishedKind, { launch: 'resume', lang: store.lang });
    }
  },
  /* "Quick · 3 min", or "Finish" (drop) an unfinished one. */
  tapSecond() {
    if (unfinishedKind === '') {
      var st = store.settings;
      go(this, 'session', store.sessionParams(QUICK_START_DURATION_MIN, SessionMode.QUICK, st.defaultPattern, st.vibration));
    } else {
      store.discardAll();
      unfinishedKind = '';
      this.paint();
    }
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
