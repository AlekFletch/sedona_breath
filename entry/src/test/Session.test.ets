import { describe, it, expect } from '@ohos/hypium';
import { FreeRhythm, PatternCatalog, PatternId } from '../main/ets/core/BreathPattern';
import { PlanStep, SessionPlanner, StepKind } from '../main/ets/core/SessionPlan';
import { SessionConfig, SessionController, SessionObserver, SessionView, SnapshotSink } from '../main/ets/core/SessionController';
import { SessionSnapshot } from '../main/ets/core/SessionRecord';
import {
  Answer, Emotion, INTENSITY_FREE, INTENSITY_NONE, QuestionId, SessionMode, SessionStatus, Stage
} from '../main/ets/core/SessionTypes';
import { CompletionMessage, SupportRules } from '../main/ets/core/SupportRules';
import { ManualTime } from '../main/ets/core/ManualTime';
import { HapticDriver, LONG_PULSE_MS } from '../main/ets/core/Vibration';

class Haptics implements HapticDriver {
  pulses: number[] = [];
  stops: number = 0;

  pulse(durationMs: number): void {
    this.pulses.push(durationMs);
  }

  stop(): void {
    this.stops++;
  }
}

class Sink implements SnapshotSink {
  last: SessionSnapshot | undefined = undefined;
  cleared: number = 0;

  save(s: SessionSnapshot): void {
    this.last = s;
  }

  clear(): void {
    this.last = undefined;
    this.cleared++;
  }
}

class Watcher implements SessionObserver {
  summary: number = 0;
  stages: string[] = [];

  onUpdate(view: SessionView): void {
    const s: string = view.stage;
    if (this.stages.length === 0 || this.stages[this.stages.length - 1] !== s) {
      this.stages.push(s);
    }
  }

  onSummary(): void {
    this.summary++;
  }
}

function kinds(steps: PlanStep[]): string {
  return steps.map((s: PlanStep) => s.kind === StepKind.BREATH ? `B${s.cycles}` : s.kind).join(' ');
}

function config(mode: SessionMode, pattern: PatternId, minutes: number): SessionConfig {
  const c = new SessionConfig();
  c.mode = mode;
  c.patternId = pattern;
  c.durationMin = minutes;
  c.free = new FreeRhythm();
  c.vibration = true;
  return c;
}

/** Runs the breathing step to its end. */
function finishBreathing(t: ManualTime, c: SessionController): void {
  t.advance(c.remainingMs() + 60000 * 20);
}

/** Intro, the emotion and its intensity: to the lead-in breathing. */
function startBreathing(c: SessionController, intensity: number, emotion: Emotion = Emotion.TENSION): void {
  c.start();
  c.finishIntro();
  c.chooseEmotion(emotion);
  c.rateBefore(intensity);
}

