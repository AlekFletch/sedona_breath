/*
 * Session history in internal://app/history.json, newest first. Separate from store.js so the
 * session pages, which never read the history, do not bundle it.
 */
import { plainRecord } from './records.js';

var HISTORY_FILE = 'history.json';
/** ~250 bytes per record: the whole file is parsed into the small heap of the page that reads it. */
var MAX_HISTORY = 60;

/** `owner` is anything with `files` (JsonFiles): a Store or SessionFiles. cb(records). */
export function loadHistory(owner, cb) {
  owner.files.read(HISTORY_FILE, [], function (h) {
    cb(Array.isArray(h) ? h : []);
  });
}

/** Adds a record on top, keeps at most MAX_HISTORY. cb(ok). */
export function appendRecord(owner, record, cb) {
  loadHistory(owner, function (h) {
    var r = plainRecord(record);
    r.id = Date.now();
    h.unshift(r);
    if (h.length > MAX_HISTORY) {
      h.length = MAX_HISTORY;
    }
    owner.files.write(HISTORY_FILE, h, cb);
  });
}

export function deleteHistory(owner, cb) {
  owner.files.write(HISTORY_FILE, [], cb);
}

export function todayCount(history, now) {
  var from = startOfToday(now);
  var n = 0;
  for (var i = 0; i < history.length; i++) {
    if (history[i].startedAt >= from) {
      n++;
    }
  }
  return n;
}

export function lastCompleted(history) {
  for (var i = 0; i < history.length; i++) {
    if (history[i].status === 'completed') {
      return history[i];
    }
  }
  return null;
}

function startOfToday(now) {
  var d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
