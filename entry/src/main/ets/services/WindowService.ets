import { hilog } from '@kit.PerformanceAnalysisKit';
import { AppContext } from './AppContext';

/** Keeps the screen on while breathing guidance is running. */
export class WindowService {
  static setKeepScreenOn(on: boolean): void {
    const stage = AppContext.stage();
    if (stage === undefined) {
      return;
    }
    try {
      stage.getMainWindowSync().setWindowKeepScreenOn(on).catch((e: Error) => {
        hilog.warn(0x0000, 'Window', 'keepScreenOn failed: %{public}s', e.message);
      });
    } catch (e) {
      hilog.warn(0x0000, 'Window', 'keepScreenOn threw: %{public}s', JSON.stringify(e));
    }
  }
}
