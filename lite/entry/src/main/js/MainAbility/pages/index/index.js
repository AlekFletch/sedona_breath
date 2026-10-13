import router from '@system.router';

/* Screen 1: start, quick 3-min start (no watch-face cards on lite), last session, today count. */
export default {
  data: {
    s: {},
    unfinished: false,
    lastText: '',
    todayText: ''
  },
  onInit() {
    var svc = this.$app.$def.services;
    this.s = svc.strings();
    svc.whenReady(() => {
      if (!svc.settings.onboardingAccepted) {
        // Navigate after the current lifecycle callback has returned.
        setTimeout(() => router.replace({ uri: 'pages/onboarding/onboarding' }), 0);
        return;
      }
      this.s = svc.strings();
      this.refresh();
    });
  },
  refresh() {
    var svc = this.$app.$def.services;
    var last = svc.lastCompleted();
    this.lastText = last !== null
      ? svc.fmt('home_last', svc.mmss(last.durationSec * 1000)) + ' · ' + svc.patternLabel(last.patternId)
      : svc.t('home_last_none');
    this.todayText = svc.fmt('home_today', svc.todayCount());
    this.unfinished = svc.hasUnfinished();
  },
  openSetup() {
    router.replace({ uri: 'pages/setup/setup' });
  },
  quickStart() {
    this.$app.$def.services.startQuick();
    router.replace({ uri: 'pages/session/session' });
  },
  resume() {
    var svc = this.$app.$def.services;
    var c = svc.restoreSession();
    if (c === null) {
      this.refresh();
      return;
    }
    if (svc.isSummaryStage(c)) {
      svc.prepareSummary();
      router.replace({ uri: 'pages/summary/summary' });
    } else {
      router.replace({ uri: 'pages/session/session' });
    }
  },
  endUnfinished() {
    this.$app.$def.services.discard();
    this.refresh();
  },
  openHistory() {
    router.replace({ uri: 'pages/history/history' });
  },
  openSettings() {
    router.replace({ uri: 'pages/settings/settings' });
  }
};
