import { i18n } from '@kit.LocalizationKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { AppLanguage } from './SettingsStore';

/**
 * App language. Resources: base = Russian (default), en/, es/.
 * SYSTEM -> resource manager picks en/es automatically, anything else falls
 * back to base (Russian).
 */
export class LanguageService {
  /** Returns true if a cold restart is needed for the change to apply (switch back to system language). */
  static apply(lang: AppLanguage): boolean {
    try {
      i18n.System.setAppPreferredLanguage(lang === AppLanguage.SYSTEM ? 'default' : lang);
      return lang === AppLanguage.SYSTEM;
    } catch (e) {
      hilog.warn(0x0000, 'Language', 'setAppPreferredLanguage failed: %{public}s', JSON.stringify(e));
      return false;
    }
  }
}
