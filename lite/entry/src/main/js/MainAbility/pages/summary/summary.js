import router from '@system.router';
import file from '@system.file';
import { formatMmSs } from '../../core/Timing.js';
import { JsonFiles } from '../../common/adapters.js';
import { appendRecord } from '../../common/history.js';
import { SessionFiles } from '../../common/records.js';
import { Strings } from '../../common/strings.js';
import templateKeys from '../../common/keys/summary.js';

var strings = null;
var files = null;
var record = null;
var saving = false;

/*
 * Screen 8: duration, cycles, mode, emotion before (if chosen), rating after (if given), "Save".
 * The record comes from the session page through pending.json, so it survives an app restart.
 * Router param: lang. The page does not read settings.json: it opens while the session page is
 * still being freed, so it is kept small.
 */
export default {
  data: {
    lang: 'ru',
    s: {},
    lines: [],
    status: ''
  },
  onInit() {
    strings = new Strings(templateKeys, (path) => this.$t(path));
    strings.lang = this.lang;
    files = new SessionFiles(new JsonFiles(file));
    record = null;
    saving = false;
    this.s = strings.strings();
    files.readPending((r) => {
      if (r === null) {
        router.replace({ uri: 'pages/index/index' });
        return;
      }
      record = r;
      var lines = [
        { label: strings.t('summary_duration'), value: formatMmSs(r.durationSec * 1000) },
        { label: strings.t('summary_cycles'), value: String(r.cycles) },
        { label: strings.t('summary_mode'), value: strings.label('mode_', r.mode, 'full') }
      ];
      if (r.emotionBefore) {
        lines.push({ label: strings.t('summary_emotion'), value: strings.label('emotion_', r.emotionBefore, 'other') });
      }
      if (r.ratingAfter > 0) {
        lines.push({ label: strings.t('summary_rating'), value: strings.fmt('fmt_rating', r.ratingAfter) });
      }
      this.lines = lines;
    });
  },
  save() {
    if (saving || record === null) {
      return;
    }
    saving = true;
    appendRecord(files, record, (ok) => {
      saving = false;
      if (ok) {
        files.discardAll();
        // No toast here: showToast right before router.replace keeps the page from leaving on lite.
        router.replace({ uri: 'pages/index/index' });
      } else {
        this.status = strings.t('save_failed');
      }
    });
  }
};
