import { PatternId } from '../core/BreathPattern';
import { QUICK_START_DURATION_MIN, SessionMode } from '../core/SessionTypes';
import { AppEvent, AppEvents } from '../services/AppEvents';
import { SessionManager } from '../services/SessionManager';
import { SettingsStore } from '../services/SettingsStore';
import {
  ROUTE_HISTORY, ROUTE_ONBOARDING, ROUTE_SESSION, ROUTE_SETTINGS, ROUTE_SETUP, ROUTE_SUMMARY
} from '../components/Ui';
import { HomeView } from '../views/HomeView';
import { SetupPage } from '../views/SetupPage';
import { SessionPage } from '../views/SessionPage';
import { SummaryPage } from '../views/SummaryPage';
import { HistoryPage } from '../views/HistoryPage';
import { SettingsPage } from '../views/SettingsPage';
import { OnboardingPage, OnboardingParam } from '../views/OnboardingPage';

/** Single entry page hosting a Navigation stack of all screens. */
@Entry
@Component
struct Index {
  @Provide('nav') nav: NavPathStack = new NavPathStack();
  private listener: (e: AppEvent) => void = (e: AppEvent) => {
    if (e === AppEvent.QUICK_START) {
      this.tryQuickStart();
    }
  };

  aboutToAppear(): void {
    AppEvents.on(this.listener);
    if (!SettingsStore.INSTANCE.get().onboardingAccepted) {
      this.nav.pushPathByName(ROUTE_ONBOARDING, new OnboardingParam(false), false);
    } else {
      this.tryQuickStart();
    }
  }

  aboutToDisappear(): void {
    AppEvents.off(this.listener);
  }

  /** "3 min" from the watch-face card: skip setup, use default breathing pattern. */
  private tryQuickStart(): void {
    if (!SettingsStore.INSTANCE.get().onboardingAccepted || !AppEvents.takeQuickStart()) {
      return;
    }
    if (SessionManager.isRunning()) {
      return; // never replace a running session
    }
    const s = SettingsStore.INSTANCE.get();
    const pattern: PatternId = s.defaultPattern;
    SessionManager.start(SessionManager.configFromSettings(QUICK_START_DURATION_MIN, SessionMode.QUICK, pattern,
      s.vibration)).then(() => {
      this.nav.clear(false);
      this.nav.pushPathByName(ROUTE_SESSION, null, false);
    });
  }

  @Builder
  routes(name: string, param: Object) {
    if (name === ROUTE_SETUP) {
      SetupPage()
    } else if (name === ROUTE_SESSION) {
      SessionPage()
    } else if (name === ROUTE_SUMMARY) {
      SummaryPage()
    } else if (name === ROUTE_HISTORY) {
      HistoryPage()
    } else if (name === ROUTE_SETTINGS) {
      SettingsPage()
    } else if (name === ROUTE_ONBOARDING) {
      OnboardingPage({ param: param as OnboardingParam })
    }
  }

  build() {
    Navigation(this.nav) {
      HomeView()
    }
    .mode(NavigationMode.Stack)
    .hideTitleBar(true)
    .hideToolBar(true)
    .hideBackButton(true)
    .navDestination(this.routes)
    .backgroundColor($r('app.color.bg'))
    .width('100%')
    .height('100%')
  }
}