export default function sessionTest() {
  describe('SessionPlanner', () => {
    it('fullMode478ThreeMinutes', 0, () => {
      const p = PatternCatalog.build(PatternId.RELAX_478, new FreeRhythm());
      const steps = SessionPlanner.build(3, SessionMode.FULL, p);
      expect(kinds(steps)).assertEqual(
        'intro emotion intensity B2 question B1 question B1 question B1 question completionBreath checkIn message');
      expect(steps[steps.length - 3].cycles).assertEqual(3);
    });

    it('quickModeThreeQuestions', 0, () => {
      const p = PatternCatalog.build(PatternId.CALM_4_6, new FreeRhythm());
      const steps = SessionPlanner.build(5, SessionMode.QUICK, p);
      // The extra time goes into the pauses between the questions, not into the lead-in.
      expect(kinds(steps)).assertEqual(
        'intro emotion intensity B2 question B9 question B8 question completionBreath checkIn message');
      expect(steps.filter((s: PlanStep) => s.kind === StepKind.QUESTION)[2].questionTotal).assertEqual(3);
    });

    it('shortSessionUsesOneCyclePauses', 0, () => {
      const p = PatternCatalog.build(PatternId.CALM_4_6, new FreeRhythm());
      const steps = SessionPlanner.build(2, SessionMode.QUICK, p);
      expect(kinds(steps)).assertEqual(
        'intro emotion intensity B2 question B1 question B1 question completionBreath checkIn message');
    });

    it('questionsStartEarlyAtAnyDuration', 0, () => {
      const p = PatternCatalog.build(PatternId.RELAX_478, new FreeRhythm());
      for (const d of [2, 3, 5, 7, 10]) {
        const steps = SessionPlanner.build(d, SessionMode.FULL, p);
        let i = 0;
        let before = 0;
        while (steps[i].kind !== StepKind.QUESTION) {
          if (steps[i].isBreathing()) {
            before += SessionPlanner.estimateMs(steps[i], p); // breathing before the first question
          }
          i++;
        }
        expect(before <= 60000).assertTrue();
      }
    });

    it('emotionAskedBeforeTheSession', 0, () => {
      const p = PatternCatalog.build(PatternId.RELAX_478, new FreeRhythm());
      const steps = SessionPlanner.build(3, SessionMode.QUICK, p, 1, false);
      expect(kinds(steps).indexOf('intro B2 question')).assertEqual(0);
      const t = new ManualTime();
      const sink = new Sink();
      const cfg = config(SessionMode.QUICK, PatternId.CALM_4_6, 3);
      cfg.presetEmotion = true;
      cfg.emotion = Emotion.ANGER;
      cfg.intensityBefore = 5;
      const c = new SessionController(cfg, t, t, new Haptics(), sink, () => 0);
      c.start();
      c.finishIntro();
      expect(c.view.stage).assertEqual(Stage.BREATHING);
      c.interrupt();
      const r = SessionController.fromSnapshot(sink.last as SessionSnapshot, t, t, new Haptics(), new Sink(), () => 0);
      expect(r.steps.length).assertEqual(c.steps.length);
      expect(r.view.emotion).assertEqual(Emotion.ANGER);
      expect(r.buildRecord(SessionStatus.INTERRUPTED).intensityBefore).assertEqual(5);
    });

    it('eachRoundAddsQuestionsWithoutEmotion', 0, () => {
      const p = PatternCatalog.build(PatternId.RELAX_478, new FreeRhythm());
      const one = SessionPlanner.build(3, SessionMode.FULL, p);
      const two = SessionPlanner.build(3, SessionMode.FULL, p, 2);
      expect(kinds(two.slice(0, one.length - 1))).assertEqual(kinds(one.slice(0, one.length - 1)));
      expect(kinds(two.slice(one.length - 1))).assertEqual(
        'B1 question B1 question B1 question B1 question completionBreath checkIn message');
      expect(two.filter((st: PlanStep) => st.kind === StepKind.EMOTION).length).assertEqual(1);
      expect(SessionPlanner.completionIndex(two, one.length)).assertEqual(two.length - 3);
    });

    it('longerDurationMeansMoreBreathing', 0, () => {
      const p = PatternCatalog.build(PatternId.BOX_4444, new FreeRhythm());
      let prev = 0;
      const durations = [2, 3, 5, 7, 10];
      for (const d of durations) {
        const total = SessionPlanner.totalEstimateMs(SessionPlanner.build(d, SessionMode.FULL, p), p);
        expect(total >= prev).assertTrue();
        prev = total;
      }
      const ten = SessionPlanner.totalEstimateMs(SessionPlanner.build(10, SessionMode.FULL, p), p);
      expect(Math.abs(ten - 600000) < 17000).assertTrue();
    });

    it('completionIs2to3CyclesWithin30to60s', 0, () => {
      const ids = [PatternId.RELAX_478, PatternId.CALM_4_6, PatternId.BOX_4444, PatternId.LONG_EXHALE_426, PatternId.FREE];
      for (const id of ids) {
        const p = PatternCatalog.build(id, new FreeRhythm());
        const n = SessionPlanner.completionCycles(p);
        expect(n >= 2 && n <= 3).assertTrue();
        expect(n * p.cycleMs() >= 30000 && n * p.cycleMs() <= 60000).assertTrue();
      }
    });
  });

  describe('SupportRules', () => {
    it('supportiveForStrongIntensityOnly', 0, () => {
      expect(SupportRules.completionMessage(5, 0)).assertEqual(CompletionMessage.SUPPORTIVE);
      expect(SupportRules.completionMessage(4, 5)).assertEqual(CompletionMessage.SUPPORTIVE);
      expect(SupportRules.completionMessage(3, 0) === CompletionMessage.SUPPORTIVE).assertFalse();
      expect(SupportRules.completionMessage(INTENSITY_FREE, 0) === CompletionMessage.SUPPORTIVE).assertFalse();
    });

    it('professionalHintForIntensity5OrFear', 0, () => {
      expect(SupportRules.recommendsProfessional(5, Emotion.NONE)).assertTrue();
      expect(SupportRules.recommendsProfessional(4, Emotion.NONE)).assertFalse();
      expect(SupportRules.recommendsProfessional(INTENSITY_NONE, Emotion.FEAR)).assertTrue();
      expect(SupportRules.recommendsProfessional(INTENSITY_FREE, Emotion.ANXIETY)).assertFalse();
    });
  });

  describe('SessionController', () => {
    it('fullScenarioToSummary', 0, () => {
      const t = new ManualTime();
      const h = new Haptics();
      const sink = new Sink();
      const w = new Watcher();
      const c = new SessionController(config(SessionMode.FULL, PatternId.CALM_4_6, 2), t, t, h, sink, () => 1000);
      c.setObserver(w);
      c.start();
      expect(c.view.stage).assertEqual(Stage.INTRO);
      t.advance(9000); // intro auto-advances after 3 slides
      expect(c.view.stage).assertEqual(Stage.EMOTION);
      c.chooseEmotion(Emotion.TENSION);
      expect(c.view.stage).assertEqual(Stage.INTENSITY);
      c.rateBefore(4);
      expect(c.view.stage).assertEqual(Stage.BREATHING);
      finishBreathing(t, c);
      expect(c.view.stage).assertEqual(Stage.QUESTION);
      expect(c.view.questionIndex).assertEqual(1);
      // The emotion choice replaced "What do I feel right now?": the questions start with "allow".
      expect(c.view.question).assertEqual(QuestionId.ALLOW);
      c.answer(Answer.YES);
      for (let q = 2; q <= 4; q++) {
        finishBreathing(t, c);
        expect(c.view.stage).assertEqual(Stage.QUESTION);
        expect(c.view.questionIndex).assertEqual(q);
        expect(c.view.questionTotal).assertEqual(4);
        c.answer(q === 4 ? Answer.NOW : Answer.DONT_KNOW);
      }
      expect(c.view.stage).assertEqual(Stage.COMPLETION_BREATHING);
      finishBreathing(t, c);
      expect(c.view.stage).assertEqual(Stage.CHECK_IN);
      expect(h.pulses[h.pulses.length - 1]).assertEqual(LONG_PULSE_MS);
      c.rate(INTENSITY_FREE);
      expect(c.view.stage).assertEqual(Stage.MESSAGE);
      c.finishMessage();
      expect(c.view.stage).assertEqual(Stage.SUMMARY);
      expect(w.summary).assertEqual(1);
      const r = c.buildRecord(SessionStatus.COMPLETED);
      expect(r.emotionBefore).assertEqual(Emotion.TENSION);
      expect(r.intensityBefore).assertEqual(4);
      expect(r.intensityAfter).assertEqual(INTENSITY_FREE);
      expect(r.rounds).assertEqual(1);
      expect(r.cycles).assertEqual(2 + 3 + 3);
      expect(r.stoppedAt).assertEqual('');
    });

    it('intensityLeftOffersOneMoreRound', 0, () => {
      const t = new ManualTime();
      const sink = new Sink();
      const c = new SessionController(config(SessionMode.QUICK, PatternId.CALM_4_6, 2), t, t, new Haptics(), sink,
        () => 0);
      startBreathing(c, 5);
      const toCheckIn = () => {
        while (c.view.stage !== Stage.CHECK_IN) {
          if (c.view.stage === Stage.QUESTION) {
            c.answer(Answer.YES);
          } else {
            finishBreathing(t, c);
          }
        }
      };
      toCheckIn();
      c.rate(3);
      expect(c.view.stage).assertEqual(Stage.CHECK_IN);
      expect(c.view.repeatOffer).assertTrue();
      c.repeat();
      expect(c.view.rounds).assertEqual(2);
      expect(c.view.stage).assertEqual(Stage.BREATHING);
      expect((sink.last as SessionSnapshot).rounds).assertEqual(2);
      finishBreathing(t, c);
      expect(c.view.stage).assertEqual(Stage.QUESTION);
      expect(c.view.questionIndex).assertEqual(1);
      toCheckIn();
      expect(c.view.repeatOffer).assertFalse();
      c.rate(2);
      c.finishRounds();
      expect(c.view.stage).assertEqual(Stage.MESSAGE);
      const r = c.buildRecord(SessionStatus.COMPLETED);
      expect(r.intensityBefore).assertEqual(5);
      expect(r.intensityAfter).assertEqual(2);
      expect(r.rounds).assertEqual(2);
    });

    it('restoredSecondRoundKeepsItsPlan', 0, () => {
      const t = new ManualTime();
      const sink = new Sink();
      const c = new SessionController(config(SessionMode.QUICK, PatternId.CALM_4_6, 2), t, t, new Haptics(), sink,
        () => 0);
      startBreathing(c, 3);
      while (c.view.stage !== Stage.CHECK_IN) {
        if (c.view.stage === Stage.QUESTION) {
          c.answer(Answer.NO);
        } else {
          finishBreathing(t, c);
        }
      }
      c.rate(4);
      c.repeat();
      finishBreathing(t, c);
      c.interrupt();
      const r = SessionController.fromSnapshot(sink.last as SessionSnapshot, t, t, new Haptics(), new Sink(), () => 0);
      expect(r.steps.length).assertEqual(c.steps.length);
      expect(r.view.stage).assertEqual(Stage.QUESTION);
      expect(r.view.rounds).assertEqual(2);
      expect(r.view.intensityAfter).assertEqual(4);
    });

    it('notNowReturnsGentlyToBreathing', 0, () => {
      const t = new ManualTime();
      const c = new SessionController(config(SessionMode.FULL, PatternId.CALM_4_6, 2), t, t, new Haptics(), new Sink(),
        () => 0);
      startBreathing(c, 3);
      while (c.view.stage !== Stage.QUESTION || c.view.question !== QuestionId.WHEN) {
        if (c.view.stage === Stage.QUESTION) {
          c.answer(Answer.SKIP);
        } else {
          finishBreathing(t, c);
        }
      }
      c.answer(Answer.NOT_NOW);
      expect(c.view.stage).assertEqual(Stage.COMPLETION_BREATHING);
      expect(c.view.notNowReturn).assertTrue();
    });

    it('fearShowsNoteThenContinues', 0, () => {
      const t = new ManualTime();
      const c = new SessionController(config(SessionMode.FULL, PatternId.CALM_4_6, 2), t, t, new Haptics(), new Sink(),
        () => 0);
      c.start();
      c.finishIntro();
      c.chooseEmotion(Emotion.FEAR);
      expect(c.view.stage).assertEqual(Stage.EMOTION);
      expect(c.view.emotionNote).assertTrue();
      c.acknowledgeEmotionNote();
      expect(c.view.stage).assertEqual(Stage.INTENSITY);
    });

    it('intensity5GivesSupportAndProfessionalHint', 0, () => {
      const t = new ManualTime();
      const c = new SessionController(config(SessionMode.QUICK, PatternId.CALM_4_6, 2), t, t, new Haptics(), new Sink(),
        () => 0);
      startBreathing(c, 5);
      while (c.view.stage !== Stage.CHECK_IN) {
        if (c.view.stage === Stage.QUESTION) {
          c.answer(Answer.YES);
        } else {
          finishBreathing(t, c);
        }
      }
      c.rate(5);
      c.finishRounds();
      expect(c.view.stage).assertEqual(Stage.MESSAGE);
      expect(c.view.message).assertEqual(CompletionMessage.SUPPORTIVE);
      expect(c.view.professionalHint).assertTrue();
    });

    it('pauseStopsTimeAndVibration', 0, () => {
      const t = new ManualTime();
      const h = new Haptics();
      const c = new SessionController(config(SessionMode.QUICK, PatternId.RELAX_478, 3), t, t, h, new Sink(), () => 0);
      startBreathing(c, 3);
      t.advance(1000);
      const pulses = h.pulses.length;
      const stops = h.stops;
      c.pause();
      expect(h.stops > stops).assertTrue();
      t.advance(30000);
      expect(h.pulses.length).assertEqual(pulses);
      expect(c.activeMs()).assertEqual(1000);
      expect(c.view.stage).assertEqual(Stage.BREATHING);
      c.resume();
      t.advance(1000);
      expect(c.activeMs()).assertEqual(2000);
      expect(h.pulses.length > pulses).assertTrue();
    });

    it('snapshotRestoreContinuesAtSamePlace', 0, () => {
      const t = new ManualTime();
      const sink = new Sink();
      const c = new SessionController(config(SessionMode.FULL, PatternId.RELAX_478, 5), t, t, new Haptics(), sink,
        () => 0);
      startBreathing(c, 3);
      t.advance(25000); // 2 s into HOLD_IN of cycle 2
      c.interrupt();
      const snap = sink.last as SessionSnapshot;
      expect(snap.stage).assertEqual(Stage.BREATHING);
      expect(snap.stepElapsedMs).assertEqual(25000);
      // Process is killed; restore from the persisted snapshot.
      const t2 = new ManualTime();
      const r = SessionController.fromSnapshot(snap, t2, t2, new Haptics(), new Sink(), () => 0);
      expect(r.isPaused()).assertTrue();
      expect(r.view.stage).assertEqual(Stage.BREATHING);
      expect(r.view.cycle).assertEqual(2);
      expect(r.activeMs()).assertEqual(snap.activeMs);
      r.resume();
      t2.advance(5000);
      expect(r.view.phase).assertEqual('exhale');
    });

    it('interruptedRecordKeepsStage', 0, () => {
      const t = new ManualTime();
      const sink = new Sink();
      const c = new SessionController(config(SessionMode.QUICK, PatternId.CALM_4_6, 3), t, t, new Haptics(), sink,
        () => 0);
      startBreathing(c, 3);
      finishBreathing(t, c);
      c.pause();
      const r = c.buildRecord(SessionStatus.INTERRUPTED);
      c.shutdown();
      expect(r.status).assertEqual(SessionStatus.INTERRUPTED);
      expect(r.stoppedAt).assertEqual(Stage.QUESTION);
      c.discard();
      expect(sink.cleared).assertEqual(1);
    });
  });
}
