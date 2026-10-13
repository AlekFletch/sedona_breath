import { PhaseType } from '../core/BreathPattern';
import { BreathVisual, SessionController, SessionObserver, SessionView } from '../core/SessionController';
import { Answer, EMOTIONS, Emotion, RATING_NONE, Stage, answersFor } from '../core/SessionTypes';
import { CompletionMessage } from '../core/SupportRules';
import { formatMmSs } from '../core/Timing';
import { AppEvent, AppEvents } from '../services/AppEvents';
import { BatteryService } from '../services/BatteryService';
import { SessionManager } from '../services/SessionManager';
import { WindowService } from '../services/WindowService';
import { Res } from '../components/Res';
import { PrimaryButton, ROUTE_SUMMARY, STORAGE_HISTORY_REV, SecondaryButton } from '../components/Ui';

enum Overlay {
  NONE = 0,
  PAUSED = 1,
  END_CONFIRM = 2,
  INTERRUPTED = 3,
  LOW_BATTERY = 4
}

const UI_TICK_MS = 500;
const BATTERY_CHECK_MS = 30000;

/**
 * Screens 3-7 of a running session: intro, breathing, Sedona prompt, emotion,
 * completion breathing, check-in, completion message. One NavDestination keeps
 * the engine alive across stages; each stage is its own full-screen view.
 */
@Component
export struct SessionPage {
  @Consume('nav') nav: NavPathStack;
  @State view: SessionView = new SessionView();
  @State circleScale: number = BreathVisual.MIN_SCALE;
  @State remaining: string = '';
  @State modal: Overlay = Overlay.NONE;
  private controller: SessionController | undefined = undefined;
  private uiTimer: number = -1;
  private lastBatteryCheck: number = 0;
  private lastPhaseKey: string = '';
  private leaving: boolean = false;

  private observer: SessionObserver = new CallbackObserver(
    (v: SessionView) => this.onControllerUpdate(v), () => this.goToSummary());

  private appListener: (e: AppEvent) => void = (e: AppEvent) => {
    if (e === AppEvent.BACKGROUND) {
      this.onInterrupted(Overlay.INTERRUPTED);
    }
  };

  aboutToAppear(): void {
    const c = SessionManager.active();
    if (c === undefined) {
      this.leaving = true;
      this.nav.pop(false);
      return;
    }
    this.controller = c;
    c.setObserver(this.observer);
    this.onControllerUpdate(c.view);
    if (c.isPaused()) {
      this.modal = Overlay.INTERRUPTED; // restored after an interruption
    }
    AppEvents.on(this.appListener);
    WindowService.setKeepScreenOn(true);
    this.uiTimer = setInterval(() => this.onUiTick(), UI_TICK_MS);
    this.onUiTick();
  }

  aboutToDisappear(): void {
    AppEvents.off(this.appListener);
    if (this.uiTimer >= 0) {
      clearInterval(this.uiTimer);
      this.uiTimer = -1;
    }
    WindowService.setKeepScreenOn(false);
    if (this.controller !== undefined) {
      this.controller.setObserver(undefined);
      if (!this.leaving) {
        // Swiped away by the system: keep the progress, stop guidance.
        this.controller.interrupt();
      }
    }
  }

  // ------------------------------------------------------------ controller

  private onControllerUpdate(v: SessionView): void {
    this.view = cloneView(v);
    const breathing = v.stage === Stage.BREATHING || v.stage === Stage.COMPLETION_BREATHING;
    const key = `${v.stepIndex}:${v.cycle}:${v.phase}:${v.phaseElapsedMs}:${v.paused}`;
    if (breathing && key !== this.lastPhaseKey) {
      this.lastPhaseKey = key;
      this.animateCircle(v);
    }
    this.updateRemaining();
  }

