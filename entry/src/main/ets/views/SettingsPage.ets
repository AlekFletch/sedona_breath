import { ALL_PATTERNS, FreeRhythm } from '../core/BreathPattern';
import { DURATIONS_MIN, SessionMode } from '../core/SessionTypes';
import { HealthKitService, HealthResult } from '../services/HealthKitService';
import { HistoryRepository } from '../services/HistoryRepository';
import { LanguageService } from '../services/LanguageService';
import { AppSettings, LANGUAGES, SettingsStore } from '../services/SettingsStore';
import { Res } from '../components/Res';
import {
  PageTitle, PrimaryButton, ROUTE_ONBOARDING, STORAGE_HISTORY_REV, SecondaryButton, StepperRow, ValueRow
} from '../components/Ui';
import { OnboardingParam } from './OnboardingPage';

enum Dialog {
  NONE = 0,
  DELETE = 1,
  HEALTH = 2,
  HEART_RATE = 3
}

/** Screen 10: language, defaults, vibration, Health Kit, delete all history. */
@Component
export struct SettingsPage {
  @Consume('nav') nav: NavPathStack;
  @State s: AppSettings = SettingsStore.INSTANCE.copy();
  @State dialog: Dialog = Dialog.NONE;

  private commit(): void {
    SettingsStore.INSTANCE.update(this.s);
    this.s = SettingsStore.INSTANCE.copy();
  }

  private toast(res: Resource): void {
    this.getUIContext().getPromptAction().showToast({ message: res });
  }

  private nextLanguage(): void {
    const i = LANGUAGES.indexOf(this.s.language);
    this.s.language = LANGUAGES[(i + 1) % LANGUAGES.length];
    this.commit();
    if (LanguageService.apply(this.s.language)) {
      this.toast($r('app.string.lang_restart'));
    }
  }

  private nextPattern(): void {
    const i = ALL_PATTERNS.indexOf(this.s.defaultPattern);
    this.s.defaultPattern = ALL_PATTERNS[(i + 1) % ALL_PATTERNS.length];
    this.commit();
  }

  private nextDuration(): void {
    const i = DURATIONS_MIN.indexOf(this.s.defaultDurationMin);
    this.s.defaultDurationMin = DURATIONS_MIN[(i + 1) % DURATIONS_MIN.length];
    this.commit();
  }

  private changeFree(inhaleDelta: number, exhaleDelta: number): void {
    const f = new FreeRhythm(this.s.freeInhaleSec + inhaleDelta, this.s.freeExhaleSec + exhaleDelta).normalized();
    this.s.freeInhaleSec = f.inhaleSec;
    this.s.freeExhaleSec = f.exhaleSec;
    this.commit();
  }

  private toggleHealth(): void {
    if (this.s.healthEnabled) {
      this.s.healthEnabled = false;
      this.s.healthHeartRate = false;
      this.commit();
      HealthKitService.INSTANCE.disconnect();
      return;
    }
    if (!HealthKitService.INSTANCE.isAvailable()) {
      this.toast($r('app.string.health_unavailable'));
      return;
    }
    this.dialog = Dialog.HEALTH; // explanation first, nothing is requested yet
  }

  private toggleHeartRate(): void {
    if (this.s.healthHeartRate) {
      this.s.healthHeartRate = false;
      this.commit();
      return;
    }
    this.dialog = Dialog.HEART_RATE;
  }

  private confirmHealth(withHeartRate: boolean): void {
    this.dialog = Dialog.NONE;
    HealthKitService.INSTANCE.connect(withHeartRate).then((r: HealthResult) => {
      if (r === HealthResult.GRANTED) {
        this.s.healthEnabled = true;
        this.s.healthHeartRate = withHeartRate;
        this.commit();
      } else if (r === HealthResult.DENIED) {
        this.toast($r('app.string.health_denied'));
      } else {
        this.toast($r('app.string.health_unavailable'));
      }
    });
  }

  private deleteAll(): void {
    this.dialog = Dialog.NONE;
    HistoryRepository.INSTANCE.deleteAll().then(() => {
      AppStorage.setOrCreate<number>(STORAGE_HISTORY_REV, (AppStorage.get<number>(STORAGE_HISTORY_REV) ?? 0) + 1);
      this.toast($r('app.string.deleted_toast'));
    }).catch(() => {
      this.toast($r('app.string.save_failed'));
    });
  }

