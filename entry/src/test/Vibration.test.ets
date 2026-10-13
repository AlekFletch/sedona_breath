import { describe, it, expect } from '@ohos/hypium';
import { BreathPhase, PhaseType } from '../main/ets/core/BreathPattern';
import { ManualTime } from '../main/ets/core/ManualTime';
import {
  CueKind, DOUBLE_GAP_MS, HapticDriver, LONG_PULSE_MS, SHORT_PULSE_MS, VibrationCue, VibrationPlanner,
  VibrationScheduler
} from '../main/ets/core/Vibration';

class FakeHaptics implements HapticDriver {
  time: ManualTime;
  pulses: string[] = [];
  stops: number = 0;

  constructor(time: ManualTime) {
    this.time = time;
  }

  pulse(durationMs: number): void {
    this.pulses.push(`${this.time.now()}/${durationMs}`);
  }

  stop(): void {
    this.stops++;
  }
}

function offsets(cues: VibrationCue[]): string {
  return cues.map((c: VibrationCue) => `${c.offsetMs}`).join(',');
}

export default function vibrationTest() {
  describe('VibrationPlanner', () => {
    it('inhale4sThreePerSecondSilentLastSecond', 0, () => {
      const cues = VibrationPlanner.cuesFor(new BreathPhase(PhaseType.INHALE, 4000));
      expect(offsets(cues)).assertEqual('0,333,667,1000,1333,1667,2000,2333,2667');
      const last = cues[cues.length - 1];
      // Nothing starts within the last second.
      expect(last.offsetMs + last.durationMs <= 3000).assertTrue();
      for (const c of cues) {
        expect(c.kind).assertEqual(CueKind.INHALE_TICK);
        expect(c.durationMs).assertEqual(SHORT_PULSE_MS);
      }
    });

    it('inhaleScalesWithDuration', 0, () => {
      expect(VibrationPlanner.inhale(3000).length).assertEqual(6);
      expect(VibrationPlanner.inhale(8000).length).assertEqual(21);
      expect(VibrationPlanner.inhale(1000).length).assertEqual(0);
    });

    it('hold7sSingleThenDouble', 0, () => {
      const cues = VibrationPlanner.cuesFor(new BreathPhase(PhaseType.HOLD_IN, 7000));
      expect(offsets(cues)).assertEqual(`0,1000,2000,3000,4000,5000,6000,${6000 + SHORT_PULSE_MS + DOUBLE_GAP_MS}`);
      expect(cues[5].kind).assertEqual(CueKind.HOLD_TICK);
      expect(cues[6].kind).assertEqual(CueKind.HOLD_LAST);
      expect(cues[7].kind).assertEqual(CueKind.HOLD_LAST);
      // The double pulse fits into the last second.
      expect(cues[7].offsetMs + cues[7].durationMs < 7000).assertTrue();
    });

    it('holdAfterExhaleSameScheme', 0, () => {
      const a = VibrationPlanner.cuesFor(new BreathPhase(PhaseType.HOLD_IN, 4000));
      const b = VibrationPlanner.cuesFor(new BreathPhase(PhaseType.HOLD_OUT, 4000));
      expect(offsets(a)).assertEqual(offsets(b));
      expect(a.length).assertEqual(5); // 3 single + double
    });

    it('hold2sOnlyDoubleAtSecondSecond', 0, () => {
      expect(offsets(VibrationPlanner.hold(2000))).assertEqual(`0,1000,${1000 + SHORT_PULSE_MS + DOUBLE_GAP_MS}`);
    });

    it('exhaleIsSilent', 0, () => {
      expect(VibrationPlanner.cuesFor(new BreathPhase(PhaseType.EXHALE, 8000)).length).assertEqual(0);
    });

    it('sessionEndOneLongPulse', 0, () => {
      const cues = VibrationPlanner.sessionEnd();
      expect(cues.length).assertEqual(1);
      expect(cues[0].durationMs).assertEqual(LONG_PULSE_MS);
    });
  });

  describe('VibrationScheduler', () => {
    it('playsCuesOnTime', 0, () => {
      const t = new ManualTime();
      const h = new FakeHaptics(t);
      const s = new VibrationScheduler(h, t);
      s.playPhase(new BreathPhase(PhaseType.HOLD_IN, 3000), 0);
      t.advance(3000);
      expect(h.pulses.join(' ')).assertEqual(`0/50 1000/50 2000/50 ${2000 + SHORT_PULSE_MS + DOUBLE_GAP_MS}/50`);
    });

    it('resumeMidPhaseSkipsPastCues', 0, () => {
      const t = new ManualTime();
      const h = new FakeHaptics(t);
      const s = new VibrationScheduler(h, t);
      s.playPhase(new BreathPhase(PhaseType.INHALE, 4000), 2100);
      t.advance(2000);
      expect(h.pulses.join(' ')).assertEqual('233/50 567/50');
    });

    it('stopAllCancelsImmediately', 0, () => {
      const t = new ManualTime();
      const h = new FakeHaptics(t);
      const s = new VibrationScheduler(h, t);
      s.playPhase(new BreathPhase(PhaseType.INHALE, 4000), 0);
      t.advance(500);
      const before = h.pulses.length;
      s.stopAll();
      expect(s.pendingCount()).assertEqual(0);
      expect(t.pending()).assertEqual(0);
      t.advance(5000);
      expect(h.pulses.length).assertEqual(before);
      expect(h.stops > 0).assertTrue();
    });

    it('disabledPlaysNothing', 0, () => {
      const t = new ManualTime();
      const h = new FakeHaptics(t);
      const s = new VibrationScheduler(h, t);
      s.setEnabled(false);
      s.playPhase(new BreathPhase(PhaseType.INHALE, 4000), 0);
      s.playSessionEnd();
      t.advance(5000);
      expect(h.pulses.length).assertEqual(0);
    });

    it('newPhaseReplacesOldCues', 0, () => {
      const t = new ManualTime();
      const h = new FakeHaptics(t);
      const s = new VibrationScheduler(h, t);
      s.playPhase(new BreathPhase(PhaseType.INHALE, 4000), 0);
      t.advance(100);
      s.playPhase(new BreathPhase(PhaseType.EXHALE, 4000), 0);
      t.advance(5000);
      expect(h.pulses.join(' ')).assertEqual('0/50');
    });
  });
}
