@Entry
@Component
struct QuickStartCard {
  build() {
    Column() {
      Image($r('app.media.app_icon'))
        .width('42%')
        .aspectRatio(1)
      Text($r('app.string.widget_quick'))
        .fontSize($r('app.float.font_l'))
        .fontWeight(FontWeight.Bold)
        .fontColor($r('app.color.primary'))
        .margin({ top: 6 })
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
    .backgroundColor($r('app.color.bg'))
    .onClick(() => {
      postCardAction(this, {
        action: 'router',
        abilityName: 'EntryAbility',
        params: { quickStart: 3 }
      });
    })
  }
}
