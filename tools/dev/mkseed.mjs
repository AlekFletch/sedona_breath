// Writes simulator seed folders with a snapshot at a given stage. Usage: node mkseed.mjs <outDir> <stage> [mode]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [outDir, stage, mode = 'quick'] = process.argv.slice(2);
const src = 'C:/Claude/Sedona breath/lite/entry/src/main/js/MainAbility/core';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-'));
fs.writeFileSync(path.join(tmp, 'package.json'), '{ "type": "module" }');
fs.cpSync(src, path.join(tmp, 'core'), { recursive: true });
fs.mkdirSync(path.join(tmp, 'common'));
fs.copyFileSync(path.join(src, '../common/plan.js'), path.join(tmp, 'common/plan.js'));
const P = await import(pathToFileURL(path.join(tmp, 'core/BreathPattern.js')).href);
const S = await import(pathToFileURL(path.join(tmp, 'core/SessionPlan.js')).href);
const { planOf } = await import(pathToFileURL(path.join(tmp, 'common/plan.js')).href);
const pattern = P.PatternCatalog.build('relax478', new P.FreeRhythm(4, 6));
const steps = S.SessionPlanner.build(3, mode, pattern, 1, false); // the emotion was asked on pages/feel
const index = steps.findIndex((s) => s.stage() === stage);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'settings.json'), JSON.stringify({ onboardingAccepted: true, language: 'system' }));
fs.writeFileSync(path.join(outDir, 'snapshot.json'), JSON.stringify({
  version: 1, savedAt: Date.now(), startedAt: Date.now() - 150000, durationMin: 3, mode, patternId: 'relax478',
  freeInhaleSec: 4, freeExhaleSec: 6, vibration: true, stepIndex: index, stepElapsedMs: 0, activeMs: 150000,
  cyclesDone: 6, emotion: mode === 'full' ? 'tension' : '', intensityBefore: 4, intensityAfter: -1, rounds: 1, askEmotion: false, stage
}));
// pages/prompt reads the plan pages/session writes when it starts (common/plan.js).
fs.writeFileSync(path.join(outDir, 'plan.json'), JSON.stringify(planOf({ steps, pattern })));
console.log(stage, 'index', index, 'of', steps.length);
