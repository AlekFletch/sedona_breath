import { ALL_PATTERNS } from '../../core/BreathPattern.js';
import { DURATIONS_MIN } from '../../core/SessionTypes.js';
import { Store } from '../../common/store.js';
import { storeSystem } from '../../common/system.js';
import { focusList, go, isBackSwipe, useBackground } from '../../common/ui.js';
import templateKeys from '../../common/keys/setup.js';

var store = null;

function next(list, value) {
  return list[(list.indexOf(value) + 1) % list.length];
}

/* Screen 2: duration, mode, breathing pattern, vibration. */
export default {
  data: {
    bg: '',
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
    useBackground(this);
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
  onShow() {
    focusList(this, true);
  },
  paint() {
    this.durationText = store.fmt('fmt_minutes', this.duration);
    this.modeText = store.label('mode_', this.mode, 'full');
    this.patternText = store.label('pattern_', this.pattern, 'relax478');
    this.vibrationText = store.t(this.vibration ? 'on' : 'off');
  },
  nextDuration() {
    this.duration = next(DURATIONS_MIN, this.duration);
    this.paint();
  },
  toggleMode() {
    this.mode = this.mode === 'full' ? 'quick' : 'full';
    this.paint();
  },
  nextPattern() {
    this.pattern = next(ALL_PATTERNS, this.pattern);
    this.paint();
  },
  toggleVibration() {
    this.vibration = !this.vibration;
    this.paint();
  },
  start() {
    go(this, 'session', store.sessionParams(this.duration, this.mode, this.pattern, this.vibration));
  },
  back() {
    go(this, 'index');
  },
  onSwipe(e) {
    if (isBackSwipe(e)) {
      this.back();
    }
  }
};
