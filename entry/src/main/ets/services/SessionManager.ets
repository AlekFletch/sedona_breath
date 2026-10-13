import { hilog } from '@kit.PerformanceAnalysisKit';
import { PatternId } from '../core/BreathPattern';
import { SessionConfig, SessionController } from '../core/SessionController';
import { SessionRecord } from '../core/SessionRecord';
import { SessionMode, SessionStatus } from '../core/SessionTypes';
import { HealthKitService } from './HealthKitService';
import { HistoryRepository } from './HistoryRepository';
import { PlatformTime, wallClock } from './PlatformTime';
import { SettingsStore } from './SettingsStore';
import { VibratorHaptics } from './VibratorHaptics';

/** Owns the single active session and saves finished / interrupted ones. */
export class SessionManager {
  private static current: SessionController | undefined = undefined;
  /** Record prepared for the summary screen (completed sessions). */
  private static pendingRecord: SessionRecord | undefined = undefined;

  static configFromSettings(durationMin: number, mode: SessionMode, pattern: PatternId, vibration: boolean)
    : SessionConfig {
    const s = SettingsStore.INSTANCE.get();
    const c = new SessionConfig();
    c.durationMin = durationMin;
    c.mode = mode;
    c.patternId = pattern;
    c.free = s.freeRhythm();
    c.vibration = vibration;
    return c;
  }

  static async start(config: SessionConfig): Promise<SessionController> {
    SessionManager.dispose();
    const c = new SessionController(config, PlatformTime.INSTANCE, PlatformTime.INSTANCE, VibratorHaptics.INSTANCE,
      SettingsStore.INSTANCE, wallClock);
    c.setMessageSeed(await SessionManager.safeCount());
    SessionManager.current = c;
    c.start();
    return c;
  }

  /** Restores an unfinished session from the persisted snapshot; it comes back paused. */
  static async restore(): Promise<SessionController | undefined> {
    if (SessionManager.current !== undefined && !SessionManager.current.isEnded()) {
      return SessionManager.current;
    }
    const snap = SettingsStore.INSTANCE.loadSnapshot();
    if (snap === undefined) {
      return undefined;
    }
    const c = SessionController.fromSnapshot(snap, PlatformTime.INSTANCE, PlatformTime.INSTANCE,
      VibratorHaptics.INSTANCE, SettingsStore.INSTANCE, wallClock);
    c.setMessageSeed(await SessionManager.safeCount());
    SessionManager.current = c;
    return c;
  }

  static active(): SessionController | undefined {
    return SessionManager.current;
  }

  /** A session is open (running or paused) in this process. */
  static isRunning(): boolean {
    return SessionManager.current !== undefined && !SessionManager.current.isEnded();
  }

  static hasSnapshot(): boolean {
    return SettingsStore.INSTANCE.loadSnapshot() !== undefined;
  }

  /** "End now": nothing is saved. */
  static discard(): void {
    const c = SessionManager.current;
    if (c !== undefined) {
      c.discard();
    } else {
      SettingsStore.INSTANCE.clear();
    }
    SessionManager.current = undefined;
    SessionManager.pendingRecord = undefined;
  }

  /** "End and save": stored as INTERRUPTED with the stage where it stopped. */
  static async saveInterrupted(): Promise<void> {
    const c = SessionManager.current !== undefined ? SessionManager.current : await SessionManager.restore();
    if (c === undefined) {
      return;
    }
    c.shutdown();
    const r = c.buildRecord(SessionStatus.INTERRUPTED);
    await SessionManager.persist(r, false);
    SessionManager.discard();
  }

  /** Summary reached: freeze the completed record (with heart rate if consented). */
  static async prepareSummary(): Promise<SessionRecord | undefined> {
    const c = SessionManager.current;
    if (c === undefined) {
      return SessionManager.pendingRecord;
    }
    c.shutdown();
    const r = c.buildRecord(SessionStatus.COMPLETED);
    const s = SettingsStore.INSTANCE.get();
    if (s.healthEnabled && s.healthHeartRate) {
      r.heartRateAvg = await HealthKitService.INSTANCE.averageHeartRate(r.startedAt, r.endedAt);
    }
    SessionManager.pendingRecord = r;
    return r;
  }

  static summaryRecord(): SessionRecord | undefined {
    return SessionManager.pendingRecord;
  }

  /** "Save" on the summary screen. */
  static async saveCompleted(): Promise<boolean> {
    const r = SessionManager.pendingRecord;
    if (r === undefined) {
      return false;
    }
    const ok = await SessionManager.persist(r, true);
    if (ok) {
      SessionManager.discard();
    }
    return ok;
  }

  private static async persist(r: SessionRecord, completed: boolean): Promise<boolean> {
    try {
      r.id = await HistoryRepository.INSTANCE.insert(r);
      const s = SettingsStore.INSTANCE.get();
      if (completed && s.healthEnabled) {
        await HealthKitService.INSTANCE.savePractice(r);
      }
      return true;
    } catch (e) {
      hilog.error(0x0000, 'Session', 'save failed: %{public}s', JSON.stringify(e));
      return false;
    }
  }

  private static dispose(): void {
    if (SessionManager.current !== undefined) {
      SessionManager.current.shutdown();
    }
    SessionManager.current = undefined;
    SessionManager.pendingRecord = undefined;
  }

  private static async safeCount(): Promise<number> {
    try {
      return await HistoryRepository.INSTANCE.count();
    } catch (e) {
      return 0;
    }
  }
}
