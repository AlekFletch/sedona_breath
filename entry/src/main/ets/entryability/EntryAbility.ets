import { AbilityConstant, UIAbility, Want } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { window } from '@kit.ArkUI';
import { AppContext } from '../services/AppContext';
import { AppEvent, AppEvents } from '../services/AppEvents';
import { HistoryRepository } from '../services/HistoryRepository';
import { LanguageService } from '../services/LanguageService';
import { SettingsStore } from '../services/SettingsStore';

const TAG = 'EntryAbility';
/** Want parameter used by the watch-face card to start a 3-minute practice. */
export const PARAM_QUICK_START = 'quickStart';

export default class EntryAbility extends UIAbility {
  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    AppContext.init(this.context);
    SettingsStore.INSTANCE.init(this.context);
    LanguageService.apply(SettingsStore.INSTANCE.get().language);
    this.handleWant(want);
  }

  onNewWant(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    this.handleWant(want);
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    AppContext.setWindowStage(windowStage);
    HistoryRepository.INSTANCE.init(this.context).catch((e: Error) => {
      hilog.error(0x0000, TAG, 'history init failed: %{public}s', e.message);
    }).finally(() => {
      windowStage.loadContent('pages/Index', (err) => {
        if (err.code) {
          hilog.error(0x0000, TAG, 'loadContent failed: %{public}s', JSON.stringify(err));
        }
      });
    });
  }

  onWindowStageDestroy(): void {
    AppContext.setWindowStage(undefined);
  }

  onForeground(): void {
    AppEvents.emit(AppEvent.FOREGROUND);
  }

  /** Screen off, watch face, incoming call, app switch: the running session pauses and persists. */
  onBackground(): void {
    AppEvents.emit(AppEvent.BACKGROUND);
  }

  private handleWant(want: Want): void {
    const params = want.parameters;
    if (params !== undefined && params[PARAM_QUICK_START] !== undefined) {
      AppEvents.emit(AppEvent.QUICK_START);
    }
  }
}
