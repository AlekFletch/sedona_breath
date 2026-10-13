import router from '@system.router';

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
    var svc = this.$app.$def.services;
    this.s = svc.strings();
    this.duration = svc.settings.defaultDurationMin;
    this.mode = svc.settings.defaultMode;
    this.pattern = svc.settings.defaultPattern;
    this.vibration = svc.settings.vibration;
    this.render();
  },
  render() {
    var svc = this.$app.$def.services;
    this.durationText = svc.fmt('fmt_minutes', this.duration);
    this.modeText = svc.modeLabel(this.mode);
    this.patternText = svc.patternLabel(this.pattern);
    this.vibrationText = svc.onOff(this.vibration);
  },
  nextDuration() {
    var list = this.$app.$def.services.durations();
    this.duration = list[(list.indexOf(this.duration) + 1) % list.length];
    this.render();
  },
  toggleMode() {
    this.mode = this.mode === 'full' ? 'quick' : 'full';
    this.render();
  },
  nextPattern() {
    var list = this.$app.$def.services.patterns();
    this.pattern = list[(list.indexOf(this.pattern) + 1) % list.length];
    this.render();
  },
  toggleVibration() {
    this.vibration = !this.vibration;
    this.render();
  },
  start() {
    var svc = this.$app.$def.services;
    svc.startSession(svc.config(this.duration, this.mode, this.pattern, this.vibration));
    router.replace({ uri: 'pages/session/session' });
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
