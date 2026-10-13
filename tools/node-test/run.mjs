// Runs the pure-logic local unit tests (entry/src/test/*.test.ets) under Node,
// using a tiny @ohos/hypium shim. The same files run unchanged in DevEco Studio.
//
// Usage:  node tools/node-test/run.mjs
// TypeScript is taken from DevEco's SDK (or set TS_PATH to any typescript package).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const tsCandidates = [
  process.env.TS_PATH,
  'C:/Program Files/Huawei/DevEco Studio/sdk/default/openharmony/ets/build-tools/ets-loader/node_modules/typescript',
  '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader/node_modules/typescript',
  'typescript'
].filter(Boolean);
let ts;
for (const c of tsCandidates) {
  try { ts = require(c); break; } catch { /* try next */ }
}
if (!ts) { console.error('TypeScript not found: set TS_PATH'); process.exit(2); }

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'sedona-test-'));
const fixImports = (src) => src
  .replace(/from '@ohos\/hypium'/g, "from './hypium-shim.mjs'")
  .replace(/from '\.\.\/main\/ets\/core\/(\w+)'/g, "from './core/$1.mjs'")
  .replace(/from '\.\/(\w+)'/g, "from './$1.mjs'");
const compile = (src) => ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, experimentalDecorators: true }
}).outputText;
const emit = (srcFile, dstFile) => fs.writeFileSync(dstFile, fixImports(compile(fs.readFileSync(srcFile, 'utf8'))));

fs.mkdirSync(path.join(out, 'core'));
const coreDir = path.join(root, 'entry/src/main/ets/core');
for (const f of fs.readdirSync(coreDir)) {
  emit(path.join(coreDir, f), path.join(out, 'core', f.replace(/\.ets$/, '.mjs')));
}
emit(path.join(root, 'tools/node-test/hypium-shim.ts'), path.join(out, 'hypium-shim.mjs'));
const testDir = path.join(root, 'entry/src/test');
const tests = fs.readdirSync(testDir).filter((f) => f.endsWith('.test.ets') && !f.startsWith('List'));
const shim = await import(pathToFileURL(path.join(out, 'hypium-shim.mjs')).href);
for (const f of tests) {
  const dst = path.join(out, f.replace(/\.ets$/, '.mjs'));
  emit(path.join(testDir, f), dst);
  (await import(pathToFileURL(dst).href)).default();
}
const failed = shim.run();
fs.rmSync(out, { recursive: true, force: true });
process.exitCode = failed === 0 ? 0 : 1;
