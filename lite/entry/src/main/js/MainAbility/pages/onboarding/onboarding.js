import router from '@system.router';
import app from '@system.app';
import { Store } from '../../common/store.js';
import { storeSystem } from '../../common/system.js';
import templateKeys from '../../i18n/onboarding.js';

var store = null;

/* Screen 11. readOnly=true when opened from Settings ("Terms of use"). */
export default {
  data: {
    s: {},
    readOnly: false,
    buttonText: ''
  },
  onInit() {
    store = new Store(storeSystem(), templateKeys, (path) => this.$t(path));
    this.paint();
    store.loadSettings(() => this.paint());
  },
  /* Texts are set before the settings load too: a text that starts empty may stay unpainted. */
  paint() {
    this.s = store.strings();
    this.buttonText = store.t(this.readOnly ? 'btn_ok' : 'btn_accept');
  },
  accept() {
    if (this.readOnly) {
      router.replace({ uri: 'pages/settings/settings' });
      return;
    }
    store.settings.onboardingAccepted = true;
    store.saveSettings(() => {
      router.replace({ uri: 'pages/index/index' });
    });
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
