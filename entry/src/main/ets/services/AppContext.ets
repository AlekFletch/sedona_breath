import { common } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';

/** Process-wide handles set by EntryAbility. */
export class AppContext {
  private static abilityContext: common.UIAbilityContext | undefined = undefined;
  private static windowStage: window.WindowStage | undefined = undefined;

  static init(context: common.UIAbilityContext): void {
    AppContext.abilityContext = context;
  }

  static setWindowStage(stage: window.WindowStage | undefined): void {
    AppContext.windowStage = stage;
  }

  static context(): common.UIAbilityContext {
    if (AppContext.abilityContext === undefined) {
      throw new Error('AppContext is not initialized');
    }
    return AppContext.abilityContext;
  }

  static stage(): window.WindowStage | undefined {
    return AppContext.windowStage;
  }
}
