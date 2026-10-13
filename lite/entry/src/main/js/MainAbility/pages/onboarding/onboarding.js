import router from '@system.router';
import app from '@system.app';

/* Screen 11. readOnly=true when opened from Settings ("Terms of use"). */
export default {
  data: {
    s: {},
    readOnly: false,
    buttonText: ''
  },
  onInit() {
    var svc = this.$app.$def.services;
    this.s = svc.strings();
    this.buttonText = svc.t(this.readOnly ? 'btn_ok' : 'btn_accept');
  },
  accept() {
    var svc = this.$app.$def.services;
    if (this.readOnly) {
      router.replace({ uri: 'pages/settings/settings' });
      return;
    }
    svc.settings.onboardingAccepted = true;
    svc.saveSettings();
    router.replace({ uri: 'pages/index/index' });
  },
  onSwipe(e) {
    if (e.direction !== 'right') {
      return;
    }
    if (this.readOnly) {
      router.replace({ uri: 'pages/settings/settings' });
    } else {
      app.terminate(); // without consent the app cannot be used
    }
  }
};