  /** Circle: grows on inhale, static on hold, shrinks on exhale. Frozen while paused. */
  private animateCircle(v: SessionView): void {
    const c = this.controller;
    if (c === undefined) {
      return;
    }
    const progress = v.paused ? c.phaseProgress() :
      (v.phaseDurationMs > 0 ? v.phaseElapsedMs / v.phaseDurationMs : 0);
    const from = BreathVisual.scaleAt(v.phase, progress);
    this.getUIContext().animateTo({ duration: 0 }, () => {
      this.circleScale = from;
    });
    if (v.paused) {
      return;
    }
    const rest = Math.max(0, v.phaseDurationMs - v.phaseElapsedMs);
    const curve = v.phase === PhaseType.INHALE || v.phase === PhaseType.EXHALE ? Curve.EaseInOut : Curve.Linear;
    this.getUIContext().animateTo({ duration: rest, curve: curve }, () => {
      this.circleScale = BreathVisual.targetScale(v.phase);
    });
  }

  private onUiTick(): void {
    this.updateRemaining();
    const now = Date.now();
    if (now - this.lastBatteryCheck >= BATTERY_CHECK_MS) {
      this.lastBatteryCheck = now;
      if (this.modal === Overlay.NONE && BatteryService.isLowAndNotCharging()) {
        this.onInterrupted(Overlay.LOW_BATTERY);
      }
    }
  }

  private updateRemaining(): void {
    if (this.controller !== undefined) {
      this.remaining = formatMmSs(this.controller.remainingMs());
    }
  }

  private onInterrupted(kind: Overlay): void {
    const c = this.controller;
    if (c === undefined || this.view.stage === Stage.SUMMARY) {
      return;
    }
    c.interrupt();
    this.modal = kind;
    WindowService.setKeepScreenOn(false);
  }

  // ------------------------------------------------------------ actions

  private pause(): void {
    if (this.controller !== undefined) {
      this.controller.pause();
      this.modal = Overlay.PAUSED;
      WindowService.setKeepScreenOn(false);
    }
  }

  private resume(): void {
    this.modal = Overlay.NONE;
    if (this.controller !== undefined) {
      this.lastPhaseKey = '';
      this.controller.resume();
      WindowService.setKeepScreenOn(true);
    }
  }

  private askEnd(): void {
    if (this.controller !== undefined) {
      this.controller.pause();
    }
    this.modal = Overlay.END_CONFIRM;
  }

  private endNow(): void {
    this.leaving = true;
    SessionManager.discard();
    this.bumpHistory();
    this.nav.clear();
  }

  private endAndSave(): void {
    this.leaving = true;
    SessionManager.saveInterrupted().then(() => {
      this.getUIContext().getPromptAction().showToast({ message: $r('app.string.saved_toast') });
      this.bumpHistory();
      this.nav.clear();
    });
  }

  private goToSummary(): void {
    this.leaving = true;
    SessionManager.prepareSummary().then(() => {
      this.nav.replacePathByName(ROUTE_SUMMARY, null, false);
    });
  }

  private bumpHistory(): void {
    AppStorage.setOrCreate<number>(STORAGE_HISTORY_REV, (AppStorage.get<number>(STORAGE_HISTORY_REV) ?? 0) + 1);
  }

  private act(action: (c: SessionController) => void): void {
    if (this.controller !== undefined && this.modal === Overlay.NONE) {
      action(this.controller);
    }
  }

  // ------------------------------------------------------------ stage views

