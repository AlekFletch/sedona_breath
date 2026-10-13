import router from '@system.router';
import prompt from '@system.prompt';

/* Screen 8: duration, cycles, mode, emotion before (if chosen), rating after (if given), "Save". */
export default {
  data: {
    s: {},
    lines: [],
    status: ''
  },
  onInit() {
    var svc = this.$app.$def.services;
    this.s = svc.strings();
    this.saving = false;
    var r = svc.prepareSummary();
    if (r === null) {
      setTimeout(() => router.replace({ uri: 'pages/index/index' }), 0);
      return;
    }
    var lines = [
      { label: svc.t('summary_duration'), value: svc.mmss(r.durationSec * 1000) },
      { label: svc.t('summary_cycles'), value: String(r.cycles) },
      { label: svc.t('summary_mode'), value: svc.modeLabel(r.mode) }
    ];
    if (r.emotionBefore !== '') {
      lines.push({ label: svc.t('summary_emotion'), value: svc.emotionLabel(r.emotionBefore) });
    }
    if (r.ratingAfter > 0) {
      lines.push({ label: svc.t('summary_rating'), value: svc.fmt('fmt_rating', r.ratingAfter) });
    }
    this.lines = lines;
  },
  save() {
    if (this.saving) {
      return;
    }
    this.saving = true;
    var svc = this.$app.$def.services;
    svc.saveCompleted((ok) => {
      this.saving = false;
      if (ok) {
        prompt.showToast({ message: svc.t('saved_toast'), duration: 2000 });
        router.replace({ uri: 'pages/index/index' });
      } else {
        this.status = svc.t('save_failed');
      }
    });
  }
};
