// Tests for the lite-wearable (Watch Fit) build under Node: generated core + adapters +
// services with fake @system modules and a manual clock. Pages need the lite runtime
// and are covered by the manual test plan.
//
// Usage: node tools/node-test/lite.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = path.join(root, 'lite/entry/src/main/js/MainAbility');

// 0. Generated files must be in sync with the ArkTS sources.
try {
  execFileSync(process.execPath, [path.join(root, 'tools/build-lite.mjs'), '--check'], { stdio: 'pipe' });
} catch (e) {
  console.log(String(e.stdout));
  console.log('FAIL generated lite files are out of date');
  process.exit(1);
}

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'sedona-lite-'));
fs.writeFileSync(path.join(out, 'package.json'), '{ "type": "module" }');
for (const dir of ['core', 'common', 'i18n']) fs.cpSync(path.join(src, dir), path.join(out, dir), { recursive: true });
const { Services } = await import(pathToFileURL(path.join(out, 'common/services.js')).href);
const A = await import(pathToFileURL(path.join(out, 'common/adapters.js')).href);
const { ManualTime } = await import(pathToFileURL(path.join(out, 'core/Timing.js')).href);

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

/** Fake lite device: in-memory files, recorded vibrations, manual time. */
function device(opts = {}) {
  const time = new ManualTime();
  const files = opts.files || {};
  const vib = [];
  const sys = {
    now: () => time.now(),
    timers: { setTimeout: (cb, ms) => time.schedule(ms, cb), clearTimeout: (h) => time.cancel(h) },
    vibrator: { vibrate: (o) => vib.push(`${time.now()}:${o.mode}`) },
    file: {
      readText: (o) => (o.uri in files ? o.success({ text: files[o.uri] }) : o.fail('nofile', 301)),
      writeText: (o) => { files[o.uri] = o.text; o.success(); },
      delete: (o) => { delete files[o.uri]; o.success(); }
    },
    battery: { getStatus: (o) => o.success({ level: opts.level ?? 0.8, charging: opts.charging ?? false }) },
    brightness: { setKeepScreenOn: (o) => { sys.keepOn = o.keepScreenOn; } },
    configuration: { getLocale: () => ({ language: opts.lang || 'ru', countryOrRegion: 'RU', dir: 'ltr' }) }
  };
  const svc = new Services(sys);
  svc.load();
  return { svc, time, files, vib, sys };
}

/** Drives a controller to its next non-breathing stage. */
function breatheThrough(time, c) {
  time.advance(c.remainingMs() + 20 * 60000);
}

console.log('lite adapters');
test('languageResolution', () => {
  eq(A.resolveLanguage('system', 'en'), 'en');
  eq(A.resolveLanguage('system', 'es-ES'), 'es');
  eq(A.resolveLanguage('system', 'de'), 'ru');
  eq(A.resolveLanguage('system', ''), 'ru');
  eq(A.resolveLanguage('en', 'ru'), 'en');
});
test('formatString', () => {
  eq(A.formatString('Вопрос %d из %d', [2, 5]), 'Вопрос 2 из 5');
  eq(A.formatString('%2$s/%1$s', ['a', 'b']), 'b/a');
});
test('dictionaryFallsBackToRussian', () => {
  const d = A.buildDictionary({ ru: { a: 'А', b: 'Б' }, en: { a: 'A' } }, 'en');
  eq(d.a, 'A');
  eq(d.b, 'Б');
});
test('hapticsMapping', () => {
  const calls = [];
  const h = new A.LiteHaptics({ vibrate: (o) => calls.push(o.mode) });
  h.pulse(50);
  h.pulse(800);
  h.stop();
  eq(calls.join(','), 'short,long');
});

