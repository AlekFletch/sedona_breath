import { describe, it, expect } from '@ohos/hypium';
import { FreeRhythm, PatternCatalog, PatternId, PhaseType } from '../main/ets/core/BreathPattern';
import { BreathEngine, BreathListener, BreathPosition, EngineState } from '../main/ets/core/BreathEngine';
import { ManualTime } from '../main/ets/core/ManualTime';

class Recorder implements BreathListener {
  phases: string[] = [];
  starts: number[] = [];
  finished: number = 0;
  time: ManualTime;

  constructor(time: ManualTime) {
    this.time = time;
  }

  onPhase(pos: BreathPosition): void {
    this.phases.push(`${pos.cycle}:${pos.phase.type}:${pos.phaseElapsedMs}`);
    this.starts.push(this.time.now());
  }

  onFinish(): void {
    this.finished++;
  }
}

class LateTime extends ManualTime {
  lateMs: number;

  constructor(lateMs: number) {
    super();
    this.lateMs = lateMs;
  }

  schedule(delayMs: number, cb: () => void): number {
    return super.schedule(delayMs + this.lateMs, cb);
  }
}

export default function breathEngineTest() {
  describe('BreathPattern', () => {
    it('patternDurations', 0, () => {
      const free = new FreeRhythm();
      expect(PatternCatalog.build(PatternId.RELAX_478, free).cycleMs()).assertEqual(19000);
      expect(PatternCatalog.build(PatternId.CALM_4_6, free).cycleMs()).assertEqual(10000);
      expect(PatternCatalog.build(PatternId.BOX_4444, free).cycleMs()).assertEqual(16000);
      expect(PatternCatalog.build(PatternId.LONG_EXHALE_426, free).cycleMs()).assertEqual(12000);
      expect(PatternCatalog.build(PatternId.FREE, free).cycleMs()).assertEqual(10000);
    });

    it('stressPatternsMaxSixBreathsPerMinute', 0, () => {
      const free = new FreeRhythm(3, 4); // would be 8.6/min -> exhale is lengthened
      const ids = [PatternId.CALM_4_6, PatternId.BOX_4444, PatternId.LONG_EXHALE_426, PatternId.FREE];
      for (const id of ids) {
        expect(PatternCatalog.build(id, free).breathsPerMinute() <= 6.0001).assertTrue();
      }
    });

    it('freeRhythmClamp', 0, () => {
      const f = new FreeRhythm(1, 30).normalized();
      expect(f.inhaleSec).assertEqual(FreeRhythm.INHALE_MIN);
      expect(f.exhaleSec).assertEqual(FreeRhythm.EXHALE_MAX);
      const g = new FreeRhythm(4, 4).normalized();
      expect(g.inhaleSec + g.exhaleSec).assertEqual(10);
    });

    it('unknownIdFallsBackTo478', 0, () => {
      expect(PatternCatalog.parseId('nope')).assertEqual(PatternId.RELAX_478);
    });
  });

  describe('BreathEngine', () => {
    it('positionAtBoundaries', 0, () => {
      const p = PatternCatalog.build(PatternId.RELAX_478, new FreeRhythm());
      let pos = BreathEngine.positionAt(p, 2, 0);
      expect(pos.phase.type).assertEqual(PhaseType.INHALE);
      pos = BreathEngine.positionAt(p, 2, 4000);
      expect(pos.phase.type).assertEqual(PhaseType.HOLD_IN);
      expect(pos.phaseElapsedMs).assertEqual(0);
      pos = BreathEngine.positionAt(p, 2, 10999);
      expect(pos.phase.type).assertEqual(PhaseType.HOLD_IN);
      pos = BreathEngine.positionAt(p, 2, 11000);
      expect(pos.phase.type).assertEqual(PhaseType.EXHALE);
      pos = BreathEngine.positionAt(p, 2, 19000);
      expect(pos.cycle).assertEqual(1);
      expect(pos.phase.type).assertEqual(PhaseType.INHALE);
      pos = BreathEngine.positionAt(p, 2, 38000);
      expect(pos.finished).assertTrue();
    });

    it('exactPhaseTiming478', 0, () => {
      const t = new ManualTime();
      const rec = new Recorder(t);
      const e = new BreathEngine(PatternCatalog.build(PatternId.RELAX_478, new FreeRhythm()), 2, t, t, rec);
      e.start();
      t.advance(38000);
      expect(rec.phases.join(',')).assertEqual(
        '0:inhale:0,0:holdIn:0,0:exhale:0,1:inhale:0,1:holdIn:0,1:exhale:0');
      expect(rec.starts.join(',')).assertEqual('0,4000,11000,19000,23000,30000');
      expect(rec.finished).assertEqual(1);
      expect(e.getState()).assertEqual(EngineState.FINISHED);
      expect(e.completedCycles()).assertEqual(2);
    });

    it('pauseResumeKeepsPosition', 0, () => {
      const t = new ManualTime();
      const rec = new Recorder(t);
      const e = new BreathEngine(PatternCatalog.build(PatternId.BOX_4444, new FreeRhythm()), 1, t, t, rec);
      e.start();
      t.advance(5500); // 1.5 s into HOLD_IN
      e.pause();
      expect(t.pending()).assertEqual(0);
      t.advance(60000); // paused time does not count
      expect(e.elapsedMs()).assertEqual(5500);
      e.resume();
      expect(rec.phases[rec.phases.length - 1]).assertEqual('0:holdIn:1500');
      t.advance(2500);
      expect(rec.phases[rec.phases.length - 1]).assertEqual('0:exhale:0');
      t.advance(8000);
      expect(rec.finished).assertEqual(1);
      expect(e.elapsedMs()).assertEqual(16000);
    });

    it('cancelStopsEverything', 0, () => {
      const t = new ManualTime();
      const rec = new Recorder(t);
      const e = new BreathEngine(PatternCatalog.build(PatternId.CALM_4_6, new FreeRhythm()), 3, t, t, rec);
      e.start();
      t.advance(12000);
      e.cancel();
      expect(t.pending()).assertEqual(0);
      t.advance(100000);
      expect(rec.finished).assertEqual(0);
      expect(e.getState()).assertEqual(EngineState.CANCELLED);
      expect(e.completedCycles()).assertEqual(1);
    });

    it('restoreFromSnapshotMidPhase', 0, () => {
      const t = new ManualTime();
      const rec = new Recorder(t);
      const e = new BreathEngine(PatternCatalog.build(PatternId.RELAX_478, new FreeRhythm()), 3, t, t, rec);
      e.start(25000); // cycle 2, 2 s into HOLD_IN
      expect(rec.phases[0]).assertEqual('1:holdIn:2000');
      expect(e.completedCycles()).assertEqual(1);
      t.advance(5000);
      expect(rec.phases[1]).assertEqual('1:exhale:0');
    });

    it('lateTimerDoesNotDrift', 0, () => {
      // Every timer fires 37 ms late; the error must not accumulate over 20 phases.
      const t = new LateTime(37);
      const rec = new Recorder(t);
      const e = new BreathEngine(PatternCatalog.build(PatternId.CALM_4_6, new FreeRhythm()), 10, t, t, rec);
      e.start();
      t.advance(100100);
      expect(rec.finished).assertEqual(1);
      expect(rec.phases.length).assertEqual(20);
      expect(rec.starts[19]).assertEqual(94037);
      expect(e.elapsedMs()).assertEqual(100000);
    });
  });
}
