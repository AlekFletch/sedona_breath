import router from '@system.router';

/*
 * A blank page the session goes through between pages/session and pages/prompt. router.replace
 * loads the next page before it frees the current one, and the bytecode of both session pages
 * does not fit the JS heap together; this page is tiny, so each step holds one big page only.
 * Router params: to = 'session' | 'prompt', the rest is passed on as is (see common/sessionPage.js).
 * It stays loaded while pages/session loads, so it does not even import common/ui.js (BG there) and the background is static in hop.hml.
 */
export default {
  data: {
    to: '',
    launch: '',
    lang: 'ru',
    notNow: ''
  },
  onShow() {
    var to = this.to === 'prompt' ? 'prompt' : 'session';
    var params = { launch: this.launch, lang: this.lang, notNow: this.notNow };
    setTimeout(function () {
      router.replace({ uri: 'pages/' + to + '/' + to, params: params });
    }, 0);
  }
};
