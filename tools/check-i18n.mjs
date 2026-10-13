// Static localization check (no device needed). Fails with exit code 1 on any problem.
//  1. base (ru) / en / es contain exactly the same keys, no empty values;
//  2. the same format placeholders (%d, %s) in the same order;
//  3. watch-size limits: questions and buttons must not get clipped;
//  4. every $r('app.string.X') used in code exists, and every key is used;
//  5. no hard-coded user-visible text in .ets UI code.
// Usage: node tools/check-i18n.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const res = path.join(root, 'entry/src/main/resources');
const LANGS = ['base', 'en', 'es'];
const problems = [];
const warn = [];

const load = (lang) => {
  const file = path.join(res, lang, 'element/string.json');
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  return new Map(json.string.map((e) => [e.name, e.value]));
};
const tables = Object.fromEntries(LANGS.map((l) => [l, load(l)]));
const baseKeys = [...tables.base.keys()];
const placeholders = (s) => (s.match(/%(\d+\$)?[sd]/g) || []).join(',');

// 1 + 2
for (const lang of LANGS) {
  const t = tables[lang];
  for (const k of baseKeys) {
    if (!t.has(k)) problems.push(`[${lang}] missing key ${k}`);
    else if (!t.get(k).trim()) problems.push(`[${lang}] empty value ${k}`);
    else if (placeholders(t.get(k)) !== placeholders(tables.base.get(k))) {
      problems.push(`[${lang}] placeholders differ for ${k}: "${t.get(k)}"`);
    }
  }
  for (const k of t.keys()) if (!tables.base.has(k)) problems.push(`[${lang}] extra key ${k}`);
}

// 3: limits tuned for ~1.6" screens at 22fp (questions wrap to 2-3 lines, buttons to 1-2 lines)
const LIMITS = [
  [/^q_\d$/, 48], [/^ans_/, 16], [/^btn_/, 24], [/^phase_/, 10], [/^emotion_(?!title|fear_note)/, 16],
  [/^intro_\d$/, 40], [/^mode_/, 24], [/^pattern_/, 24]
];
for (const lang of LANGS) {
  for (const [k, v] of tables[lang]) {
    for (const [re, max] of LIMITS) {
      if (re.test(k) && v.length > max) problems.push(`[${lang}] ${k} is ${v.length} chars (max ${max}): "${v}"`);
    }
  }
}

// 4 + 5
const etsFiles = [];
const walk = (dir) => {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p);
    else if (f.name.endsWith('.ets')) etsFiles.push(p);
  }
};
walk(path.join(root, 'entry/src/main/ets'));
const used = new Set();
const textCall = /\b(Text|Button|Span|showToast\(\{\s*message:)\s*\(?\s*(['"`])((?:(?!\2).)*)\2/g;
for (const file of etsFiles) {
  const src = fs.readFileSync(file, 'utf8');
  const rel = path.relative(root, file);
  for (const m of src.matchAll(/\$r\('app\.string\.([A-Za-z0-9_]+)'/g)) {
    used.add(m[1]);
    if (!tables.base.has(m[1])) problems.push(`${rel}: unknown string key ${m[1]}`);
  }
  src.split('\n').forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
    for (const m of line.matchAll(textCall)) {
      // Template literals with only numbers/placeholders (e.g. `${n}`) and symbols are fine.
      const literal = m[3].replace(/\$\{[^}]*\}/g, '');
      if (/[A-Za-zА-Яа-яЁё]/.test(literal)) problems.push(`${rel}:${i + 1}: hard-coded UI text "${m[3]}"`);
    }
  });
}
// Keys referenced only from JSON configs (module.json5, form_config.json, app.json5).
for (const cfg of ['entry/src/main/module.json5', 'entry/src/main/resources/base/profile/form_config.json']) {
  for (const m of fs.readFileSync(path.join(root, cfg), 'utf8').matchAll(/\$string:([A-Za-z0-9_]+)/g)) used.add(m[1]);
}
for (const k of baseKeys) if (!used.has(k)) warn.push(`unused key ${k}`);

for (const w of warn) console.log(`warn  ${w}`);
for (const p of problems) console.log(`ERROR ${p}`);
console.log(`\n${baseKeys.length} keys x ${LANGS.length} languages, ${etsFiles.length} .ets files: ` +
  `${problems.length} error(s), ${warn.length} warning(s)`);
process.exitCode = problems.length ? 1 : 0;