console.log('lite services');
test('defaultsAndRussianStrings', () => {
  const { svc } = device();
  ok(svc.ready, 'not ready');
  eq(svc.settings.onboardingAccepted, false);
  eq(svc.settings.defaultPattern, 'relax478');
  eq(svc.t('q_2'), 'Смог бы я позволить этому чувству быть?');
  eq(svc.fmt('question_counter', 1, 5), 'Вопрос 1 из 5');
});
test('systemEnglishAndManualSpanish', () => {
  const { svc } = device({ lang: 'en' });
  eq(svc.t('q_1'), 'What am I feeling right now?');
  svc.settings.language = 'es';
  svc.saveSettings();
  eq(svc.t('q_5'), '¿Cuándo?');
});
test('settingsPersistAndNormalize', () => {
  const d1 = device();
  d1.svc.settings.onboardingAccepted = true;
  d1.svc.settings.freeInhaleSec = 3;
  d1.svc.settings.freeExhaleSec = 4; // 7 s cycle would exceed 6 breaths/min
  d1.svc.saveSettings();
  const d2 = device({ files: d1.files });
  eq(d2.svc.settings.onboardingAccepted, true);
  eq(d2.svc.settings.freeInhaleSec + d2.svc.settings.freeExhaleSec, 10);
});
test('fullSessionVibrationAndSave', () => {
  const { svc, time, vib, files } = device();
  const c = svc.startSession(svc.config(2, 'full', 'relax478', true));
  c.finishIntro();
  // First inhale of 4-7-8: 9 short ticks, then 6 single + double on the hold.
  time.advance(11000);
  const ticks = vib.filter((v) => v.endsWith('short')).map((v) => Number(v.split(':')[0]));
  eq(ticks.slice(0, 9).join(','), '0,333,667,1000,1333,1667,2000,2333,2667', 'inhale');
  eq(ticks.slice(9).join(','), '4000,5000,6000,7000,8000,9000,10000,10160', 'hold');
  breatheThrough(time, c);
  c.answer('continue');
  c.chooseEmotion('tension');
  while (c.view.stage !== 'checkIn') {
    if (c.view.stage === 'question') c.answer('yes');
    else breatheThrough(time, c);
  }
  ok(vib[vib.length - 1].endsWith('long'), 'session end must be one long pulse');
  c.rate(2);
  eq(c.view.message, 'supportive');
  c.finishMessage();
  const r = svc.prepareSummary();
  eq(r.status, 'completed');
  eq(r.emotionBefore, 'tension');
  let saved = false;
  svc.saveCompleted((okSave) => { saved = okSave; });
  ok(saved, 'not saved');
  eq(svc.todayCount(), 1);
  eq(svc.lastCompleted().ratingAfter, 2);
  ok(!('internal://app/snapshot.json' in files), 'snapshot must be cleared after save');
});
test('pauseStopsTicks', () => {
  const { svc, time, vib } = device();
  const c = svc.startSession(svc.config(3, 'quick', 'calm46', true));
  c.finishIntro();
  time.advance(500);
  const n = vib.length;
  c.pause();
  time.advance(10000);
  eq(vib.length, n, 'no vibration while paused');
});
test('vibrationOffIsSilent', () => {
  const { svc, time, vib } = device();
  const c = svc.startSession(svc.config(2, 'quick', 'box4444', false));
  c.finishIntro();
  time.advance(60000);
  eq(vib.length, 0);
});
test('interruptRestoreAfterProcessKill', () => {
  const d1 = device();
  const c = d1.svc.startSession(d1.svc.config(5, 'full', 'relax478', true));
  c.finishIntro();
  d1.time.advance(25000);
  c.interrupt(); // app.onDestroy / page onHide
  ok('internal://app/snapshot.json' in d1.files, 'snapshot written');
  const d2 = device({ files: d1.files }); // new process
  ok(d2.svc.hasUnfinished(), 'unfinished visible on home');
  const r = d2.svc.restoreSession();
  ok(r.isPaused(), 'restored paused');
  eq(r.view.stage, 'breathing');
  eq(r.view.cycle, 2);
  r.resume();
  d2.time.advance(5000);
  eq(r.view.phase, 'exhale');
});
test('endAndSaveMarksInterrupted', () => {
  const { svc, time } = device();
  const c = svc.startSession(svc.config(3, 'quick', 'calm46', true));
  c.finishIntro();
  breatheThrough(time, c);
  let done = false;
  svc.saveInterrupted(() => { done = true; });
  ok(done);
  const h = svc.latest(10);
  eq(h[0].status, 'interrupted');
  eq(h[0].stoppedAt, 'question');
  eq(svc.hasUnfinished(), false);
});
test('endNowSavesNothing', () => {
  const { svc } = device();
  svc.startSession(svc.config(3, 'quick', 'calm46', true)).finishIntro();
  svc.discard();
  eq(svc.latest(10).length, 0);
  eq(svc.hasUnfinished(), false);
});
test('deleteHistory', () => {
  const { svc, files } = device();
  svc.addRecord({ startedAt: Date.now(), status: 'completed' }, () => {});
  svc.deleteHistory(() => {});
  eq(svc.latest(10).length, 0);
  eq(files['internal://app/history.json'], '[]');
});
test('lowBattery', () => {
  let low = null;
  device({ level: 0.08 }).svc.checkLowBattery((v) => { low = v; });
  eq(low, true);
  device({ level: 0.08, charging: true }).svc.checkLowBattery((v) => { low = v; });
  eq(low, false);
});
test('corruptFilesFallBack', () => {
  const { svc } = device({ files: { 'internal://app/settings.json': '{oops', 'internal://app/history.json': '"x"' } });
  eq(svc.settings.language, 'system');
  eq(svc.latest(10).length, 0);
});

fs.rmSync(out, { recursive: true, force: true });
console.log(`\n${passed}/${passed + failed} passed`);
process.exitCode = failed ? 1 : 0;
