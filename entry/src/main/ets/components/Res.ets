/*
 * Enum -> string resource mapping. $r() needs literal keys, hence the switches.
 * No user-visible text lives in code: everything comes from resources/{base,en,es}/element/string.json.
 */
import { PatternId, PhaseType } from '../core/BreathPattern';
import { Answer, Emotion, SessionMode, SessionStatus } from '../core/SessionTypes';
import { CompletionMessage } from '../core/SupportRules';
import { AppLanguage } from '../services/SettingsStore';

export class Res {
  static pattern(id: PatternId): Resource {
    switch (id) {
      case PatternId.CALM_4_6:
        return $r('app.string.pattern_calm46');
      case PatternId.BOX_4444:
        return $r('app.string.pattern_box4444');
      case PatternId.LONG_EXHALE_426:
        return $r('app.string.pattern_longExhale426');
      case PatternId.FREE:
        return $r('app.string.pattern_free');
      default:
        return $r('app.string.pattern_relax478');
    }
  }

  static mode(mode: SessionMode): Resource {
    return mode === SessionMode.QUICK ? $r('app.string.mode_quick') : $r('app.string.mode_full');
  }

  static phase(phase: PhaseType): Resource {
    switch (phase) {
      case PhaseType.HOLD_IN:
        return $r('app.string.phase_holdIn');
      case PhaseType.EXHALE:
        return $r('app.string.phase_exhale');
      case PhaseType.HOLD_OUT:
        return $r('app.string.phase_holdOut');
      default:
        return $r('app.string.phase_inhale');
    }
  }

  static question(q: number): Resource {
    switch (q) {
      case 2:
        return $r('app.string.q_2');
      case 3:
        return $r('app.string.q_3');
      case 4:
        return $r('app.string.q_4');
      case 5:
        return $r('app.string.q_5');
      default:
        return $r('app.string.q_1');
    }
  }

  static answer(a: Answer): Resource {
    switch (a) {
      case Answer.YES:
        return $r('app.string.ans_yes');
      case Answer.NO:
        return $r('app.string.ans_no');
      case Answer.DONT_KNOW:
        return $r('app.string.ans_dontKnow');
      case Answer.NOW:
        return $r('app.string.ans_now');
      case Answer.LATER:
        return $r('app.string.ans_later');
      case Answer.NOT_NOW:
        return $r('app.string.ans_notNow');
      case Answer.CONTINUE:
        return $r('app.string.ans_continue');
      default:
        return $r('app.string.ans_skip');
    }
  }

  static emotion(e: Emotion): Resource {
    switch (e) {
      case Emotion.ANGER:
        return $r('app.string.emotion_anger');
      case Emotion.ANXIETY:
        return $r('app.string.emotion_anxiety');
      case Emotion.FEAR:
        return $r('app.string.emotion_fear');
      case Emotion.RESENTMENT:
        return $r('app.string.emotion_resentment');
      case Emotion.SHAME:
        return $r('app.string.emotion_shame');
      case Emotion.GUILT:
        return $r('app.string.emotion_guilt');
      case Emotion.IRRITATION:
        return $r('app.string.emotion_irritation');
      case Emotion.SADNESS:
        return $r('app.string.emotion_sadness');
      case Emotion.DISAPPOINTMENT:
        return $r('app.string.emotion_disappointment');
      case Emotion.FATIGUE:
        return $r('app.string.emotion_fatigue');
      case Emotion.TENSION:
        return $r('app.string.emotion_tension');
      case Emotion.OTHER:
        return $r('app.string.emotion_other');
      default:
        return $r('app.string.dash');
    }
  }

  static stage(stage: string): Resource {
    switch (stage) {
      case 'intro':
        return $r('app.string.stage_intro');
      case 'question':
        return $r('app.string.stage_question');
      case 'emotion':
        return $r('app.string.stage_emotion');
      case 'completionBreathing':
        return $r('app.string.stage_completionBreathing');
      case 'checkIn':
        return $r('app.string.stage_checkIn');
      case 'message':
        return $r('app.string.stage_message');
      case 'summary':
        return $r('app.string.stage_summary');
      default:
        return $r('app.string.stage_breathing');
    }
  }

  static status(s: SessionStatus): Resource {
    return s === SessionStatus.INTERRUPTED ? $r('app.string.status_interrupted') : $r('app.string.status_completed');
  }

  static message(m: CompletionMessage): Resource {
    switch (m) {
      case CompletionMessage.GENTLE_2:
        return $r('app.string.msg_gentle2');
      case CompletionMessage.GENTLE_3:
        return $r('app.string.msg_gentle3');
      case CompletionMessage.SUPPORTIVE:
        return $r('app.string.msg_supportive');
      default:
        return $r('app.string.msg_gentle1');
    }
  }

  static language(l: AppLanguage): Resource {
    switch (l) {
      case AppLanguage.RU:
        return $r('app.string.lang_ru');
      case AppLanguage.EN:
        return $r('app.string.lang_en');
      case AppLanguage.ES:
        return $r('app.string.lang_es');
      default:
        return $r('app.string.lang_system');
    }
  }

  static onOff(on: boolean): Resource {
    return on ? $r('app.string.on') : $r('app.string.off');
  }
}
