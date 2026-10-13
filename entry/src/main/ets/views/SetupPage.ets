import { ALL_PATTERNS, PatternId } from '../core/BreathPattern';
import { DURATIONS_MIN, SessionMode } from '../core/SessionTypes';
import { SessionManager } from '../services/SessionManager';
import { SettingsStore } from '../services/SettingsStore';
import { Res } from '../components/Res';
import { PageTitle, PrimaryButton, ROUTE_SESSION, ValueRow } from '../components/Ui';

/** Screen 2: duration, mode, breathing pattern, vibration. Tap a row to cycle its value. */
@Component
export struct SetupPage {
  @Consume('nav') nav: NavPathStack;
  @State duration: number = SettingsStore.INSTANCE.get().defaultDurationMin;
  @State mode: SessionMode = SettingsStore.INSTANCE.get().defaultMode;
  @State pattern: PatternId = SettingsStore.INSTANCE.get().defaultPattern;
  @State vibration: boolean = SettingsStore.INSTANCE.get().vibration;
  private starting: boolean = false;

  private nextDuration(): void {
    const i = DURATIONS_MIN.indexOf(this.duration);
    this.duration = DURATIONS_MIN[(i + 1) % DURATIONS_MIN.length];
  }

  private nextPattern(): void {
    const i = ALL_PATTERNS.indexOf(this.pattern);
    this.pattern = ALL_PATTERNS[(i + 1) % ALL_PATTERNS.length];
  }

  private start(): void {
    if (this.starting) {
      return;
    }
    this.starting = true;
    const config = SessionManager.configFromSettings(this.duration, this.mode, this.pattern, this.vibration);
    SessionManager.start(config).then(() => {
      this.nav.replacePathByName(ROUTE_SESSION, null, false);
    }).finally(() => {
      this.starting = false;
    });
  }

  build() {
    NavDestination() {
      Scroll() {
        Column({ space: 8 }) {
          PageTitle({ title: $r('app.string.setup_title') })
          ValueRow({ label: $r('app.string.setup_duration'), value: $r('app.string.fmt_minutes', this.duration),
            onTap: () => this.nextDuration() })
          ValueRow({ label: $r('app.string.setup_mode'), value: Res.mode(this.mode),
            onTap: () => {
              this.mode = this.mode === SessionMode.FULL ? SessionMode.QUICK : SessionMode.FULL;
            } })
          ValueRow({ label: $r('app.string.setup_pattern'), value: Res.pattern(this.pattern),
            onTap: () => this.nextPattern() })
          ValueRow({ label: $r('app.string.setup_vibration'), value: Res.onOff(this.vibration),
            onTap: () => {
              this.vibration = !this.vibration;
            } })
          PrimaryButton({ label: $r('app.string.btn_start'), onTap: () => this.start() })
            .margin({ top: 6 })
        }
        .width('100%')
        .padding({ left: $r('app.float.page_padding_h'), right: $r('app.float.page_padding_h'),
          top: $r('app.float.page_padding_top'), bottom: 36 })
      }
      .scrollBar(BarState.Off)
      .width('100%')
      .height('100%')
    }
    .hideTitleBar(true)
    .backgroundColor($r('app.color.bg'))
  }
}
