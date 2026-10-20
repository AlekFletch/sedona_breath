/*
 * Texts of a page. They live outside the JS bundles, in the runtime's i18n/*.json files read by
 * the page's $t(); each file holds all three languages, so a key is looked up as '<lang>.<key>'
 * and the language chosen in Settings applies at once (tools/build-lite.mjs generates them).
 */
import { formatString } from './adapters.js';

/**
 * @param templateKeys  string keys the page template shows as s.key (common/keys/<page>.js)
 * @param translate     the page's $t: path -> text
 */
export function Strings(templateKeys, translate) {
  this.templateKeys = templateKeys || [];
  this.translate = translate;
  this.lang = 'ru';
  // $t reads the i18n file on the watch: each path is looked up once per page.
  this.cache = {};
}

/** Texts for the page template: { key: text } for the keys the template uses. */
Strings.prototype.strings = function () {
  var out = {};
  for (var i = 0; i < this.templateKeys.length; i++) {
    out[this.templateKeys[i]] = this.t(this.templateKeys[i]);
  }
  return out;
};

/** Text in the current language, then Russian, then the key itself. */
Strings.prototype.t = function (key) {
  var v = this.lookup(this.lang, key);
  if (v === null && this.lang !== 'ru') {
    v = this.lookup('ru', key);
  }
  return v === null ? key : v;
};

Strings.prototype.lookup = function (lang, key) {
  var path = lang + '.' + key;
  if (this.cache.hasOwnProperty(path)) {
    return this.cache[path];
  }
  var v = this.translate(path);
  // $t returns the path itself for a missing key.
  v = typeof v === 'string' && v !== path ? v : null;
  this.cache[path] = v;
  return v;
};

Strings.prototype.fmt = function (key) {
  var args = [];
  for (var i = 1; i < arguments.length; i++) {
    args.push(arguments[i]);
  }
  return formatString(this.t(key), args);
};

/**
 * Label of an enum value: key prefix + value, e.g. label('pattern_', 'box4444').
 * tools/build-lite.mjs bundles every key with a prefix that a page quotes ('pattern_').
 */
Strings.prototype.label = function (prefix, value, fallback) {
  var key = prefix + value;
  return this.lookup(this.lang, key) !== null || this.lookup('ru', key) !== null ? this.t(key) : this.t(prefix + fallback);
};
