// Minifies the lite page bundles of a *debug* build in place, with the SDK's own terser and
// the options the SDK uses for release builds (mangle only, no compress).
//
// Why: the watch refuses a page whose JS is over 48 KB and has ~100 KB of JS heap, but the
// SDK minifies only in release mode, and DevEco Assistant cannot install a release-format
// HAP ("Failed to decompress"). The SedonaMinifyLiteJS task in lite/entry/hvigorfile.ts runs
// this between LegacyCompileLiteJS and LegacyGenerateLiteCode; then it checks the sizes.
// Found on Watch Fit 4 Pro with the RepPulse lite app (same account, same watch).
//
// Usage: node tools/minify-lite.mjs [--check-only]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'lite/entry/build/default/intermediates/loader_out_lite/default/js/MainAbility');
const LIMIT = 48 * 1024;
const checkOnly = process.argv.includes('--check-only');

const files = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? files(p) : [p];
});

if (!fs.existsSync(OUT)) {
  console.error(`no lite build output at ${path.relative(root, OUT)}`);
  process.exit(1);
}

if (!checkOnly) {
  const sdk = process.env.DEVECO_SDK_HOME || 'C:/Program Files/Huawei/DevEco Studio/sdk';
  const require = createRequire(import.meta.url);
  const terser = require(path.join(sdk, 'default/openharmony/js/build-tools/ace-loader/node_modules/terser'));
  for (const file of files(OUT)) {
    // Source maps are useless on the watch and wrong after minification.
    if (file.endsWith('.js.map')) { fs.unlinkSync(file); continue; }
    if (!file.endsWith('.js')) continue;
    const source = fs.readFileSync(file, 'utf8');
    // compress rewrites bundles into a shape the ACE lite loader rejects ("wrong type of argument").
    const result = await terser.minify(source, { compress: false, mangle: true, ecma: 5 });
    if (!result.code) throw new Error(`terser produced nothing for ${file}`);
    fs.writeFileSync(file, result.code);
  }
}

let failed = false;
for (const file of files(OUT).filter((f) => f.endsWith('.js'))) {
  const size = fs.statSync(file).size;
  const tooBig = size > LIMIT;
  failed ||= tooBig;
  console.log(`${path.relative(OUT, file).padEnd(36)}${(size / 1024).toFixed(1).padStart(7)} KB${tooBig ? '  TOO BIG' : ''}`);
}
if (failed) {
  console.error('Bundles over 48 KB do not open on the watch.');
  process.exit(1);
}
