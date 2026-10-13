import breathEngineTest from './BreathEngine.test';
import vibrationTest from './Vibration.test';
import sessionTest from './Session.test';

export default function testsuite() {
  breathEngineTest();
  vibrationTest();
  sessionTest();
}
