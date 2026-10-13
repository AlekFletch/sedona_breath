import { abilityDelegatorRegistry } from '@kit.TestKit';
import { resourceManager } from '@kit.LocalizationKit';
import { describe, it, expect } from '@ohos/hypium';

/** Keys that must exist and be translated (not identical to Russian) in every language. */
const TRANSLATED_KEYS: string[] = [
  'q_1', 'q_2', 'q_3', 'q_4', 'q_5', 'ans_yes', 'ans_dontKnow', 'ans_skip', 'ans_now', 'ans_later',
  'ans_notNow', 'phase_inhale', 'phase_holdIn', 'phase_exhale', 'phase_holdOut', 'emotion_anger', 'emotion_anxiety',
  'emotion_fear', 'emotion_resentment', 'emotion_shame', 'emotion_guilt', 'emotion_irritation', 'emotion_sadness',
  'emotion_disappointment', 'emotion_fatigue', 'emotion_tension', 'emotion_other', 'onb_disclaimer',
  'msg_supportive', 'msg_professional', 'status_completed', 'status_interrupted', 'checkin_title'
];

function managerFor(locale: string): resourceManager.ResourceManager {
  const ctx = abilityDelegatorRegistry.getAbilityDelegator().getAppContext().createModuleContext('entry');
  const config = ctx.resourceManager.getConfigurationSync();
  config.locale = locale;
  return ctx.resourceManager.getOverrideResourceManager(config);
}

/** Runs on the watch / emulator against the real compiled resources of the entry module. */
export default function localizationTest() {
  describe('Localization', () => {
    it('russianQuestionsVerbatim', 0, () => {
      const ru = managerFor('ru_RU');
      expect(ru.getStringByNameSync('q_1')).assertEqual('Что я сейчас чувствую?');
      expect(ru.getStringByNameSync('q_2')).assertEqual('Смог бы я позволить этому чувству быть?');
      expect(ru.getStringByNameSync('q_3')).assertEqual('Смог бы я отпустить это чувство?');
      expect(ru.getStringByNameSync('q_4')).assertEqual('Хотел бы я отпустить это чувство?');
      expect(ru.getStringByNameSync('q_5')).assertEqual('Когда?');
    });

    it('englishAndSpanishAreTranslated', 0, () => {
      const ru = managerFor('ru_RU');
      const locales = ['en_US', 'es_ES'];
      for (const l of locales) {
        const m = managerFor(l);
        for (const k of TRANSLATED_KEYS) {
          const v = m.getStringByNameSync(k);
          expect(v.length > 0).assertTrue();
          expect(v === ru.getStringByNameSync(k)).assertFalse();
        }
      }
    });

    it('unsupportedLanguageFallsBackToRussian', 0, () => {
      expect(managerFor('de_DE').getStringByNameSync('q_1')).assertEqual('Что я сейчас чувствую?');
    });

    it('formatArguments', 0, () => {
      expect(managerFor('en_US').getStringByNameSync('question_counter', 2, 5)).assertEqual('Question 2 of 5');
      expect(managerFor('ru_RU').getStringByNameSync('fmt_rating', 4)).assertEqual('4 из 5');
    });
  });
}
