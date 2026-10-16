import { SessionRecord } from '../core/SessionRecord';
import { Emotion, SessionStatus } from '../core/SessionTypes';
import { formatMmSs } from '../core/Timing';
import { HistoryRepository } from '../services/HistoryRepository';
import { Res } from '../components/Res';
import { PageTitle } from '../components/Ui';

const HISTORY_LIMIT = 10;

/** Screen 9: last 10 sessions with date, duration, mode, status, before / after. */
@Component
export struct HistoryPage {
  @State items: SessionRecord[] = [];
  @State loaded: boolean = false;

  aboutToAppear(): void {
    HistoryRepository.INSTANCE.latest(HISTORY_LIMIT).then((rows: SessionRecord[]) => {
      this.items = rows;
    }).catch(() => {
      this.items = [];
    }).finally(() => {
      this.loaded = true;
    });
  }

  private dateText(ms: number): string {
    // Locale-aware date/time from the system formatter (no hard-coded format strings).
    const f = new Intl.DateTimeFormat(undefined, {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });
    return f.format(new Date(ms));
  }

  /** Resolves a resource to text so it can be used as a format argument. */
  private str(res: Resource, arg: number = -1): string {
    try {
      const ctx = this.getUIContext().getHostContext();
      if (ctx === undefined) {
        return '';
      }
      const rm = ctx.resourceManager;
      return arg >= 0 ? rm.getStringSync(res.id, arg) : rm.getStringSync(res.id);
    } catch (e) {
      return '';
    }
  }

  @Builder
  item(r: SessionRecord) {
    Column({ space: 3 }) {
      Row() {
        Text(this.dateText(r.startedAt))
          .fontSize($r('app.float.font_s'))
          .fontColor($r('app.color.text_primary'))
          .layoutWeight(1)
        Text(formatMmSs(r.durationSec * 1000))
          .fontSize($r('app.float.font_s'))
          .fontColor($r('app.color.text_primary'))
      }
      .width('100%')
      Text(Res.mode(r.mode))
        .fontSize($r('app.float.font_xs'))
        .fontColor($r('app.color.text_secondary'))
      Text(Res.status(r.status))
        .fontSize($r('app.float.font_xs'))
        .fontColor(r.status === SessionStatus.COMPLETED ? $r('app.color.primary') : $r('app.color.warning'))
      if (r.status === SessionStatus.INTERRUPTED && r.stoppedAt.length > 0) {
        Text($r('app.string.history_stopped_at', this.str(Res.stage(r.stoppedAt))))
          .fontSize($r('app.float.font_xs'))
          .fontColor($r('app.color.text_secondary'))
      }
      Row({ space: 10 }) {
        Text($r('app.string.history_before', this.str(r.emotionBefore === Emotion.NONE ? $r('app.string.dash') :
          Res.emotion(r.emotionBefore))))
          .fontSize($r('app.float.font_xs'))
          .fontColor($r('app.color.text_secondary'))
        Text($r('app.string.history_after',
          Res.intensityText(this.getUIContext().getHostContext(), r.intensityBefore, r.intensityAfter)))
          .fontSize($r('app.float.font_xs'))
          .fontColor($r('app.color.text_secondary'))
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .padding(12)
    .borderRadius(18)
    .backgroundColor($r('app.color.surface'))
  }

  build() {
    NavDestination() {
      List({ space: 8 }) {
        ListItem() {
          PageTitle({ title: $r('app.string.history_title') })
        }

        if (this.loaded && this.items.length === 0) {
          ListItem() {
            Text($r('app.string.history_empty'))
              .fontSize($r('app.float.font_s'))
              .fontColor($r('app.color.text_secondary'))
              .textAlign(TextAlign.Center)
              .width('100%')
              .margin({ top: 20 })
          }
        }

        ForEach(this.items, (r: SessionRecord) => {
          ListItem() {
            this.item(r)
          }
        }, (r: SessionRecord) => `${r.id}`)
      }
      .width('100%')
      .height('100%')
      .padding({ left: 14, right: 14 })
      .contentStartOffset(22)
      .contentEndOffset(40)
      .scrollBar(BarState.Off)
    }
    .hideTitleBar(true)
    .backgroundColor($r('app.color.bg'))
  }
}
