/* The real @system modules, in the shape the Store expects (tests pass fakes). */
import file from '@system.file';
import configuration from '@system.configuration';

export function storeSystem() {
  return { file: file, configuration: configuration };
}
