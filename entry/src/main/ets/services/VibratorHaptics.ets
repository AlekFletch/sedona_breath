import { vibrator } from '@kit.SensorServiceKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { HapticDriver } from '../core/Vibration';

const TAG = 'Haptics';

/**
 * HapticDriver on top of @ohos.vibrator (API 9+). Each cue is a separate
 * time-based vibration; timing between cues is done by VibrationScheduler.
 *
 * Usage 'alarm' is chosen so that guidance pulses are not muted by the
 * system "touch feedback" switch; Do Not Disturb behaviour depends on the
 * firmware (check on the device, see docs/LIMITATIONS.md).
 */
export class VibratorHaptics implements HapticDriver {
  static readonly INSTANCE: VibratorHaptics = new VibratorHaptics();

  pulse(durationMs: number): void {
    try {
      const effect: vibrator.VibrateTime = { type: 'time', duration: durationMs };
      const attribute: vibrator.VibrateAttribute = { id: 0, usage: 'alarm' };
      vibrator.startVibration(effect, attribute).catch((e: Error) => {
        hilog.warn(0x0000, TAG, 'startVibration failed: %{public}s', e.message);
      });
    } catch (e) {
      hilog.warn(0x0000, TAG, 'startVibration threw: %{public}s', JSON.stringify(e));
    }
  }

  stop(): void {
    try {
      vibrator.stopVibration().catch((e: Error) => {
        hilog.debug(0x0000, TAG, 'stopVibration: %{public}s', e.message);
      });
    } catch (e) {
      hilog.debug(0x0000, TAG, 'stopVibration threw: %{public}s', JSON.stringify(e));
    }
  }
}
