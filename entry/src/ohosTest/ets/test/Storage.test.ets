import { abilityDelegatorRegistry } from '@kit.TestKit';
import { describe, it, expect, beforeAll } from '@ohos/hypium';
import { PatternId } from '../../../main/ets/core/BreathPattern';
import { SessionRecord, SessionSnapshot } from '../../../main/ets/core/SessionRecord';
import { Emotion, SessionMode, SessionStatus, Stage } from '../../../main/ets/core/SessionTypes';
import { HistoryRepository, startOfToday } from '../../../main/ets/services/HistoryRepository';
import { AppLanguage, SettingsStore } from '../../../main/ets/services/SettingsStore';

function record(startedAt: number, status: SessionStatus): SessionRecord {
  const r = new SessionRecord();
  r.startedAt = startedAt;
  r.endedAt = startedAt + 180000;
  r.durationSec = 180;
  r.plannedMin = 3;
  r.mode = SessionMode.FULL;
  r.patternId = PatternId.BOX_4444;
  r.cycles = 9;
  r.status = status;
  r.stoppedAt = status === SessionStatus.INTERRUPTED ? Stage.QUESTION : '';
  r.emotionBefore = Emotion.TENSION;
  r.ratingAfter = 4;
  return r;
}

/** Runs on the watch / emulator: real Preferences + RelationalStore, isolated test files. */
export default function storageTest() {
  const ctx = abilityDelegatorRegistry.getAbilityDelegator().getAppContext();

  describe('SettingsStore', () => {
    beforeAll(() => {
      SettingsStore.INSTANCE.init(ctx, 'test_settings');
    });

    it('roundTripSettings', 0, () => {
      const s = SettingsStore.INSTANCE.copy();
      s.language = AppLanguage.ES;
      s.defaultPattern = PatternId.CALM_4_6;
      s.defaultDurationMin = 7;
      s.vibration = false;
      SettingsStore.INSTANCE.update(s);
      SettingsStore.INSTANCE.init(ctx, 'test_settings_other');
      SettingsStore.INSTANCE.init(ctx, 'test_settings'); // re-read from the store
      const r = SettingsStore.INSTANCE.get();
      expect(r.language).assertEqual(AppLanguage.ES);
      expect(r.defaultPattern).assertEqual(PatternId.CALM_4_6);
      expect(r.defaultDurationMin).assertEqual(7);
      expect(r.vibration).assertFalse();
    });

    it('snapshotSaveLoadClear', 0, () => {
      const snap = new SessionSnapshot();
      snap.stepIndex = 4;
      snap.stepElapsedMs = 12345;
      snap.emotion = Emotion.FEAR;
      snap.stage = Stage.BREATHING;
      SettingsStore.INSTANCE.save(snap);
      const back = SettingsStore.INSTANCE.loadSnapshot();
      expect(back !== undefined).assertTrue();
      expect((back as SessionSnapshot).stepElapsedMs).assertEqual(12345);
      expect((back as SessionSnapshot).emotion).assertEqual(Emotion.FEAR);
      SettingsStore.INSTANCE.clear();
      expect(SettingsStore.INSTANCE.loadSnapshot() === undefined).assertTrue();
    });
  });

  describe('HistoryRepository', () => {
    beforeAll(async () => {
      await HistoryRepository.INSTANCE.init(ctx, 'test_history.db');
      await HistoryRepository.INSTANCE.deleteAll();
    });

    it('insertQueryOrderAndToday', 0, async () => {
      const today = startOfToday();
      await HistoryRepository.INSTANCE.insert(record(today - 86400000, SessionStatus.COMPLETED));
      await HistoryRepository.INSTANCE.insert(record(today + 1000, SessionStatus.COMPLETED));
      await HistoryRepository.INSTANCE.insert(record(today + 2000, SessionStatus.INTERRUPTED));
      const rows = await HistoryRepository.INSTANCE.latest(10);
      expect(rows.length).assertEqual(3);
      expect(rows[0].status).assertEqual(SessionStatus.INTERRUPTED);
      expect(rows[0].stoppedAt).assertEqual(Stage.QUESTION);
      expect(rows[0].emotionBefore).assertEqual(Emotion.TENSION);
      expect(rows[0].patternId).assertEqual(PatternId.BOX_4444);
      expect(await HistoryRepository.INSTANCE.countSince(today)).assertEqual(2);
      const last = await HistoryRepository.INSTANCE.lastCompleted();
      expect((last as SessionRecord).startedAt).assertEqual(today + 1000);
    });

    it('latestLimitedToTen', 0, async () => {
      await HistoryRepository.INSTANCE.deleteAll();
      for (let i = 0; i < 12; i++) {
        await HistoryRepository.INSTANCE.insert(record(1000 + i, SessionStatus.COMPLETED));
      }
      const rows = await HistoryRepository.INSTANCE.latest(10);
      expect(rows.length).assertEqual(10);
      expect(rows[0].startedAt).assertEqual(1011);
    });

    it('deleteAllEmptiesHistory', 0, async () => {
      await HistoryRepository.INSTANCE.deleteAll();
      expect(await HistoryRepository.INSTANCE.count()).assertEqual(0);
      expect((await HistoryRepository.INSTANCE.latest(10)).length).assertEqual(0);
    });
  });
}
