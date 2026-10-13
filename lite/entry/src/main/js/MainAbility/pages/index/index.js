import router from '@system.router';
import { QUICK_START_DURATION_MIN, SessionMode } from '../../core/SessionTypes.js';
import { formatMmSs } from '../../core/Timing.js';
import { Store } from '../../common/store.js';
import { appendRecord, lastCompleted, loadHistory, todayCount } from '../../common/history.js';
import { pageForStage } from '../../common/stages.js';
import { storeSystem } from '../../common/system.js';
import templateKeys from '../../common/keys/index.js';

var store = null;
/** 'summary' | 'session' | 'prompt' | '' — the page "Continue" reopens. */
var unfinishedKind = '';

/* Screen 1: start, quick 3-min start (no watch-face cards on lite), last session, today count. */
export default {
  data: {
    s: {},
    unfinished: false,
    lastText: '',
    todayText: ''
  },
  onInit() {
    store = new Store(storeSystem(), templateKeys, (path) => this.$t(path));
    unfinishedKind = '';
    this.s = store.strings();
    store.loadSettings((settings) => {
      if (!settings.onboardingAccepted) {
        // Navigate after the current lifecycle callback has returned.
        setTimeout(() => router.replace({ uri: 'pages/onboarding/onboarding' }), 0);
        return;
      }
      this.s = store.strings();
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
  refresh(pending) {
    loadHistory(store, (history) => {
      var last = lastCompleted(history);
      this.lastText = last !== null
        ? store.fmt('home_last', formatMmSs(last.durationSec * 1000)) + ' · ' +
          store.label('pattern_', last.patternId, 'relax478')
        : store.t('home_last_none');
      this.todayText = store.fmt('home_today', todayCount(history, Date.now()));
      if (pending !== null) {
        unfinishedKind = 'summary';
        this.unfinished = true;
        return;
      }
      store.readSnapshot((snap) => {
        unfinishedKind = snap !== null ? pageForStage(snap.stage) : '';
        this.unfinished = snap !== null;
      });
    });
  },
  openSetup() {
    router.replace({ uri: 'pages/setup/setup' });
  },
  quickStart() {
    var st = store.settings;
    router.replace({
      uri: 'pages/session/session',
      params: store.sessionParams(QUICK_START_DURATION_MIN, SessionMode.QUICK, st.defaultPattern, st.vibration)
    });
  },
  resume() {
    if (unfinishedKind === 'summary') {
      router.replace({ uri: 'pages/summary/summary', params: { lang: store.lang } });
    } else if (unfinishedKind !== '') {
      router.replace({
        uri: 'pages/' + unfinishedKind + '/' + unfinishedKind,
        params: { launch: 'resume', lang: store.lang }
      });
    }
  },
  endUnfinished() {
    store.discardAll();
    unfinishedKind = '';
    this.unfinished = false;
  },
  openHistory() {
    router.replace({ uri: 'pages/history/history' });
  },
  openSettings() {
    router.replace({ uri: 'pages/settings/settings' });
  }
};
