import vibrator from '@system.vibrator';
import file from '@system.file';
import battery from '@system.battery';
import brightness from '@system.brightness';
import configuration from '@system.configuration';
import { Services } from './common/services.js';

/* One Services instance for the whole app; pages reach it via this.$app.$def.services. */
var services = new Services({
  vibrator: vibrator,
  file: file,
  battery: battery,
  brightness: brightness,
  configuration: configuration,
  timers: {
    setTimeout: function (cb, ms) {
      return setTimeout(cb, ms);
    },
    clearTimeout: function (h) {
      clearTimeout(h);
    }
  }
});

export default {
  services: services,
  onCreate() {
    services.load();
  },
  onDestroy() {
    // The system is closing the app (swipe out, watch face, low memory): keep the progress.
    var c = services.activeSession();
    if (c !== null && !c.isEnded()) {
      c.interrupt();
    }
  }
};
