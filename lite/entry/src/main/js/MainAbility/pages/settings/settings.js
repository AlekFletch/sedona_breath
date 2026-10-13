import prompt from '@system.prompt';
import { ALL_PATTERNS } from '../../core/BreathPattern.js';
import { DURATIONS_MIN } from '../../core/SessionTypes.js';
import { LANGUAGES, Store } from '../../common/store.js';
import { deleteHistory } from '../../common/history.js';
import { storeSystem } from '../../common/system.js';
import { focusList, go, isBackSwipe, refocusList, useBackground } from '../../common/ui.js';
import templateKeys from '../../common/keys/settings.js';

var store = null;

function next(list, value) {
  return list[(list.indexOf(value) + 1) % list.length];
}

/* Screen 10: language, default pattern / duration / mode, vibration, free rhythm, terms, delete history. */
export default {
  data: {
    bg: '',
    s: {},
    confirmDelete: false,
    languageText: '',
    patternText: '',
    durationText: '',
    modeText: '',
    vibrationText: '',
    inhaleText: '',
    exhaleText: ''
  },
  onInit() {
    useBackground(this);
    store = new Store(storeSystem(), templateKeys, (path) => this.$t(path));
    this.s = store.strings();
    store.loadSettings(() => this.paint());
  },
  onShow() {
    focusList(this, true);
  },
  paint() {
    var st = store.settings;
    this.s = store.strings();
    this.languageText = store.label('lang_', st.language, 'system');
    this.patternText = store.label('pattern_', st.defaultPattern, 'relax478');
    this.durationText = store.fmt('fmt_minutes', st.defaultDurationMin);
    this.modeText = store.label('mode_', st.defaultMode, 'full');
    this.vibrationText = store.t(st.vibration ? 'on' : 'off');
    this.inhaleText = store.fmt('fmt_seconds', st.freeInhaleSec);
    this.exhaleText = store.fmt('fmt_seconds', st.freeExhaleSec);
  },
  /* saveSettings() normalizes (free rhythm: 3-8 s / 4-12 s, at most 6 breaths per minute) and applies
     the language at once: the lite build uses its own dictionary. */
  commit() {
    store.saveSettings();
    this.paint();
  },
  nextLanguage() {
    store.settings.language = next(LANGUAGES, store.settings.language);
    this.commit();
  },
  nextPattern() {
    store.settings.defaultPattern = next(ALL_PATTERNS, store.settings.defaultPattern);
    this.commit();
  },
  nextDuration() {
    store.settings.defaultDurationMin = next(DURATIONS_MIN, store.settings.defaultDurationMin);
    this.commit();
  },
  toggleMode() {
    store.settings.defaultMode = store.settings.defaultMode === 'full' ? 'quick' : 'full';
    this.commit();
  },
  toggleVibration() {
    store.settings.vibration = !store.settings.vibration;
    this.commit();
  },
  changeFree(inhaleDelta, exhaleDelta) {
    store.settings.freeInhaleSec += inhaleDelta;
    store.settings.freeExhaleSec += exhaleDelta;
    this.commit();
  },
  inhaleMinus() {
    this.changeFree(-1, 0);
  },
  inhalePlus() {
    this.changeFree(1, 0);
  },
  exhaleMinus() {
    this.changeFree(0, -1);
  },
  exhalePlus() {
    this.changeFree(0, 1);
  },
  openTerms() {
    go(this, 'onboarding', { readOnly: true });
  },
  /* The two lists swap: release the crown before one goes away (see ui.focusList). */
  setConfirm(on) {
    focusList(this, false);
    this.confirmDelete = on;
    refocusList(this);
  },
  askDelete() {
    this.setConfirm(true);
  },
  cancelDelete() {
    this.setConfirm(false);
  },
  deleteAll() {
    this.setConfirm(false);
    deleteHistory(store, (ok) => {
      prompt.showToast({ message: store.t(ok ? 'deleted_toast' : 'save_failed'), duration: 2000 });
    });
  },
  back() {
    go(this, 'index');
  },
  onSwipe(e) {
    if (!isBackSwipe(e)) {
      return;
    }
    if (this.confirmDelete) {
      this.cancelDelete();
    } else {
      this.back();
    }
  }
};
