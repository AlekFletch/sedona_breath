import { preferences } from '@kit.ArkData';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { DEFAULT_PATTERN, FreeRhythm, PatternCatalog, PatternId } from '../core/BreathPattern';
import { DEFAULT_DURATION_MIN, SessionMode, parseDuration, parseMode } from '../core/SessionTypes';
import { SessionSnapshot } from '../core/SessionRecord';
import { SnapshotSink } from '../core/SessionController';
import { common } from '@kit.AbilityKit';

export enum AppLanguage {
  SYSTEM = 'system',
  RU = 'ru',
  EN = 'en',
  ES = 'es'
}

export const LANGUAGES: AppLanguage[] = [AppLanguage.SYSTEM, AppLanguage.RU, AppLanguage.EN, AppLanguage.ES];

export class AppSettings {
  onboardingAccepted: boolean = false;
  language: AppLanguage = AppLanguage.SYSTEM;
  defaultPattern: PatternId = DEFAULT_PATTERN;
  defaultDurationMin: number = DEFAULT_DURATION_MIN;
  defaultMode: SessionMode = SessionMode.FULL;
  vibration: boolean = true;
  freeInhaleSec: number = FreeRhythm.DEFAULT_INHALE;
  freeExhaleSec: number = FreeRhythm.DEFAULT_EXHALE;
  /** User explicitly agreed to connect Huawei Health. */
  healthEnabled: boolean = false;
  /** Separate consent for heart rate. */
  healthHeartRate: boolean = false;

  freeRhythm(): FreeRhythm {
    return new FreeRhythm(this.freeInhaleSec, this.freeExhaleSec).normalized();
  }
}

const STORE = 'sedona_settings';
const K_ONBOARDING = 'onboardingAccepted';
const K_LANGUAGE = 'language';
const K_PATTERN = 'defaultPattern';
const K_DURATION = 'defaultDuration';
const K_MODE = 'defaultMode';
const K_VIBRATION = 'vibration';
const K_FREE_IN = 'freeInhale';
const K_FREE_OUT = 'freeExhale';
const K_HEALTH = 'healthEnabled';
const K_HEALTH_HR = 'healthHeartRate';
const K_SNAPSHOT = 'activeSession';

/**
 * Settings and the in-progress session snapshot live in Preferences:
 * a handful of small key/value items, read synchronously at start-up,
 * no queries needed. History lives in RelationalStore (see HistoryRepository).
 */
export class SettingsStore implements SnapshotSink {
  static readonly INSTANCE: SettingsStore = new SettingsStore();

  private prefs: preferences.Preferences | undefined = undefined;
  private cached: AppSettings = new AppSettings();
  private storeName: string = STORE;

  /** `name` is overridden only by instrumented tests. */
  init(context: common.Context, name: string = STORE): void {
    if (this.prefs !== undefined && this.storeName === name) {
      return;
    }
    this.storeName = name;
    const options: preferences.Options = { name: name };
    this.prefs = preferences.getPreferencesSync(context, options);
    this.cached = this.read();
  }

  get(): AppSettings {
    return this.cached;
  }

  update(s: AppSettings): void {
    this.cached = s;
    try {
      this.write(s);
    } catch (e) {
      hilog.error(0x0000, 'Settings', 'settings save failed: %{public}s', JSON.stringify(e));
    }
  }

  private write(s: AppSettings): void {
    const p = this.store();
    p.putSync(K_ONBOARDING, s.onboardingAccepted);
    p.putSync(K_LANGUAGE, s.language);
    p.putSync(K_PATTERN, s.defaultPattern);
    p.putSync(K_DURATION, s.defaultDurationMin);
    p.putSync(K_MODE, s.defaultMode);
    p.putSync(K_VIBRATION, s.vibration);
    p.putSync(K_FREE_IN, s.freeInhaleSec);
    p.putSync(K_FREE_OUT, s.freeExhaleSec);
    p.putSync(K_HEALTH, s.healthEnabled);
    p.putSync(K_HEALTH_HR, s.healthHeartRate);
    this.flush();
  }

