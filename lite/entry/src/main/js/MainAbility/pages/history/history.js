import router from '@system.router';

var LIMIT = 10;

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
    s: {},
    items: []
  },
  onInit() {
    var svc = this.$app.$def.services;
    this.s = svc.strings();
    var rows = svc.latest(LIMIT);
    var items = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var interrupted = r.status === 'interrupted';
      var status = svc.t(interrupted ? 'status_interrupted' : 'status_completed');
      if (interrupted && r.stoppedAt) {
        status = status + ' · ' + svc.fmt('history_stopped_at', svc.stageLabel(r.stoppedAt));
      }
      var before = r.emotionBefore ? svc.emotionLabel(r.emotionBefore) : svc.t('dash');
      var after = r.ratingAfter > 0 ? svc.fmt('fmt_rating', r.ratingAfter) : svc.t('dash');
      items.push({
        id: r.id,
        head: dateText(r.startedAt) + '  ' + svc.mmss(r.durationSec * 1000),
        mode: svc.modeLabel(r.mode),
        status: status,
        interrupted: interrupted,
        beforeAfter: svc.fmt('history_before', before) + '  ' + svc.fmt('history_after', after)
      });
    }
    this.items = items;
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
