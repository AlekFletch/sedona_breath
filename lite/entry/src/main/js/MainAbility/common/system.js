/* The real @system modules, in the shape the Store and the session page expect (tests pass fakes). */
import file from '@system.file';
import configuration from '@system.configuration';

export function storeSystem() {
  return { file: file, configuration: configuration };
}

export var timers = {
  setTimeout: function (cb, ms) {
    return setTimeout(cb, ms);
  },
  clearTimeout: function (h) {
    clearTimeout(h);
  }
};
