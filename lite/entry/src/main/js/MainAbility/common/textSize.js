/*
 * Wrapped text blocks. The watch wraps a long line at any character ("эт|ому"), and lite texts
 * do not grow with their content, so the pages break lines between words themselves (wrap) and
 * give the block its height from the line count (textHeight). Characters per line are on the safe
 * side for the text widths (30 px font, 356 px: 19; 24 px font, 340 px: 24), all languages included.
 * Line heights as the simulator draws them: 45 px for the 30 px font, 37 px for the 24 px one.
 */
var BIG_CHARS = 19;
var SMALL_CHARS = 24;
var BIG_LINE = 46;
var SMALL_LINE = 38;

/** The text with '\n' between words, so that no line is longer than the limit (unless one word is). */
export function wrap(text, big) {
  var max = big ? BIG_CHARS : SMALL_CHARS;
  var words = String(text).split(' ');
  var out = '';
  var line = '';
  for (var i = 0; i < words.length; i++) {
    var w = words[i];
    if (line === '') {
      line = w;
    } else if (line.length + 1 + w.length <= max) {
      line += ' ' + w;
    } else {
      out += line + '\n';
      line = w;
    }
  }
  return out + line;
}

/** Height of a text from wrap(). */
export function textHeight(text, big) {
  return String(text).split('\n').length * (big ? BIG_LINE : SMALL_LINE);
}
