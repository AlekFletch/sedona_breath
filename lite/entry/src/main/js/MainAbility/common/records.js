/*
 * Files that carry a session between pages: the controller snapshot (SnapshotSink) and the
 * record of a finished session waiting for the summary screen or the home screen.
 */
var SNAPSHOT_FILE = 'snapshot.json';
var PENDING_FILE = 'pending.json';
var PLAN_FILE = 'plan.json';

export function plainRecord(r) {
  return {
    id: r.id || 0, startedAt: r.startedAt, endedAt: r.endedAt, durationSec: r.durationSec, plannedMin: r.plannedMin,
    mode: r.mode, patternId: r.patternId, cycles: r.cycles, status: r.status, stoppedAt: r.stoppedAt,
    emotionBefore: r.emotionBefore, intensityBefore: typeof r.intensityBefore === 'number' ? r.intensityBefore : -1,
    intensityAfter: typeof r.intensityAfter === 'number' ? r.intensityAfter : -1, rounds: r.rounds || 1, heartRateAvg: 0
  };
}

/** @param files JsonFiles */
export function SessionFiles(files) {
  this.files = files;
}

SessionFiles.prototype.readSnapshot = function (cb) {
  this.files.read(SNAPSHOT_FILE, null, function (s) {
    cb(s && typeof s.stepIndex === 'number' ? s : null);
  });
};

/** SnapshotSink.save: called by SessionController on every interruption. cb(ok) is optional. */
SessionFiles.prototype.save = function (snapshot, cb) {
  this.files.write(SNAPSHOT_FILE, snapshot, cb);
};

/** SnapshotSink.clear. */
SessionFiles.prototype.clear = function () {
  this.files.remove(SNAPSHOT_FILE);
  this.files.remove(PLAN_FILE);
};

/** The session plan for pages/prompt (common/plan.js), written by pages/session. */
SessionFiles.prototype.writePlan = function (text, cb) {
  this.files.write(PLAN_FILE, text, cb);
};

/** cb(text), '' when there is none. */
SessionFiles.prototype.readPlan = function (cb) {
  this.files.read(PLAN_FILE, '', function (text) {
    cb(typeof text === 'string' ? text : '');
  });
};

/**
 * The record of a finished session on its way to history: the summary screen shows a
 * COMPLETED one and saves it; an INTERRUPTED one ("End and save") is saved by the home
 * screen. Written before the session page leaves, so nothing is lost if the app is killed.
 */
SessionFiles.prototype.writePending = function (record, cb) {
  this.files.write(PENDING_FILE, plainRecord(record), cb);
};

SessionFiles.prototype.readPending = function (cb) {
  this.files.read(PENDING_FILE, null, function (r) {
    cb(r && typeof r.startedAt === 'number' ? r : null);
  });
};

SessionFiles.prototype.clearPending = function () {
  this.files.remove(PENDING_FILE);
};

/** Drops the unfinished session and any record waiting on the summary screen ("End now"). */
SessionFiles.prototype.discardAll = function () {
  this.clear();
  this.clearPending();
};
