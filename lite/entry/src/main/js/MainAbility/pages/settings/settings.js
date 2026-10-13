import router from '@system.router';
import prompt from '@system.prompt';
import { LANGUAGES } from '../../common/services.js';

/* Screen 10: language, default pattern / duration / mode, vibration, free rhythm, terms, delete history. */
export default {
  data: {
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
    this.render();
  },
  render() {
    var svc = this.$app.$def.services;
    var st = svc.settings;
    this.s = svc.strings();
    this.languageText = svc.languageLabel(st.language);
    this.patternText = svc.patternLabel(st.defaultPattern);
    this.durationText = svc.fmt('fmt_minutes', st.defaultDurationMin);
    this.modeText = svc.modeLabel(st.defaultMode);
    this.vibrationText = svc.onOff(st.vibration);
    this.inhaleText = svc.fmt('fmt_seconds', st.freeInhaleSec);
    this.exhaleText = svc.fmt('fmt_seconds', st.freeExhaleSec);
  },
  commit() {
    this.$app.$def.services.saveSettings();
    this.render();
  },
  nextLanguage() {
    var st = this.$app.$def.services.settings;
    st.language = LANGUAGES[(LANGUAGES.indexOf(st.language) + 1) % LANGUAGES.length];
    this.commit(); // applies immediately: the lite build uses its own dictionary
  },
  nextPattern() {
    var svc = this.$app.$def.services;
    var list = svc.patterns();
    svc.settings.defaultPattern = list[(list.indexOf(svc.settings.defaultPattern) + 1) % list.length];
    this.commit();
  },
  nextDuration() {
    var svc = this.$app.$def.services;
    var list = svc.durations();
    svc.settings.defaultDurationMin = list[(list.indexOf(svc.settings.defaultDurationMin) + 1) % list.length];
    this.commit();
  },
  toggleMode() {
    var st = this.$app.$def.services.settings;
    st.defaultMode = st.defaultMode === 'full' ? 'quick' : 'full';
    this.commit();
  },
  toggleVibration() {
    var st = this.$app.$def.services.settings;
    st.vibration = !st.vibration;
    this.commit();
  },
  changeFree(inhaleDelta, exhaleDelta) {
    var st = this.$app.$def.services.settings;
    st.freeInhaleSec = st.freeInhaleSec + inhaleDelta;
    st.freeExhaleSec = st.freeExhaleSec + exhaleDelta;
    this.commit(); // saveSettings() normalizes: 3-8 s / 4-12 s, at most 6 breaths per minute
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
    router.replace({ uri: 'pages/onboarding/onboarding', params: { readOnly: true } });
  },
  askDelete() {
    this.confirmDelete = true;
  },
  cancelDelete() {
    this.confirmDelete = false;
  },
  deleteAll() {
    var svc = this.$app.$def.services;
    this.confirmDelete = false;
    svc.deleteHistory((ok) => {
      prompt.showToast({ message: svc.t(ok ? 'deleted_toast' : 'save_failed'), duration: 2000 });
    });
  },
  back() {
    router.replace({ uri: 'pages/index/index' });
  },
  onSwipe(e) {
    if (e.direction !== 'right') {
      return;
    }
    if (this.confirmDelete) {
      this.confirmDelete = false;
    } else {
      this.back();
    }
  }
};
