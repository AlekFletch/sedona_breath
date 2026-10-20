import router from '@system.router';

/*
 * A blank page between two big pages: pages/session <-> pages/prompt, and pages/feel -> pages/session.
 * router.replace loads the next page before it frees the current one, and the bytecode of both does
 * not fit the JS heap together; this page is tiny, so each step holds one big page only.
 * Router params: to = 'session' | 'prompt', the rest is passed on as is (see common/sessionPage.js).
 * It stays loaded while the next page loads, so it does not even import common/ui.js (BG there) and
 * the background is static in hop.hml.
 */
var PASSED = ['launch', 'lang', 'notNow', 'durationMin', 'mode', 'patternId', 'vibration', 'freeIn', 'freeEx',
  'emotion', 'intensity', 'round'];

export default {
  data: {
    to: '',
    launch: '',
    lang: 'ru',
    notNow: '',
    durationMin: '',
    mode: '',
    patternId: '',
    vibration: '',
    freeIn: '',
    freeEx: '',
    emotion: '',
    intensity: '',
    round: ''
  },
  onShow() {
    var to = this.to === 'prompt' ? 'prompt' : 'session';
    var params = {};
    for (var i = 0; i < PASSED.length; i++) {
      params[PASSED[i]] = this[PASSED[i]];
    }
    setTimeout(function () {
      router.replace({ uri: 'pages/' + to + '/' + to, params: params });
    }, 0);
  }
};
