import { formatMmSs } from '../../core/Timing.js';
import { Store } from '../../common/store.js';
import { loadHistory } from '../../common/history.js';
import { storeSystem } from '../../common/system.js';
import { focusList, go, isBackSwipe, useBackground } from '../../common/ui.js';
import templateKeys from '../../common/keys/history.js';

var LIMIT = 10;
var store = null;

function pad(n) {
  return n < 10 ? '0' + n : String(n);
}

/* Numeric date/time (lite has no Intl): dd.mm hh:mm. */
function dateText(ms) {
  var d = new Date(ms);
  return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

/* Screen 9: date, duration, mode, status Completed / Interrupted, before / after. */
export default {
  data: {
    bg: '',
    s: {},
    items: []
  },
  onInit() {
    useBackground(this);
    store = new Store(storeSystem(), templateKeys, (path) => this.$t(path));
    this.s = store.strings();
    store.loadSettings(() => {
      this.s = store.strings();
      loadHistory(store, (history) => {
        var items = [];
        for (var i = 0; i < history.length && i < LIMIT; i++) {
          var r = history[i];
          var interrupted = r.status === 'interrupted';
          var status = store.t(interrupted ? 'status_interrupted' : 'status_completed');
          if (interrupted && r.stoppedAt) {
            status = status + ' · ' + store.fmt('history_stopped_at', store.label('stage_', r.stoppedAt, 'breathing'));
          }
          var before = r.emotionBefore ? store.label('emotion_', r.emotionBefore, 'other') : store.t('dash');
          var after = r.ratingAfter > 0 ? store.fmt('fmt_rating', r.ratingAfter) : store.t('dash');
          items.push({
            head: dateText(r.startedAt) + '  ' + formatMmSs(r.durationSec * 1000),
            mode: store.label('mode_', r.mode, 'full'),
            status: status,
            color: interrupted ? '#F2C27E' : '#8FE0B8',
            ba: store.fmt('history_before', before) + '  ' + store.fmt('history_after', after)
          });
        }
        this.items = items;
      });
    });
  },
  onShow() {
    focusList(this, true);
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
