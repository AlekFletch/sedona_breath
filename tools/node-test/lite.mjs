// Tests for the lite-wearable (Watch Fit) build under Node: generated core + common/*.js with
// fake @system modules and a manual clock. Pages need the lite runtime; they were checked in
// the DevEco lite simulator (see lite/README.md) and are covered by the manual test plan.
//
// Usage: node tools/node-test/lite.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = path.join(root, 'lite/entry/src/main/js/MainAbility');

// 0. Generated files must be in sync with the ArkTS sources (and contain no RegExp).
try {
  execFileSync(process.execPath, [path.join(root, 'tools/build-lite.mjs'), '--check'], { stdio: 'pipe' });
} catch (e) {
  console.log(String(e.stdout));
  console.log('FAIL generated lite files are out of date or use RegExp');
  process.exit(1);
}

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'sedona-lite-'));
fs.writeFileSync(path.join(out, 'package.json'), '{ "type": "module" }');
for (const dir of ['core', 'common', 'i18n']) fs.cpSync(path.join(src, dir), path.join(out, dir), { recursive: true });
// common/system.js and sessionPage.js import @system modules: only the pure modules are loaded here.
const load = async (rel) => import(pathToFileURL(path.join(out, rel)).href);
const A = await load('common/adapters.js');
const { Strings } = await load('common/strings.js');
const { Store, mergeSettings, resolveLanguage } = await load('common/store.js');
const { SessionFiles } = await load('common/records.js');
const H = await load('common/history.js');
const { PromptFlow } = await load('common/promptFlow.js');
const { planOf } = await load('common/plan.js');
const { BreathFlow, circleScale } = await load('common/breathFlow.js');
const { pageForStage } = await load('common/stages.js');
const { wrap, textHeight } = await load('common/textSize.js');
const { ManualTime } = await load('core/ManualTime.js');
const { BreathVisual, SessionConfig, SessionController } = await load('core/SessionController.js');
const { FreeRhythm } = await load('core/BreathPattern.js');
const i18n = JSON.parse(fs.readFileSync(path.join(src, 'i18n/ru-RU.json'), 'utf8'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${name}: ${e.message}`);
  }
}
function eq(a, b, msg = '') {
  if (a !== b) throw new Error(`${msg} expected ${JSON.stringify(b)} but got ${JSON.stringify(a)}`);
}
function ok(v, msg = 'expected true') {
  if (!v) throw new Error(msg);
}

/** The runtime's $t over i18n/*.json: a missing path comes back as the path itself. */
function $t(p) {
  const [lang, key] = p.split('.');
  return i18n[lang] && i18n[lang][key] !== undefined ? i18n[lang][key] : p;
}

/** Fake @system.file over an in-memory map, with position/length chunked reads. */
function fakeFile(files) {
  return {
    readText: (o) => {
      if (!(o.uri in files)) {
        o.fail('nofile', 301);
        return;
      }
      const text = files[o.uri];
      const from = o.position || 0;
      o.success({ text: o.length ? text.slice(from, from + o.length) : text.slice(from) });
    },
    writeText: (o) => { files[o.uri] = o.text; o.success(); },
    delete: (o) => { delete files[o.uri]; o.success(); }
  };
}

function store(opts = {}) {
  const files = opts.files || {};
  const sys = {
    file: fakeFile(files),
    configuration: { getLocale: () => ({ language: opts.lang || 'ru', countryOrRegion: 'RU', dir: 'ltr' }) }
  };
  return { st: new Store(sys, opts.keys || [], $t), files };
}

function sessionFiles(files = {}) {
  return { sf: new SessionFiles(new A.JsonFiles(fakeFile(files))), files };
}

function controller(mode, durationMin, vibration, sink, time, vib = [], preset = false) {
  const config = new SessionConfig();
  if (preset) {
    // As on the watch: the emotion and its intensity come from pages/feel.
    config.presetEmotion = true;
    config.emotion = 'anger';
    config.intensityBefore = 4;
  }
  config.durationMin = durationMin;
  config.mode = mode;
  config.patternId = 'relax478';
  config.free = new FreeRhythm(4, 6);
  config.vibration = vibration;
  const haptics = new A.LiteHaptics({ vibrate: (o) => vib.push(`${time.now()}:${o.mode}`) });
  const c = new SessionController(config, time, time, haptics, sink, () => 1_700_000_000_000 + time.now());
  c.setMessageSeed(7);
  return c;
}

/** Drives a controller to its next non-breathing stage. */
function breatheThrough(time, c) {
  time.advance(c.remainingMs() + 20 * 60000);
}

console.log('lite adapters');
test('languageResolution', () => {
  eq(resolveLanguage('system', 'en'), 'en');
  eq(resolveLanguage('system', 'es-ES'), 'es');
  eq(resolveLanguage('system', 'de'), 'ru');
  eq(resolveLanguage('system', ''), 'ru');
  eq(resolveLanguage('en', 'ru'), 'en');
});
test('formatString', () => {
  eq(A.formatString('Вопрос %d из %d', [2, 5]), 'Вопрос 2 из 5');
  eq(A.formatString('%2$s/%1$s', ['a', 'b']), 'b/a');
  eq(A.formatString('100% · %s', ['x']), '100% · x');
  eq(A.formatString('%d и %d', [1]), '1 и %d');
  eq(A.formatString('%', []), '%');
});
test('hapticsMapping', () => {
  const calls = [];
  const h = new A.LiteHaptics({ vibrate: (o) => calls.push(o.mode) });
  h.pulse(50);
  h.pulse(800);
  h.stop();
  eq(calls.join(','), 'short,long');
});
test('jsonFilesChunkedRead', () => {
  const files = {};
  const jf = new A.JsonFiles(fakeFile(files));
  const big = Array.from({ length: 900 }, (_, i) => ({ i, s: 'abcdef' }));
  let back = null;
  jf.write('big.json', big, () => {});
  ok(files['internal://app/big.json'].length > 3 * A.READ_CHUNK, 'test data must span several chunks');
  jf.read('big.json', null, (v) => { back = v; });
  eq(back.length, 900);
  eq(back[899].i, 899);
});

console.log('lite strings and settings');
test('stringsLookupAndFallback', () => {
  const s = new Strings(['btn_resume', 'q_1'], $t);
  eq(s.t('q_2'), 'Смог бы я позволить этому чувству быть?');
  eq(s.fmt('question_counter', 1, 5), 'Вопрос 1 из 5');
  s.lang = 'es';
  eq(s.t('q_5'), '¿Cuándo?');
  eq(s.fmt('question_counter', 2, 5), 'Pregunta 2 de 5');
  eq(s.label('pattern_', 'box4444', 'relax478'), i18n.es.pattern_box4444);
  eq(s.label('pattern_', 'unknown', 'relax478'), i18n.es.pattern_relax478);
  eq(s.t('no_such_key'), 'no_such_key');
  eq(Object.keys(s.strings()).join(','), 'btn_resume,q_1');
});
test('everyLiteKeyInAllLanguages', () => {
  for (const lang of ['ru', 'en', 'es']) {
    eq(Object.keys(i18n[lang]).length, Object.keys(i18n.ru).length, lang);
  }
  for (const f of fs.readdirSync(path.join(src, 'common/keys'))) {
    const text = fs.readFileSync(path.join(src, 'common/keys', f), 'utf8');
    const keys = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1));
    for (const k of keys) ok(i18n.ru[k] !== undefined, `${f}: ${k} missing in i18n json`);
  }
});
test('defaultsAndSystemLanguage', () => {
  const { st } = store({ lang: 'en' });
  let s = null;
  st.loadSettings((v) => { s = v; });
  eq(s.onboardingAccepted, false);
  eq(s.defaultPattern, 'relax478');
  eq(st.lang, 'en');
  eq(st.t('q_1'), 'What am I feeling right now?');
});
test('settingsPersistNormalizeAndParams', () => {
  const d1 = store();
  d1.st.loadSettings(() => {});
  d1.st.settings.onboardingAccepted = true;
  d1.st.settings.language = 'es';
  d1.st.settings.freeInhaleSec = 3;
  d1.st.settings.freeExhaleSec = 4; // 7 s cycle would exceed 6 breaths/min
  d1.st.saveSettings();
  const d2 = store({ files: d1.files });
  d2.st.loadSettings(() => {});
  eq(d2.st.settings.onboardingAccepted, true);
  eq(d2.st.lang, 'es');
  eq(d2.st.settings.freeInhaleSec + d2.st.settings.freeExhaleSec, 10);
  const p = d2.st.sessionParams(5, 'full', 'calm46', false);
  eq(JSON.stringify(p), JSON.stringify({
    launch: 'new', lang: 'es', durationMin: '5', mode: 'full', patternId: 'calm46', vibration: '0',
    freeIn: String(d2.st.settings.freeInhaleSec), freeEx: String(d2.st.settings.freeExhaleSec)
  }));
});
test('corruptFilesFallBack', () => {
  const { st } = store({ files: { 'internal://app/settings.json': '{oops', 'internal://app/history.json': '"x"' } });
  st.loadSettings(() => {});
  eq(st.settings.language, 'system');
  let h = null;
  H.loadHistory(st, (v) => { h = v; });
  eq(h.length, 0);
  eq(mergeSettings({ defaultDurationMin: 99, defaultMode: 'x' }).defaultDurationMin, 3);
});

test('wrapBreaksBetweenWordsOnly', () => {
  for (const big of [true, false]) {
    for (const lang of Object.keys(i18n)) {
      for (const text of Object.values(i18n[lang])) {
        const w = wrap(text, big);
        eq(w.split('\n').join(' '), text, 'only spaces become line breaks');
        for (const line of w.split('\n')) {
          ok(line.length <= (big ? 19 : 24) || !line.includes(' '), `line too long: ${line}`);
        }
        eq(textHeight(w, big), w.split('\n').length * (big ? 46 : 38));
      }
    }
  }
  eq(wrap('Смог бы я позволить этому чувству быть?', true), 'Смог бы я позволить\nэтому чувству быть?');
  eq(textHeight('', false), 38, 'an empty text keeps one line');
});

console.log('lite history');
test('appendTodayLastDelete', () => {
  const { sf, files } = sessionFiles();
  const now = Date.now();
  H.appendRecord(sf, { startedAt: now - 1000, durationSec: 60, status: 'interrupted', stoppedAt: 'question' }, () => {});
  H.appendRecord(sf, { startedAt: now, durationSec: 180, status: 'completed', patternId: 'calm46' }, () => {});
  let h = null;
  H.loadHistory(sf, (v) => { h = v; });
  eq(h.length, 2);
  eq(h[0].status, 'completed', 'newest first');
  eq(H.todayCount(h, now), 2);
  eq(H.todayCount(h, now + 2 * 86400000), 0);
  eq(H.lastCompleted(h).patternId, 'calm46');
  H.deleteHistory(sf, () => {});
  eq(files['internal://app/history.json'], '[]');
});
test('historyIsCapped', () => {
  const { sf } = sessionFiles();
  for (let i = 0; i < 70; i++) H.appendRecord(sf, { startedAt: i, status: 'completed' }, () => {});
  let h = null;
  H.loadHistory(sf, (v) => { h = v; });
  eq(h.length, 60);
  eq(h[0].startedAt, 69);
});

console.log('lite session');
test('vibrationTimingOnTheWatchDriver', () => {
  const time = new ManualTime();
  const vib = [];
  const { sf } = sessionFiles();
  const c = controller('full', 2, true, sf, time, vib);
  c.start();
  c.finishIntro();
  c.skipEmotion();
  c.rateBefore(3);
  const t0 = time.now();
  // First inhale of 4-7-8: 9 short ticks, then 6 single + double on the hold.
  time.advance(11000);
  const ticks = vib.filter((v) => v.endsWith('short')).map((v) => Number(v.split(':')[0]) - t0);
  eq(ticks.slice(0, 9).join(','), '0,333,667,1000,1333,1667,2000,2333,2667', 'inhale');
  eq(ticks.slice(9).join(','), '4000,5000,6000,7000,8000,9000,10000,10160', 'hold');
});
test('watchSchedulerPolledFromTheTick', () => {
  // As on the watch: LiteTime keeps the tasks, the page's 100 ms interval runs the due ones.
  let now = 0;
  const time = new A.LiteTime(() => now);
  const run = (ms) => {
    for (const end = now + ms; now < end;) {
      now += 100;
      time.poll();
    }
  };
  const vib = [];
  const c = controller('quick', 2, true, sessionFiles().sf, time, vib);
  const phases = [];
  c.setObserver({ onUpdate: (v) => { if (phases[phases.length - 1] !== v.phase) phases.push(v.phase); }, onSummary() {} });
  c.start();
  run(30000); // intro slides go by themselves
  eq(c.view.stage, 'emotion', 'the emotion first after the intro');
  c.chooseEmotion('anxiety');
  eq(c.view.stage, 'intensity', 'then its intensity');
  c.rateBefore(4);
  ok(c.view.stage === 'breathing', `breathing after the intensity, got ${c.view.stage}`);
  const n = vib.length;
  run(19000); // one 4-7-8 cycle
  ok(phases.includes('holdIn') && phases.includes('exhale'), `phases change: ${phases.join(',')}`);
  ok(vib.length - n >= 9, 'every inhale vibrates');
  run(c.remainingMs());
  eq(c.view.stage, 'question', 'the steps go on to the questions');
  ok(time.tasks.length < 20, 'no task pile-up');
  time.clear();
  eq(time.tasks.length, 0);
});
test('watchClockNeverGoesBack', () => {
  let now = 10000;
  const time = new A.LiteTime(() => now);
  eq(time.now(), 10000);
  now = 9000; // a time sync stepped the wall clock back
  eq(time.now(), 10000, 'the breathing position does not jump back');
  now = 10500;
  eq(time.now(), 10500);
});
test('pauseStopsTicksAndVibrationOff', () => {
  const time = new ManualTime();
  const vib = [];
  const { sf } = sessionFiles();
  const c = controller('quick', 3, true, sf, time, vib);
  c.start();
  c.finishIntro();
  c.skipEmotion();
  c.rateBefore(3);
  time.advance(500);
  const n = vib.length;
  c.pause();
  time.advance(10000);
  eq(vib.length, n, 'no vibration while paused');
  const silent = [];
  const c2 = controller('quick', 2, false, sessionFiles().sf, time, silent);
  c2.start();
  c2.finishIntro();
  c2.skipEmotion();
  c2.rateBefore(3);
  time.advance(60000);
  eq(silent.length, 0);
});
test('snapshotRestoresPausedAndRoutesToThePage', () => {
  const time = new ManualTime();
  const { sf } = sessionFiles();
  const c = controller('full', 5, true, sf, time);
  c.start();
  c.finishIntro();
  c.skipEmotion();
  c.rateBefore(3);
  time.advance(25000);
  c.interrupt();
  let snap = null;
  sf.readSnapshot((s) => { snap = s; });
  ok(snap !== null, 'snapshot written');
  eq(pageForStage(snap.stage), 'session');
  const r = SessionController.fromSnapshot(snap, time, time, new A.LiteHaptics({ vibrate() {} }), sf, () => 0);
  ok(r.isPaused(), 'restored paused');
  eq(r.view.cycle, 2);
  r.resume();
  time.advance(5000);
  eq(r.view.phase, 'exhale');
  eq(pageForStage('question'), 'prompt');
  eq(pageForStage('completionBreathing'), 'session');
  eq(pageForStage('checkIn'), 'prompt');
  eq(pageForStage('intensity'), 'prompt');
});
test('pendingRecordAndDiscard', () => {
  const { sf, files } = sessionFiles();
  let done = false;
  sf.writePending({ startedAt: 5, status: 'interrupted', stoppedAt: 'question', extra: 1 }, () => { done = true; });
  ok(done);
  let p = null;
  sf.readPending((r) => { p = r; });
  eq(p.stoppedAt, 'question');
  eq(p.extra, undefined, 'only record fields are kept');
  sf.save({ stepIndex: 1 });
  sf.discardAll();
  eq(Object.keys(files).length, 0);
});
test('planFileWrittenReadAndCleared', () => {
  const { sf, files } = sessionFiles();
  let text = null;
  sf.readPlan((t) => { text = t; });
  eq(text, '', 'no plan yet');
  sf.writePlan('intro:0:9000,breathing:0:38000');
  sf.readPlan((t) => { text = t; });
  eq(text, 'intro:0:9000,breathing:0:38000');
  sf.save({ stepIndex: 1 });
  sf.clear();
  eq(Object.keys(files).length, 0, 'the plan goes with the snapshot');
});

console.log('PromptFlow mirrors SessionController');
const strip = (s) => {
  const o = JSON.parse(JSON.stringify(s));
  delete o.savedAt;
  delete o.plan;
  return JSON.stringify(o);
};
/** What pages/prompt restores: the snapshot plus plan.json, through JSON like the files. */
const handoff = (c) => JSON.parse(JSON.stringify(Object.assign(c.snapshot(), { plan: planOf(c) })));

/**
 * Runs a session with the controller and, at every prompt stage, also with a PromptFlow restored
 * from the controller's snapshot (as pages/prompt does), applying the same answers to both.
 * Views, snapshots, remaining time and records must match after every action.
 */
function parity(mode, durationMin, act) {
  const time = new ManualTime();
  const ref = controller(mode, durationMin, false, sessionFiles().sf, time);
  ref.start();
  ref.finishIntro();
  let guard = 0;
  while (ref.view.stage !== 'summary' && guard++ < 50) {
    if (pageForStage(ref.view.stage) === 'session') {
      breatheThrough(time, ref);
      continue;
    }
    const flow = PromptFlow.fromSnapshot(handoff(ref), time, time, null, sessionFiles().sf,
      () => 1_700_000_000_000 + time.now());
    flow.setMessageSeed(7);
    flow.resume();
    eq(strip(flow.snapshot()), strip(ref.snapshot()), `restored at ${ref.view.stage}`);
    eq(`${flow.view.question} ${flow.view.questionIndex}/${flow.view.questionTotal}`,
      `${ref.view.question} ${ref.view.questionIndex}/${ref.view.questionTotal}`, `question on restore at ${ref.view.stage}`);
    while (ref.view.stage !== 'summary' && pageForStage(ref.view.stage) === 'prompt') {
      time.advance(1500);
      act(ref);
      act(flow);
      eq(flow.view.stage, ref.view.stage, 'stage');
      eq(flow.view.notNowReturn, ref.view.notNowReturn, 'notNowReturn');
      eq(`${flow.view.question} ${flow.view.questionIndex}/${flow.view.questionTotal}`,
        `${ref.view.question} ${ref.view.questionIndex}/${ref.view.questionTotal}`, 'question');
      eq(flow.view.emotionNote, ref.view.emotionNote, 'emotionNote');
      eq(flow.view.message, ref.view.message, 'message');
      eq(flow.view.professionalHint, ref.view.professionalHint, 'professionalHint');
      eq(strip(flow.snapshot()), strip(ref.snapshot()), `snapshot at ${ref.view.stage}`);
      eq(flow.view.repeatOffer, ref.view.repeatOffer, 'repeatOffer');
      if (pageForStage(ref.view.stage) === 'prompt') eq(flow.remainingMs(), ref.remainingMs(), 'remaining');
      eq(JSON.stringify(flow.buildRecord('interrupted')), JSON.stringify(Object.assign({}, ref.buildRecord('interrupted'))),
        'interrupted record');
    }
  }
  eq(ref.view.stage, 'summary');
  return ref;
}
/**
 * Answers every prompt: intensity before 4, `answer(question)`, the emotion, intensity after
 * `after(round)` (0 = "Free"), and "Once more" while round < rounds.
 */
const answerAll = (answer, emotion, after, rounds = 1) => (c) => {
  const v = c.view;
  if (v.stage === 'intensity') c.rateBefore(4);
  else if (v.stage === 'question') c.answer(answer(v.question));
  else if (v.stage === 'emotion') {
    if (v.emotionNote) c.acknowledgeEmotionNote();
    else if (emotion) c.chooseEmotion(emotion);
    else c.skipEmotion();
  } else if (v.stage === 'checkIn') {
    if (!v.repeatOffer) c.rate(after(v.rounds));
    else if (v.rounds < rounds) c.repeat();
    else c.finishRounds();
  } else if (v.stage === 'message') c.finishMessage();
};
test('fullPracticeFreeAfterOneRound', () => {
  const r = parity('full', 5, answerAll(() => 'yes', 'tension', () => 0)).buildRecord('completed');
  eq(r.emotionBefore, 'tension');
  eq(`${r.intensityBefore} ${r.intensityAfter} ${r.rounds}`, '4 0 1');
});
test('fullPracticeFearNoteAndStrongIntensity', () => {
  const ref = parity('full', 3, answerAll(() => 'no', 'fear', () => 5));
  eq(ref.view.message, 'supportive');
});
test('quickNotNowReturnsToBreathing', () => {
  parity('quick', 3, answerAll((q) => (q === 4 ? 'notNow' : 'skip'), '', () => 0));
});
test('twoMoreRoundsThenFree', () => {
  const r = parity('full', 2, answerAll(() => 'skip', '', (round) => (round < 3 ? 3 : 0), 3)).buildRecord('completed');
  eq(`${r.intensityBefore} ${r.intensityAfter} ${r.rounds}`, '4 0 3');
});
test('oneMoreRoundThenFinish', () => {
  const r = parity('quick', 2, answerAll(() => 'yes', '', () => 2, 2)).buildRecord('completed');
  eq(`${r.intensityAfter} ${r.rounds}`, '2 2');
});
console.log('BreathFlow mirrors SessionController');
/**
 * The controller and a BreathFlow on two clocks kept in step. BreathFlow starts with the session
 * and, after every prompt stage, is restored from the controller's snapshot (as pages/session is).
 * Views, snapshots, remaining time, records and vibration must match every 250 ms.
 */
function breathParity(mode, durationMin, act, opts = {}) {
  const tRef = new ManualTime();
  const tFlow = new ManualTime();
  const vibRef = [];
  const vibFlow = [];
  const ref = controller(mode, durationMin, true, sessionFiles().sf, tRef, vibRef, !!opts.preset);
  const haptics = new A.LiteHaptics({ vibrate: (o) => vibFlow.push(`${tFlow.now()}:${o.mode}`) });
  const make = (s) => BreathFlow.fromSnapshot(s, tFlow, tFlow, haptics, sessionFiles().sf,
    () => 1_700_000_000_000 + tFlow.now());
  const preset = opts.preset ? { askEmotion: false, emotion: 'anger', intensityBefore: 4 } : {};
  let flow = new BreathFlow(Object.assign({ durationMin, mode, patternId: 'relax478', freeInhaleSec: 4, freeExhaleSec: 6,
    vibration: true }, preset), tFlow, tFlow, haptics, sessionFiles().sf, () => 1_700_000_000_000 + tFlow.now());
  ref.start();
  flow.start();
  let vibFrom = 0;
  let guard = 0;
  while (ref.view.stage !== 'summary' && guard++ < 2000) {
    if (pageForStage(ref.view.stage) === 'prompt') {
      eq(flow.view.stage, ref.view.stage, 'BreathFlow stops at the prompt');
      flow.shutdown();
      while (ref.view.stage !== 'summary' && pageForStage(ref.view.stage) === 'prompt') act(ref);
      if (ref.view.stage === 'summary') break;
      tFlow.advance(tRef.now() - tFlow.now());
      vibFrom = vibRef.length;
      flow = make(JSON.parse(JSON.stringify(ref.snapshot())));
      if (ref.view.notNowReturn) flow.view.notNowReturn = true; // router param notNow, as sessionPage does
      ok(flow.isPaused(), 'restored paused');
      // The controller has already started the step; the page resumes the restored one at once.
      vibRef.length = vibFrom;
      vibFlow.length = 0;
      flow.resume();
      ref.pause();
      ref.resume();
      vibRef.splice(0, vibFrom);
      vibFrom = 0;
      vibFlow.splice(0, vibFlow.length - vibRef.length);
    }
    if (opts.pauseAt && ref.view.stage === 'breathing' && guard === opts.pauseAt) {
      ref.pause();
      flow.pause();
      tRef.advance(5000);
      tFlow.advance(5000);
      ref.resume();
      flow.resume();
    }
    tRef.advance(250);
    tFlow.advance(250);
    const at = `${ref.view.stage}#${ref.view.stepIndex} t=${tRef.now()}`;
    eq(flow.view.stage, ref.view.stage, `stage ${at}`);
    if (pageForStage(ref.view.stage) === 'prompt') continue;
    // introIndex is shown on the intro only (the core keeps the last one afterwards).
    const intro = (v) => (v.stage === 'intro' ? v.introIndex : '-');
    eq(`${intro(flow.view)} ${flow.view.phase} ${flow.view.cycle} ${flow.view.paused}`,
      `${intro(ref.view)} ${ref.view.phase} ${ref.view.cycle} ${ref.view.paused}`, `view ${at}`);
    eq(flow.view.notNowReturn, ref.view.notNowReturn, `notNowReturn ${at}`);
    eq(strip(flow.snapshot()), strip(ref.snapshot()), `snapshot ${at}`);
    eq(flow.remainingMs(), ref.remainingMs(), `remaining ${at}`);
    eq(flow.currentPhase(), ref.currentPhase(), `phase ${at}`);
    eq(flow.phaseProgress(), ref.phaseProgress(), `progress ${at}`);
    eq(JSON.stringify(flow.buildRecord('interrupted')), JSON.stringify(Object.assign({}, ref.buildRecord('interrupted'))),
      `record ${at}`);
    eq(vibFlow.join(' '), vibRef.slice(vibFrom).join(' '), `vibration ${at}`);
  }
  eq(ref.view.stage, 'summary');
}
test('breathFlowFullPractice', () => {
  breathParity('full', 3, answerAll(() => 'yes', 'tension', () => 0));
});
test('breathFlowQuickWithPause', () => {
  breathParity('quick', 2, answerAll(() => 'skip', '', () => 0), { pauseAt: 60 });
});
test('breathFlowNotNowReturn', () => {
  breathParity('full', 2, answerAll((q) => (q === 5 ? 'notNow' : 'no'), 'fear', () => 1));
});
test('breathFlowEmotionAskedBefore', () => {
  breathParity('full', 3, answerAll(() => 'yes', '', (round) => (round < 2 ? 3 : 0), 2), { preset: true });
});
test('breathFlowSecondRound', () => {
  breathParity('full', 3, answerAll(() => 'yes', '', (round) => (round < 2 ? 4 : 0), 2));
});
test('circleScaleMatchesTheCore', () => {
  for (const ph of ['inhale', 'holdIn', 'exhale', 'holdOut']) {
    for (const p of [-1, 0, 0.3, 1, 2]) eq(circleScale(ph, p), BreathVisual.scaleAt(ph, p), `${ph} ${p}`);
  }
});
test('promptFlowPauseAndDiscard', () => {
  const time = new ManualTime();
  const { sf, files } = sessionFiles();
  const ref = controller('quick', 3, false, sessionFiles().sf, time);
  ref.start();
  ref.finishIntro();
  ref.skipEmotion();
  ref.rateBefore(3);
  breatheThrough(time, ref);
  eq(PromptFlow.fromSnapshot(ref.snapshot(), time, time, null, sf, () => 0), null, 'no plan: pages/session restores it');
  const restoredFrom = handoff(ref);
  const flow = PromptFlow.fromSnapshot(restoredFrom, time, time, null, sf, () => 0);
  ok(flow.isPaused(), 'restored paused');
  flow.answer('yes');
  eq(flow.view.questionIndex, 1, 'no answers while paused');
  flow.resume();
  time.advance(2000);
  flow.interrupt();
  ok(flow.isPaused());
  eq(flow.snapshot().activeMs, restoredFrom.activeMs + 2000, 'active time counts only while resumed');
  ok(!('plan' in flow.snapshot()), 'the plan stays in plan.json, out of the snapshot');
  flow.discard();
  ok(flow.isEnded());
  ok(!('internal://app/snapshot.json' in files), 'discard drops the snapshot');
});

fs.rmSync(out, { recursive: true, force: true });
console.log(`\n${passed}/${passed + failed} passed`);
process.exitCode = failed ? 1 : 0;
