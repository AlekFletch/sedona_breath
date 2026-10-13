import router from '@system.router';
import { ALL_PATTERNS } from '../../core/BreathPattern.js';
import { DURATIONS_MIN } from '../../core/SessionTypes.js';
import { Store } from '../../common/store.js';
import { storeSystem } from '../../common/system.js';
import templateKeys from '../../common/keys/setup.js';

var store = null;

/* Screen 2: duration, mode, breathing pattern, vibration. */
export default {
  data: {
    s: {},
    duration: 3,
    mode: 'full',
    pattern: 'relax478',
    vibration: true,
    durationText: '',
    modeText: '',
    patternText: '',
    vibrationText: ''
  },
  onInit() {
    store = new Store(storeSystem(), templateKeys, (path) => this.$t(path));
    this.s = store.strings();
    store.loadSettings((st) => {
      this.s = store.strings();
      this.duration = st.defaultDurationMin;
      this.mode = st.defaultMode;
      this.pattern = st.defaultPattern;
      this.vibration = st.vibration;
      this.paint();
    });
  },
  paint() {
    this.durationText = store.fmt('fmt_minutes', this.duration);
    this.modeText = store.label('mode_', this.mode, 'full');
    this.patternText = store.label('pattern_', this.pattern, 'relax478');
    this.vibrationText = store.t(this.vibration ? 'on' : 'off');
  },
  nextDuration() {
    this.duration = DURATIONS_MIN[(DURATIONS_MIN.indexOf(this.duration) + 1) % DURATIONS_MIN.length];
    this.paint();
  },
  toggleMode() {
    this.mode = this.mode === 'full' ? 'quick' : 'full';
    this.paint();
  },
  nextPattern() {
    this.pattern = ALL_PATTERNS[(ALL_PATTERNS.indexOf(this.pattern) + 1) % ALL_PATTERNS.length];
    this.paint();
  },
  toggleVibration() {
    this.vibration = !this.vibration;
    this.paint();
  },
  start() {
    router.replace({
      uri: 'pages/session/session',
      params: store.sessionParams(this.duration, this.mode, this.pattern, this.vibration)
    });
  },
  back() {
    router.replace({ uri: 'pages/index/index' });
  },
  onSwipe(e) {
    if (e.direction === 'right') {
      this.back();
    }
  }
};
