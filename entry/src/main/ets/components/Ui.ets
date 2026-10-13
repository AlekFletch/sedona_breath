/*
 * Shared watch-friendly building blocks: big touch targets, high contrast,
 * fp font sizes (follow the system font scale).
 */

export const ROUTE_SETUP = 'setup';
export const ROUTE_SESSION = 'session';
export const ROUTE_SUMMARY = 'summary';
export const ROUTE_HISTORY = 'history';
export const ROUTE_SETTINGS = 'settings';
export const ROUTE_ONBOARDING = 'onboarding';
/** AppStorage key bumped whenever the history changes (Home reloads its numbers). */
export const STORAGE_HISTORY_REV = 'historyRev';

@Component
export struct PrimaryButton {
  label: ResourceStr = '';
  onTap: () => void = () => {
  };

  build() {
    Button(this.label)
      .type(ButtonType.Capsule)
      .width('100%')
      .constraintSize({ minHeight: $r('app.float.button_height') })
      .padding({ left: 12, right: 12, top: 6, bottom: 6 })
      .fontSize($r('app.float.font_m'))
      .fontWeight(FontWeight.Bold)
      .fontColor($r('app.color.primary_text'))
      .backgroundColor($r('app.color.primary'))
      .onClick(() => this.onTap())
  }
}

@Component
export struct SecondaryButton {
  label: ResourceStr = '';
  danger: boolean = false;
  onTap: () => void = () => {
  };

  build() {
    Button(this.label)
      .type(ButtonType.Capsule)
      .width('100%')
      .constraintSize({ minHeight: $r('app.float.button_height') })
      .padding({ left: 12, right: 12, top: 6, bottom: 6 })
      .fontSize($r('app.float.font_m'))
      .fontColor(this.danger ? $r('app.color.danger') : $r('app.color.text_primary'))
      .backgroundColor($r('app.color.button'))
      .onClick(() => this.onTap())
  }
}

/** Settings-style row: label on top, value below; tap to change. */
@Component
export struct ValueRow {
  label: ResourceStr = '';
  @Prop value: ResourceStr = '';
  onTap: () => void = () => {
  };

  build() {
    Column({ space: 2 }) {
      Text(this.label)
        .fontSize($r('app.float.font_xs'))
        .fontColor($r('app.color.text_secondary'))
      Text(this.value)
        .fontSize($r('app.float.font_m'))
        .fontColor($r('app.color.text_primary'))
        .fontWeight(FontWeight.Medium)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .padding({ left: 16, right: 16, top: 10, bottom: 10 })
    .backgroundColor($r('app.color.surface'))
    .borderRadius(18)
    .onClick(() => this.onTap())
  }
}

/** Row with a "-" / "+" stepper (big touch targets). */
@Component
export struct StepperRow {
  label: ResourceStr = '';
  @Prop value: ResourceStr = '';
  onMinus: () => void = () => {
  };
  onPlus: () => void = () => {
  };

  build() {
    Column({ space: 4 }) {
      Text(this.label)
        .fontSize($r('app.float.font_xs'))
        .fontColor($r('app.color.text_secondary'))
      Row() {
        Button('−')
          .type(ButtonType.Circle)
          .width(44)
          .height(44)
          .fontSize($r('app.float.font_l'))
          .fontColor($r('app.color.text_primary'))
          .backgroundColor($r('app.color.button'))
          .onClick(() => this.onMinus())
        Text(this.value)
          .fontSize($r('app.float.font_m'))
          .fontColor($r('app.color.text_primary'))
          .layoutWeight(1)
          .textAlign(TextAlign.Center)
        Button('+')
          .type(ButtonType.Circle)
          .width(44)
          .height(44)
          .fontSize($r('app.float.font_l'))
          .fontColor($r('app.color.text_primary'))
          .backgroundColor($r('app.color.button'))
          .onClick(() => this.onPlus())
      }
      .width('100%')
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .padding({ left: 16, right: 16, top: 10, bottom: 10 })
    .backgroundColor($r('app.color.surface'))
    .borderRadius(18)
  }
}

@Component
export struct PageTitle {
  title: ResourceStr = '';

  build() {
    Text(this.title)
      .fontSize($r('app.float.font_l'))
      .fontWeight(FontWeight.Bold)
      .fontColor($r('app.color.text_primary'))
      .textAlign(TextAlign.Center)
      .width('100%')
      .margin({ bottom: 6 })
  }
}

/** Summary/history line: label left, value right. */
@Component
export struct InfoLine {
  label: ResourceStr = '';
  @Prop value: ResourceStr = '';

  build() {
    Row() {
      Text(this.label)
        .fontSize($r('app.float.font_s'))
        .fontColor($r('app.color.text_secondary'))
        .layoutWeight(1)
      Text(this.value)
        .fontSize($r('app.float.font_s'))
        .fontColor($r('app.color.text_primary'))
        .fontWeight(FontWeight.Medium)
        .textAlign(TextAlign.End)
        .maxLines(2)
    }
    .width('100%')
    .padding({ top: 6, bottom: 6 })
  }
}
