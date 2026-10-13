/*
 * Height of a wrapped text block. Lite texts do not grow with their content and the watch wraps
 * by words, so blocks get their height from the text: characters per line are on the safe side
 * for 340 px (24 px font: 22, 30 px font: 17), all languages included.
 */
export function textHeight(text, big) {
  var perLine = big ? 17 : 22;
  var line = big ? 40 : 32;
  return Math.max(1, Math.ceil(String(text).length / perLine)) * line;
}
