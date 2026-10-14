import app from '@system.app';
import { Store } from '../../common/store.js';
import { storeSystem } from '../../common/system.js';
import { textHeight, wrap } from '../../common/textSize.js';
import { focusList, go, isBackSwipe, useBackground } from '../../common/ui.js';
import templateKeys from '../../common/keys/onboarding.js';

var store = null;
var step = 0;
var LAST_STEP = 3;

/*
 * Screen 11 in short steps, one or two texts each: what the practice is, disclaimer, safety,
 * consent. readOnly=true when opened from Settings ("Terms of use").
 */
export default {
  data: {
    bg: '',
    readOnly: false,
    head: '',
    t1: '',
    h1: 34,
    r1: 44,
    t2: '',
    h2: 34,
    r2: 44,
    buttonText: ''
  },
  onInit() {
    useBackground(this);
    step = 0;
    store = new Store(storeSystem(), templateKeys, (path) => this.$t(path));
    store.loadSettings(() => this.paint());
  },
  onShow() {
    focusList(this, true);
  },
  paint() {
    var head = '';
    var t1 = '';
    var t2 = '';
    if (step === 0) {
      head = store.t('app_name');
      t1 = store.t('onb_1');
      t2 = store.t('onb_2');
    } else if (step === 1) {
      head = store.t('onb_disclaimer_title');
      t1 = store.t('onb_disclaimer');
    } else if (step === 2) {
      t1 = store.t('onb_safety');
    } else if (!this.readOnly) {
      t1 = store.t('onb_consent');
    }
    this.head = head;
    t1 = wrap(t1, false);
    t2 = wrap(t2, false);
    this.h1 = textHeight(t1, false);
    this.r1 = this.h1 + 10;
    this.t1 = t1;
    this.h2 = textHeight(t2, false);
    this.r2 = this.h2 + 10;
    this.t2 = t2;
    this.buttonText = store.t(step < LAST_STEP ? 'btn_next' : (this.readOnly ? 'btn_ok' : 'btn_accept'));
  },
  next() {
    if (step < LAST_STEP) {
      step++;
      this.paint();
      return;
    }
    if (this.readOnly) {
      go(this, 'settings');
      return;
    }
    store.settings.onboardingAccepted = true;
    store.saveSettings(() => go(this, 'index'));
  },
  onSwipe(e) {
    if (!isBackSwipe(e)) {
      return;
    }
    if (step > 0) {
      step--;
      this.paint();
    } else if (this.readOnly) {
      go(this, 'settings');
    } else {
      focusList(this, false);
      app.terminate(); // without consent the app cannot be used
    }
  }
};
