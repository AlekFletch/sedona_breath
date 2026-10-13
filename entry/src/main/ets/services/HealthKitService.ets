import { healthStore } from '@kit.HealthServiceKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { SessionRecord } from '../core/SessionRecord';
import { AppContext } from './AppContext';

const TAG = 'HealthKit';

export enum HealthResult {
  GRANTED = 'granted',
  DENIED = 'denied',
  UNAVAILABLE = 'unavailable'
}

/**
 * Optional Huawei Health (Health Service Kit) integration.
 *
 *  - Nothing is requested until the user explicitly enables it in Settings
 *    after reading the explanation.
 *  - Heart rate is read only with a separate consent and only for the time
 *    window of the practice (average shown in the summary, stored locally).
 *  - Writing the practice itself: Health Service Kit (checked up to API 24)
 *    has no data type for breathing / mindfulness sessions, so writing is
 *    disabled by PRACTICE_WRITE_SUPPORTED. Do not map it to WORKOUT: it would
 *    pollute the user's activity statistics. See docs/HEALTH_KIT.md.
 *  - Every call fails soft: the app works fully without Health Kit.
 */
export class HealthKitService {
  static readonly INSTANCE: HealthKitService = new HealthKitService();
  static readonly PRACTICE_WRITE_SUPPORTED: boolean = false;

  private initialized: boolean = false;

  isAvailable(): boolean {
    return canIUse('SystemCapability.Health.HealthStore');
  }

  /** Called after the user agreed on the explanation screen. */
  async connect(withHeartRate: boolean): Promise<HealthResult> {
    if (!this.isAvailable()) {
      return HealthResult.UNAVAILABLE;
    }
    try {
      await this.ensureInit();
      const read: healthStore.DataType[] = withHeartRate ? [healthStore.samplePointHelper.heartRate.DATA_TYPE] : [];
      const write: healthStore.DataType[] = [];
      if (read.length === 0 && write.length === 0) {
        return HealthResult.GRANTED; // nothing to authorize in this version
      }
      const request: healthStore.AuthorizationRequest = { readDataTypes: read, writeDataTypes: write };
      const response = await healthStore.requestAuthorizations(AppContext.context(), request);
      const granted = response.readDataTypes.some((t: healthStore.DataType) =>
        t.id === healthStore.samplePointHelper.heartRate.DATA_TYPE.id);
      return granted ? HealthResult.GRANTED : HealthResult.DENIED;
    } catch (e) {
      hilog.warn(0x0000, TAG, 'connect failed: %{public}s', JSON.stringify(e));
      return HealthResult.UNAVAILABLE;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isAvailable() || !this.initialized) {
      return;
    }
    try {
      await healthStore.cancelAuthorizations();
    } catch (e) {
      hilog.warn(0x0000, TAG, 'cancelAuthorizations failed: %{public}s', JSON.stringify(e));
    }
  }

  /** Average heart rate in [startMs, endMs], 0 if not available. */
  async averageHeartRate(startMs: number, endMs: number): Promise<number> {
    if (!this.isAvailable() || endMs <= startMs) {
      return 0;
    }
    try {
      await this.ensureInit();
      const request: healthStore.SamplePointReadRequest = {
        samplePointDataType: healthStore.samplePointHelper.heartRate.DATA_TYPE,
        startTime: startMs,
        endTime: endMs
      };
      const points = await healthStore.readData<healthStore.samplePointHelper.heartRate.Model>(request);
      let sum = 0;
      let n = 0;
      for (const p of points) {
        const bpm = p.fields.bpm;
        if (bpm > 0) {
          sum += bpm;
          n++;
        }
      }
      return n > 0 ? Math.round(sum / n) : 0;
    } catch (e) {
      hilog.warn(0x0000, TAG, 'readData failed: %{public}s', JSON.stringify(e));
      return 0;
    }
  }

  /** Writes a completed practice. Disabled until Health Kit offers a suitable data type. */
  async savePractice(record: SessionRecord): Promise<boolean> {
    if (!HealthKitService.PRACTICE_WRITE_SUPPORTED || !this.isAvailable()) {
      return false;
    }
    hilog.info(0x0000, TAG, 'practice write not implemented for %{public}d', record.id);
    return false;
  }

  private async ensureInit(): Promise<void> {
    if (!this.initialized) {
      await healthStore.init(AppContext.context());
      this.initialized = true;
    }
  }
}
