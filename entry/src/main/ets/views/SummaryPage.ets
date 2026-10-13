import { SessionRecord } from '../core/SessionRecord';
import { Emotion, RATING_NONE } from '../core/SessionTypes';
import { formatMmSs } from '../core/Timing';
import { SessionManager } from '../services/SessionManager';
import { Res } from '../components/Res';
import { InfoLine, PageTitle, PrimaryButton, STORAGE_HISTORY_REV } from '../components/Ui';

/** Screen 8: duration, cycles, mode, emotion before, rating after (if given), "Save". */
@Component
export struct SummaryPage {
  @Consume('nav') nav: NavPathStack;
  @State record: SessionRecord | undefined = SessionManager.summaryRecord();
  private saving: boolean = false;

  private save(): void {
    if (this.saving) {
      return;
    }
    this.saving = true;
    SessionManager.saveCompleted().then((ok: boolean) => {
      const prompt = this.getUIContext().getPromptAction();
      if (ok) {
        prompt.showToast({ message: $r('app.string.saved_toast') });
        AppStorage.setOrCreate<number>(STORAGE_HISTORY_REV, (AppStorage.get<number>(STORAGE_HISTORY_REV) ?? 0) + 1);
        this.nav.clear();
      } else {
        prompt.showToast({ message: $r('app.string.save_failed') });
      }
    }).finally(() => {
      this.saving = false;
    });
  }

  build() {
    NavDestination() {
      Scroll() {
        Column({ space: 2 }) {
          PageTitle({ title: $r('app.string.summary_title') })
          if (this.record !== undefined) {
            InfoLine({ label: $r('app.string.summary_duration'),
              value: formatMmSs((this.record as SessionRecord).durationSec * 1000) })
            InfoLine({ label: $r('app.string.summary_cycles'), value: `${(this.record as SessionRecord).cycles}` })
            InfoLine({ label: $r('app.string.summary_mode'), value: Res.mode((this.record as SessionRecord).mode) })
            if ((this.record as SessionRecord).emotionBefore !== Emotion.NONE) {
              InfoLine({ label: $r('app.string.summary_emotion'),
                value: Res.emotion((this.record as SessionRecord).emotionBefore) })
            }
            if ((this.record as SessionRecord).ratingAfter !== RATING_NONE) {
              InfoLine({ label: $r('app.string.summary_rating'),
                value: $r('app.string.fmt_rating', (this.record as SessionRecord).ratingAfter) })
            }
            if ((this.record as SessionRecord).heartRateAvg > 0) {
              InfoLine({ label: $r('app.string.summary_hr'),
                value: $r('app.string.fmt_bpm', (this.record as SessionRecord).heartRateAvg) })
            }
          }
          PrimaryButton({ label: $r('app.string.btn_save'), onTap: () => this.save() })
            .margin({ top: 12 })
        }
        .width('100%')
        .padding({ left: 22, right: 22, top: $r('app.float.page_padding_top'), bottom: 40 })
      }
      .scrollBar(BarState.Off)
      .width('100%')
      .height('100%')
    }
    .hideTitleBar(true)
    .backgroundColor($r('app.color.bg'))
  }
}