  @Builder
  introView() {
    Column({ space: 14 }) {
      if (this.view.introIndex === 0) {
        Text($r('app.string.intro_1')).fontSize($r('app.float.font_xl')).introText()
      } else if (this.view.introIndex === 1) {
        Text($r('app.string.intro_2')).fontSize($r('app.float.font_l')).introText()
      } else {
        Text($r('app.string.intro_3')).fontSize($r('app.float.font_l')).introText()
      }
      Text($r('app.string.intro_tap'))
        .fontSize($r('app.float.font_xs'))
        .fontColor($r('app.color.text_secondary'))
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
    .padding({ left: 24, right: 24 })
    .onClick(() => this.act((c: SessionController) => c.finishIntro()))
  }

  @Builder
  breathingView(completion: boolean) {
    Column() {
      if (completion) {
        Text(this.view.notNowReturn ? $r('app.string.not_now_breath') : $r('app.string.completion_breath'))
          .fontSize($r('app.float.font_s'))
          .fontColor($r('app.color.text_secondary'))
          .textAlign(TextAlign.Center)
          .maxLines(2)
          .margin({ bottom: 4 })
      }
      Stack() {
        Circle()
          .width($r('app.float.circle_size'))
          .height($r('app.float.circle_size'))
          .fill($r('app.color.circle_inner'))
          .stroke($r('app.color.accent'))
          .strokeWidth(6)
          .scale({ x: this.circleScale, y: this.circleScale })
          .shadow({ radius: 24, color: $r('app.color.accent_dim') })
        Text(Res.phase(this.view.phase))
          .fontSize($r('app.float.font_xl'))
          .fontWeight(FontWeight.Bold)
          .fontColor(this.view.phase === PhaseType.INHALE ? $r('app.color.primary') : $r('app.color.text_primary'))
      }
      .width('100%')
      .layoutWeight(1)

      Text($r('app.string.remaining', this.remaining))
        .fontSize($r('app.float.font_m'))
        .fontColor($r('app.color.text_secondary'))
        .margin({ bottom: 6 })
      Button($r('app.string.btn_pause'))
        .type(ButtonType.Capsule)
        .width('70%')
        .height($r('app.float.button_height'))
        .fontSize($r('app.float.font_m'))
        .fontColor($r('app.color.text_primary'))
        .backgroundColor($r('app.color.button'))
        .onClick(() => this.pause())
    }
    .width('100%')
    .height('100%')
    .padding({ top: 20, bottom: 22, left: 16, right: 16 })
  }

  @Builder
  questionView() {
    Scroll() {
      Column({ space: 8 }) {
        Text($r('app.string.question_counter', this.view.questionIndex, this.view.questionTotal))
          .fontSize($r('app.float.font_xs'))
          .fontColor($r('app.color.accent'))
        Text(Res.question(this.view.question))
          .fontSize($r('app.float.font_l'))
          .fontWeight(FontWeight.Medium)
          .fontColor($r('app.color.text_primary'))
          .textAlign(TextAlign.Center)
          .margin({ top: 2, bottom: 8 })
        ForEach(answersFor(this.view.question), (a: Answer, i: number) => {
          if (i === 0) {
            PrimaryButton({ label: Res.answer(a), onTap: () => this.act((c: SessionController) => c.answer(a)) })
          } else {
            SecondaryButton({ label: Res.answer(a), onTap: () => this.act((c: SessionController) => c.answer(a)) })
          }
        }, (a: Answer) => `${this.view.question}-${a}`)
      }
      .width('100%')
      .padding({ left: 18, right: 18, top: 28, bottom: 40 })
    }
    .scrollBar(BarState.Off)
    .width('100%')
    .height('100%')
  }

  @Builder
  emotionView() {
    if (this.view.emotionNote) {
      this.noteView($r('app.string.emotion_fear_note'), () => this.act((c: SessionController) =>
        c.acknowledgeEmotionNote()))
    } else {
      Scroll() {
        Column({ space: 8 }) {
          Text($r('app.string.emotion_title'))
            .fontSize($r('app.float.font_m'))
            .fontColor($r('app.color.text_primary'))
            .textAlign(TextAlign.Center)
            .margin({ bottom: 4 })
          Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.Center }) {
            ForEach(EMOTIONS, (e: Emotion) => {
              Button(Res.emotion(e))
                .type(ButtonType.Capsule)
                .constraintSize({ minHeight: 46 })
                .width('48%')
                .margin(3)
                .padding({ left: 4, right: 4 })
                .fontSize($r('app.float.font_s'))
                .fontColor($r('app.color.text_primary'))
                .backgroundColor($r('app.color.surface'))
                .onClick(() => this.act((c: SessionController) => c.chooseEmotion(e)))
            }, (e: Emotion) => e)
          }
          .width('100%')
          SecondaryButton({ label: $r('app.string.btn_skip'),
            onTap: () => this.act((c: SessionController) => c.skipEmotion()) })
            .margin({ top: 6 })
        }
        .width('100%')
        .padding({ left: 14, right: 14, top: 24, bottom: 40 })
      }
      .scrollBar(BarState.Off)
      .width('100%')
      .height('100%')
    }
  }

  @Builder
  checkInView() {
    Scroll() {
      Column({ space: 10 }) {
        Text($r('app.string.checkin_title'))
          .fontSize($r('app.float.font_m'))
          .fontColor($r('app.color.text_primary'))
          .textAlign(TextAlign.Center)
        Row({ space: 4 }) {
          ForEach([1, 2, 3, 4, 5], (n: number) => {
            Button(`${n}`)
              .type(ButtonType.Circle)
              .width(48)
              .height(48)
              .fontSize($r('app.float.font_m'))
              .fontWeight(FontWeight.Bold)
              .fontColor($r('app.color.text_primary'))
              .backgroundColor($r('app.color.button'))
              .onClick(() => this.act((c: SessionController) => c.rate(n)))
          }, (n: number) => `${n}`)
        }
        .justifyContent(FlexAlign.Center)
        .width('100%')
        Row() {
          Text($r('app.string.checkin_low'))
            .fontSize($r('app.float.font_xs'))
            .fontColor($r('app.color.text_secondary'))
            .layoutWeight(1)
          Text($r('app.string.checkin_high'))
            .fontSize($r('app.float.font_xs'))
            .fontColor($r('app.color.text_secondary'))
            .layoutWeight(1)
            .textAlign(TextAlign.End)
        }
        .width('100%')
        .padding({ left: 8, right: 8 })
        SecondaryButton({ label: $r('app.string.btn_skip'),
          onTap: () => this.act((c: SessionController) => c.rate(RATING_NONE)) })
      }
      .width('100%')
      .padding({ left: 14, right: 14, top: 36, bottom: 40 })
    }
    .scrollBar(BarState.Off)
    .width('100%')
    .height('100%')
  }

  @Builder
  messageView() {
    Scroll() {
      Column({ space: 12 }) {
        Text(Res.message(this.view.message))
          .fontSize($r('app.float.font_l'))
          .fontColor(this.view.message === CompletionMessage.SUPPORTIVE ? $r('app.color.warning') :
            $r('app.color.text_primary'))
          .textAlign(TextAlign.Center)
        if (this.view.professionalHint) {
          Text($r('app.string.msg_professional'))
            .fontSize($r('app.float.font_s'))
            .fontColor($r('app.color.text_secondary'))
            .textAlign(TextAlign.Center)
        }
        PrimaryButton({ label: $r('app.string.btn_next'),
          onTap: () => this.act((c: SessionController) => c.finishMessage()) })
          .margin({ top: 8 })
      }
      .width('100%')
      .constraintSize({ minHeight: '100%' })
      .justifyContent(FlexAlign.Center)
      .padding({ left: 20, right: 20, top: 30, bottom: 40 })
    }
    .scrollBar(BarState.Off)
    .width('100%')
    .height('100%')
  }

  @Builder
  noteView(text: Resource, onNext: () => void) {
    Scroll() {
      Column({ space: 14 }) {
        Text(text)
          .fontSize($r('app.float.font_m'))
          .fontColor($r('app.color.text_primary'))
          .textAlign(TextAlign.Center)
        PrimaryButton({ label: $r('app.string.btn_next'), onTap: onNext })
      }
      .width('100%')
      .padding({ left: 20, right: 20, top: 36, bottom: 40 })
    }
    .scrollBar(BarState.Off)
    .width('100%')
    .height('100%')
  }

  // ------------------------------------------------------------ overlays

  @Builder
  overlayView() {
    Scroll() {
      Column({ space: 8 }) {
        if (this.modal === Overlay.PAUSED) {
          Text($r('app.string.paused_title')).overlayTitle()
          PrimaryButton({ label: $r('app.string.btn_resume'), onTap: () => this.resume() })
          SecondaryButton({ label: $r('app.string.btn_finish'), onTap: () => {
            this.modal = Overlay.END_CONFIRM;
          } })
        } else if (this.modal === Overlay.END_CONFIRM) {
          Text($r('app.string.end_title')).overlayTitle()
          PrimaryButton({ label: $r('app.string.btn_resume'), onTap: () => this.resume() })
          SecondaryButton({ label: $r('app.string.btn_end_now'), danger: true, onTap: () => this.endNow() })
          SecondaryButton({ label: $r('app.string.btn_end_save'), onTap: () => this.endAndSave() })
        } else {
          Text(this.modal === Overlay.LOW_BATTERY ? $r('app.string.low_battery') :
            $r('app.string.interrupted_title')).overlayTitle()
          Text($r('app.string.interrupted_body'))
            .fontSize($r('app.float.font_s'))
            .fontColor($r('app.color.text_secondary'))
            .margin({ bottom: 4 })
          PrimaryButton({ label: $r('app.string.btn_resume'), onTap: () => this.resume() })
          SecondaryButton({ label: $r('app.string.btn_finish'), onTap: () => {
            this.modal = Overlay.END_CONFIRM;
          } })
        }
      }
      .width('100%')
      .padding({ left: 18, right: 18, top: 34, bottom: 40 })
    }
    .scrollBar(BarState.Off)
    .width('100%')
    .height('100%')
    .backgroundColor($r('app.color.overlay'))
  }

  build() {
    NavDestination() {
      Stack() {
        if (this.view.stage === Stage.INTRO) {
          this.introView()
        } else if (this.view.stage === Stage.BREATHING) {
          this.breathingView(false)
        } else if (this.view.stage === Stage.COMPLETION_BREATHING) {
          this.breathingView(true)
        } else if (this.view.stage === Stage.QUESTION) {
          this.questionView()
        } else if (this.view.stage === Stage.EMOTION) {
          this.emotionView()
        } else if (this.view.stage === Stage.CHECK_IN) {
          this.checkInView()
        } else if (this.view.stage === Stage.MESSAGE) {
          this.messageView()
        }
        if (this.modal !== Overlay.NONE) {
          this.overlayView()
        }
      }
      .width('100%')
      .height('100%')
    }
    .hideTitleBar(true)
    .backgroundColor($r('app.color.bg'))
    .onBackPressed(() => {
      // Back gesture / button never silently drops a session.
      if (this.modal === Overlay.NONE) {
        this.askEnd();
      } else if (this.modal === Overlay.END_CONFIRM) {
        this.resume();
      }
      return true;
    })
  }
}

