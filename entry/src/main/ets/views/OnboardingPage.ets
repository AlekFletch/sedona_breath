import { common } from '@kit.AbilityKit';
import { SettingsStore } from '../services/SettingsStore';
import { PrimaryButton, STORAGE_HISTORY_REV } from '../components/Ui';

export class OnboardingParam {
  /** Opened from Settings: just shows the terms again. */
  readOnly: boolean;

  constructor(readOnly: boolean) {
    this.readOnly = readOnly;
  }
}

/** Screen 11: what the practice is, disclaimer, consent. */
@Component
export struct OnboardingPage {
  @Consume('nav') nav: NavPathStack;
  param: OnboardingParam = new OnboardingParam(false);

  private accept(): void {
    if (this.param.readOnly) {
      this.nav.pop();
      return;
    }
    const s = SettingsStore.INSTANCE.copy();
    s.onboardingAccepted = true;
    SettingsStore.INSTANCE.update(s);
    AppStorage.setOrCreate<number>(STORAGE_HISTORY_REV, (AppStorage.get<number>(STORAGE_HISTORY_REV) ?? 0) + 1);
    this.nav.pop();
  }

  build() {
    NavDestination() {
      Scroll() {
        Column({ space: 14 }) {
          Image($r('app.media.app_icon'))
            .width(72)
            .height(72)
          Text($r('app.string.onb_1')).onbText()
          Text($r('app.string.onb_2')).onbText()
          Column({ space: 8 }) {
            Text($r('app.string.onb_disclaimer_title'))
              .fontSize($r('app.float.font_m'))
              .fontWeight(FontWeight.Bold)
              .fontColor($r('app.color.warning'))
            Text($r('app.string.onb_disclaimer'))
              .fontSize($r('app.float.font_s'))
              .fontColor($r('app.color.text_primary'))
              .textAlign(TextAlign.Center)
            Text($r('app.string.onb_safety'))
              .fontSize($r('app.float.font_s'))
              .fontColor($r('app.color.text_secondary'))
              .textAlign(TextAlign.Center)
          }
          .padding(14)
          .borderRadius(20)
          .backgroundColor($r('app.color.surface'))
          if (!this.param.readOnly) {
            Text($r('app.string.onb_consent'))
              .fontSize($r('app.float.font_s'))
              .fontColor($r('app.color.text_secondary'))
              .textAlign(TextAlign.Center)
          }
          PrimaryButton({
            label: this.param.readOnly ? $r('app.string.btn_ok') : $r('app.string.btn_accept'),
            onTap: () => this.accept()
          })
        }
        .width('100%')
        .padding({ left: 20, right: 20, top: 26, bottom: 44 })
      }
      .scrollBar(BarState.Off)
      .width('100%')
      .height('100%')
    }
    .hideTitleBar(true)
    .backgroundColor($r('app.color.bg'))
    .onBackPressed(() => {
      if (this.param.readOnly) {
        return false;
      }
      // Without consent the app cannot be used: back leaves the app.
      const ctx = this.getUIContext().getHostContext() as common.UIAbilityContext;
      ctx.terminateSelf();
      return true;
    })
  }
}

@Extend(Text)
function onbText() {
  .fontSize($r('app.float.font_m'))
  .fontColor($r('app.color.text_primary'))
  .textAlign(TextAlign.Center)
}