  /** Returns a mutable copy to edit and pass back to update(). */
  copy(): AppSettings {
    const s = new AppSettings();
    const c = this.cached;
    s.onboardingAccepted = c.onboardingAccepted;
    s.language = c.language;
    s.defaultPattern = c.defaultPattern;
    s.defaultDurationMin = c.defaultDurationMin;
    s.defaultMode = c.defaultMode;
    s.vibration = c.vibration;
    s.freeInhaleSec = c.freeInhaleSec;
    s.freeExhaleSec = c.freeExhaleSec;
    s.healthEnabled = c.healthEnabled;
    s.healthHeartRate = c.healthHeartRate;
    return s;
  }

  // ------------------------------------------------------ SnapshotSink

  save(snapshot: SessionSnapshot): void {
    try {
      this.store().putSync(K_SNAPSHOT, JSON.stringify(snapshot));
      this.flush();
    } catch (e) {
      hilog.warn(0x0000, 'Settings', 'snapshot save failed: %{public}s', JSON.stringify(e));
    }
  }

  clear(): void {
    try {
      this.store().deleteSync(K_SNAPSHOT);
      this.flush();
    } catch (e) {
      hilog.warn(0x0000, 'Settings', 'snapshot clear failed: %{public}s', JSON.stringify(e));
    }
  }

  loadSnapshot(): SessionSnapshot | undefined {
    try {
      const raw = this.store().getSync(K_SNAPSHOT, '') as string;
      if (raw.length === 0) {
        return undefined;
      }
      const parsed = JSON.parse(raw) as SessionSnapshot;
      const s = new SessionSnapshot();
      s.version = parsed.version;
      s.savedAt = parsed.savedAt;
      s.startedAt = parsed.startedAt;
      s.durationMin = parsed.durationMin;
      s.mode = parsed.mode;
      s.patternId = parsed.patternId;
      s.freeInhaleSec = parsed.freeInhaleSec;
      s.freeExhaleSec = parsed.freeExhaleSec;
      s.vibration = parsed.vibration;
      s.stepIndex = parsed.stepIndex;
      s.stepElapsedMs = parsed.stepElapsedMs;
      s.activeMs = parsed.activeMs;
      s.cyclesDone = parsed.cyclesDone;
      s.emotion = parsed.emotion;
      s.rating = parsed.rating;
      s.stage = parsed.stage;
      return s;
    } catch (e) {
      this.clear();
      return undefined;
    }
  }

  // ------------------------------------------------------ internal

  private read(): AppSettings {
    try {
      return this.readUnsafe();
    } catch (e) {
      hilog.error(0x0000, 'Settings', 'settings read failed: %{public}s', JSON.stringify(e));
      return new AppSettings();
    }
  }

  private readUnsafe(): AppSettings {
    const p = this.store();
    const s = new AppSettings();
    s.onboardingAccepted = p.getSync(K_ONBOARDING, false) as boolean;
    s.language = parseLanguage(p.getSync(K_LANGUAGE, AppLanguage.SYSTEM) as string);
    s.defaultPattern = PatternCatalog.parseId(p.getSync(K_PATTERN, DEFAULT_PATTERN) as string);
    s.defaultDurationMin = parseDuration(p.getSync(K_DURATION, DEFAULT_DURATION_MIN) as number);
    s.defaultMode = parseMode(p.getSync(K_MODE, SessionMode.FULL) as string);
    s.vibration = p.getSync(K_VIBRATION, true) as boolean;
    s.freeInhaleSec = p.getSync(K_FREE_IN, FreeRhythm.DEFAULT_INHALE) as number;
    s.freeExhaleSec = p.getSync(K_FREE_OUT, FreeRhythm.DEFAULT_EXHALE) as number;
    s.healthEnabled = p.getSync(K_HEALTH, false) as boolean;
    s.healthHeartRate = p.getSync(K_HEALTH_HR, false) as boolean;
    return s;
  }

  private store(): preferences.Preferences {
    if (this.prefs === undefined) {
      throw new Error('SettingsStore is not initialized');
    }
    return this.prefs;
  }

  private flush(): void {
    this.store().flush().catch((e: Error) => {
      hilog.warn(0x0000, 'Settings', 'flush failed: %{public}s', e.message);
    });
  }
}

export function parseLanguage(value: string): AppLanguage {
  for (const l of LANGUAGES) {
    if (l === value) {
      return l;
    }
  }
  return AppLanguage.SYSTEM;
}
