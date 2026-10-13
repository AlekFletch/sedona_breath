import { batteryInfo } from '@kit.BasicServicesKit';

/** Low-battery check used during a session (polled, no extra permission). */
export class BatteryService {
  static readonly LOW_PERCENT: number = 10;

  static isLowAndNotCharging(): boolean {
    try {
      const soc = batteryInfo.batterySOC;
      const state = batteryInfo.chargingStatus;
      const charging = state === batteryInfo.BatteryChargeState.ENABLE || state === batteryInfo.BatteryChargeState.FULL;
      return soc >= 0 && soc <= BatteryService.LOW_PERCENT && !charging;
    } catch (e) {
      return false;
    }
  }
}
