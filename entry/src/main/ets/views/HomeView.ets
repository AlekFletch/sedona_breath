import { SessionRecord } from '../core/SessionRecord';
import { Stage } from '../core/SessionTypes';
import { formatMmSs } from '../core/Timing';
import { HistoryRepository, startOfToday } from '../services/HistoryRepository';
import { SessionManager } from '../services/SessionManager';
import { Res } from '../components/Res';
import {
  PrimaryButton, ROUTE_HISTORY, ROUTE_SESSION, ROUTE_SETTINGS, ROUTE_SETUP, ROUTE_SUMMARY, STORAGE_HISTORY_REV,
  SecondaryButton
} from '../components/Ui';

/** Screen 1: start button, last completed session, practices today, unfinished-session card. */
@Component
export struct HomeView {
  @Consume('nav') nav: NavPathStack;
  @StorageLink(STORAGE_HISTORY_REV) @Watch('reload') historyRev: number = 0;
  @State todayCount: number = 0;
  @State last: SessionRecord | undefined = undefined;
  @State hasUnfinished: boolean = false;

  aboutToAppear(): void {
    this.reload();
  }

  reload(): void {
    this.hasUnfinished = SessionManager.hasSnapshot();
    HistoryRepository.INSTANCE.countSince(startOfToday()).then((n: number) => {
      this.todayCount = n;
    }).catch(() => {
      this.todayCount = 0;
    });
    HistoryRepository.INSTANCE.lastCompleted().then((r: SessionRecord | undefined) => {
      this.last = r;
    }).catch(() => {
      this.last = undefined;
    });
  }

  private resumeUnfinished(): void {
    SessionManager.restore().then((c) => {
      if (c === undefined) {
        this.reload();
        return;
      }
      if (c.view.stage === Stage.SUMMARY) {
        SessionManager.prepareSummary().then(() => this.nav.pushPathByName(ROUTE_SUMMARY, null));
      } else {
        this.nav.pushPathByName(ROUTE_SESSION, null);
      }
    });
  }

  private endUnfinished(): void {
    SessionManager.discard();
    this.reload();
  }

  @Builder
  lastLine() {
    if (this.last !== undefined) {
      Text($r('app.string.home_last', formatMmSs((this.last as SessionRecord).durationSec * 1000)))
        .fontSize($r('app.float.font_s'))
        .fontColor($r('app.color.text_secondary'))
      Text(Res.pattern((this.last as SessionRecord).patternId))
        .fontSize($r('app.float.font_xs'))
        .fontColor($r('app.color.text_secondary'))
    } else {
      Text($r('app.string.home_last_none'))
        .fontSize($r('app.float.font_s'))
        .fontColor($r('app.color.text_secondary'))
    }
  }

  build() {
    Scroll() {
      Column({ space: 10 }) {
        Image($r('app.media.app_icon'))
          .width(64)
          .height(64)
        Text($r('app.string.app_name'))
          .fontSize($r('app.float.font_l'))
          .fontWeight(FontWeight.Bold)
          .fontColor($r('app.color.text_primary'))

        if (this.hasUnfinished) {
          Column({ space: 8 }) {
            Text($r('app.string.home_unfinished'))
              .fontSize($r('app.float.font_s'))
              .fontColor($r('app.color.warning'))
              .textAlign(TextAlign.Center)
            PrimaryButton({ label: $r('app.string.btn_resume'), onTap: () => this.resumeUnfinished() })
            SecondaryButton({ label: $r('app.string.btn_finish'), onTap: () => this.endUnfinished() })
          }
          .padding(12)
          .borderRadius(20)
          .backgroundColor($r('app.color.surface'))
        } else {
          PrimaryButton({ label: $r('app.string.btn_start_practice'),
            onTap: () => this.nav.pushPathByName(ROUTE_SETUP, null) })
        }

        Column({ space: 2 }) {
          this.lastLine()
          Text($r('app.string.home_today', this.todayCount))
            .fontSize($r('app.float.font_s'))
            .fontColor($r('app.color.accent'))
        }
        .margin({ top: 4, bottom: 4 })

        SecondaryButton({ label: $r('app.string.btn_history'),
          onTap: () => this.nav.pushPathByName(ROUTE_HISTORY, null) })
        SecondaryButton({ label: $r('app.string.btn_settings'),
          onTap: () => this.nav.pushPathByName(ROUTE_SETTINGS, null) })
      }
      .width('100%')
      .padding({ left: $r('app.float.page_padding_h'), right: $r('app.float.page_padding_h'),
        top: $r('app.float.page_padding_top'), bottom: 36 })
    }
    .width('100%')
    .height('100%')
    .scrollBar(BarState.Off)
    .backgroundColor($r('app.color.bg'))
  }
}