@Extend(Text)
function introText() {
  .fontColor($r('app.color.text_primary'))
  .fontWeight(FontWeight.Medium)
  .textAlign(TextAlign.Center)
}

@Extend(Text)
function overlayTitle() {
  .fontSize($r('app.float.font_l'))
  .fontWeight(FontWeight.Bold)
  .fontColor($r('app.color.text_primary'))
  .textAlign(TextAlign.Center)
  .margin({ bottom: 6 })
}

class CallbackObserver implements SessionObserver {
  private update: (v: SessionView) => void;
  private summary: () => void;

  constructor(update: (v: SessionView) => void, summary: () => void) {
    this.update = update;
    this.summary = summary;
  }

  onUpdate(view: SessionView): void {
    this.update(view);
  }

  onSummary(): void {
    this.summary();
  }
}

function cloneView(v: SessionView): SessionView {
  const c = new SessionView();
  c.stage = v.stage;
  c.stepIndex = v.stepIndex;
  c.introIndex = v.introIndex;
  c.phase = v.phase;
  c.phaseDurationMs = v.phaseDurationMs;
  c.phaseElapsedMs = v.phaseElapsedMs;
  c.cycle = v.cycle;
  c.cyclesInStep = v.cyclesInStep;
  c.question = v.question;
  c.questionIndex = v.questionIndex;
  c.questionTotal = v.questionTotal;
  c.paused = v.paused;
  c.notNowReturn = v.notNowReturn;
  c.emotionNote = v.emotionNote;
  c.emotion = v.emotion;
  c.rating = v.rating;
  c.message = v.message;
  c.professionalHint = v.professionalHint;
  c.revision = v.revision;
  return c;
}
