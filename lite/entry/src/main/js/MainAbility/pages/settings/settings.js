import prompt from '@system.prompt';
import { ALL_PATTERNS, FreeRhythm } from '../../core/BreathPattern.js';
import { LANGUAGES, Store } from '../../common/store.js';
import { deleteHistory } from '../../common/history.js';
import { storeSystem } from '../../common/system.js';
import { focusList, go, isBackSwipe, refocusList, useBackground } from '../../common/ui.js';
import templateKeys from '../../common/keys/settings.js';

var store = null;
/** Settings changed on this page and not written yet: settings.json is written once, on leaving. */
var dirty = false;
var shownLanguage = '';
var ON = '#F2EEDD';
var OFF = '#4F7564';

function next(list, value) {
  return list[(list.indexOf(value) + 1) % list.length];
}

/*
 * Screen 10: everything "Practice" on the home screen starts with: mode, breathing, vibration, free
 * rhythm; language, terms, delete history. No duration: the practice has one length (index.js).
 */
export default {
  data: {
    round: '',
    bg: '',
    s: {},
    confirmDelete: false,
    languageText: '',
    patternText: '',
    modeText: '',
    vibrationText: '',
    inhaleText: '',
    exhaleText: '',
    inMinus: ON,
    inPlus: ON,
    exMinus: ON,
    exPlus: ON
  },
  onInit() {
    useBackground(this);
    store = new Store(storeSystem(), templateKeys, (path) => this.$t(path));
    dirty = false;
    this.s = store.strings();
    shownLanguage = store.lang;
    store.loadSettings(() => this.paint());
  },
  onShow() {
    focusList(this, true);
  },
  onDestroy() {
    if (dirty) {
      dirty = false;
      store.saveSettings();
    }
  },
  /* A tap must answer at once: only the language rebuilds every text of the page (~3 s on the
     review watches with a file write per tap, AppGallery 1.0.0 report). */
  paint() {
    var st = store.settings;
    if (store.lang !== shownLanguage) {
      shownLanguage = store.lang;
      this.s = store.strings();
    }
    this.languageText = store.label('lang_', st.language, 'system');
    this.patternText = store.label('pattern_', st.defaultPattern, 'relax478');
    this.modeText = store.label('mode_', st.defaultMode, 'full');
    this.vibrationText = store.t(st.vibration ? 'on' : 'off');
    this.inhaleText = store.fmt('fmt_seconds', st.freeInhaleSec);
    this.exhaleText = store.fmt('fmt_seconds', st.freeExhaleSec);
    // At a limit the button dims instead of silently doing nothing.
    this.inMinus = st.freeInhaleSec > FreeRhythm.INHALE_MIN ? ON : OFF;
    this.inPlus = st.freeInhaleSec < FreeRhythm.INHALE_MAX ? ON : OFF;
    this.exMinus = st.freeExhaleSec > FreeRhythm.EXHALE_MIN ? ON : OFF;
    this.exPlus = st.freeExhaleSec < FreeRhythm.EXHALE_MAX ? ON : OFF;
  },
  /* Writes the changed settings, then leaves: a write callback that arrives after router.replace
     keeps the old page in the heap next to the new one (found in BreathTrainer). */
  leave(page, params) {
    if (!dirty) {
      go(this, page, params);
      return;
    }
    dirty = false;
    store.saveSettings(() => go(this, page, params));
  },
  /* applySettings() normalizes (free rhythm: inhale 4-8 s, exhale 6-12 s, independent) and applies
     the language at once: the lite build uses its own dictionary. */
  commit() {
    store.applySettings();
    dirty = true;
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
    this.leave('onboarding', { readOnly: true });
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
    this.leave('index');
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