  @Builder
  dialogView() {
    Scroll() {
      Column({ space: 10 }) {
        if (this.dialog === Dialog.DELETE) {
          Text($r('app.string.delete_confirm_title')).dialogTitle()
          Text($r('app.string.delete_confirm_body')).dialogBody()
          SecondaryButton({ label: $r('app.string.btn_delete'), danger: true, onTap: () => this.deleteAll() })
          PrimaryButton({ label: $r('app.string.btn_cancel'), onTap: () => {
            this.dialog = Dialog.NONE;
          } })
        } else if (this.dialog === Dialog.HEALTH) {
          Text($r('app.string.settings_health')).dialogTitle()
          Text($r('app.string.health_explain')).dialogBody()
          Text($r('app.string.health_write_note')).dialogBody()
          PrimaryButton({ label: $r('app.string.btn_allow'), onTap: () => this.confirmHealth(false) })
          SecondaryButton({ label: $r('app.string.btn_cancel'), onTap: () => {
            this.dialog = Dialog.NONE;
          } })
        } else {
          Text($r('app.string.settings_health_hr')).dialogTitle()
          Text($r('app.string.health_hr_explain')).dialogBody()
          PrimaryButton({ label: $r('app.string.btn_allow'), onTap: () => this.confirmHealth(true) })
          SecondaryButton({ label: $r('app.string.btn_cancel'), onTap: () => {
            this.dialog = Dialog.NONE;
          } })
        }
      }
      .width('100%')
      .padding({ left: 18, right: 18, top: 30, bottom: 40 })
    }
    .scrollBar(BarState.Off)
    .width('100%')
    .height('100%')
    .backgroundColor($r('app.color.overlay'))
  }

  build() {
    NavDestination() {
      Stack() {
        Scroll() {
          Column({ space: 8 }) {
            PageTitle({ title: $r('app.string.settings_title') })
            ValueRow({ label: $r('app.string.settings_language'), value: Res.language(this.s.language),
              onTap: () => this.nextLanguage() })
            ValueRow({ label: $r('app.string.settings_default_pattern'), value: Res.pattern(this.s.defaultPattern),
              onTap: () => this.nextPattern() })
            ValueRow({ label: $r('app.string.settings_default_duration'),
              value: $r('app.string.fmt_minutes', this.s.defaultDurationMin), onTap: () => this.nextDuration() })
            ValueRow({ label: $r('app.string.settings_default_mode'), value: Res.mode(this.s.defaultMode),
              onTap: () => {
                this.s.defaultMode = this.s.defaultMode === SessionMode.FULL ? SessionMode.QUICK : SessionMode.FULL;
                this.commit();
              } })
            ValueRow({ label: $r('app.string.settings_vibration'), value: Res.onOff(this.s.vibration),
              onTap: () => {
                this.s.vibration = !this.s.vibration;
                this.commit();
              } })
            StepperRow({ label: $r('app.string.settings_free_inhale'),
              value: $r('app.string.fmt_seconds', this.s.freeInhaleSec),
              onMinus: () => this.changeFree(-1, 0), onPlus: () => this.changeFree(1, 0) })
            StepperRow({ label: $r('app.string.settings_free_exhale'),
              value: $r('app.string.fmt_seconds', this.s.freeExhaleSec),
              onMinus: () => this.changeFree(0, -1), onPlus: () => this.changeFree(0, 1) })
            ValueRow({ label: $r('app.string.settings_health'), value: Res.onOff(this.s.healthEnabled),
              onTap: () => this.toggleHealth() })
            if (this.s.healthEnabled) {
              ValueRow({ label: $r('app.string.settings_health_hr'), value: Res.onOff(this.s.healthHeartRate),
                onTap: () => this.toggleHeartRate() })
            }
            SecondaryButton({ label: $r('app.string.settings_terms'),
              onTap: () => this.nav.pushPathByName(ROUTE_ONBOARDING, new OnboardingParam(true)) })
            SecondaryButton({ label: $r('app.string.settings_delete_history'), danger: true, onTap: () => {
              this.dialog = Dialog.DELETE;
            } })
          }
          .width('100%')
          .padding({ left: $r('app.float.page_padding_h'), right: $r('app.float.page_padding_h'),
            top: $r('app.float.page_padding_top'), bottom: 40 })
        }
        .scrollBar(BarState.Off)
        .width('100%')
        .height('100%')

        if (this.dialog !== Dialog.NONE) {
          this.dialogView()
        }
      }
      .width('100%')
      .height('100%')
    }
    .hideTitleBar(true)
    .backgroundColor($r('app.color.bg'))
    .onBackPressed(() => {
      if (this.dialog !== Dialog.NONE) {
        this.dialog = Dialog.NONE;
        return true;
      }
      return false;
    })
  }
}

@Extend(Text)
function dialogTitle() {
  .fontSize($r('app.float.font_l'))
  .fontWeight(FontWeight.Bold)
  .fontColor($r('app.color.text_primary'))
  .textAlign(TextAlign.Center)
}

@Extend(Text)
function dialogBody() {
  .fontSize($r('app.float.font_s'))
  .fontColor($r('app.color.text_secondary'))
  .textAlign(TextAlign.Center)
}
