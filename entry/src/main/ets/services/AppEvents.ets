/** Tiny in-process event bus for ability lifecycle -> UI. */
export enum AppEvent {
  BACKGROUND = 'background',
  FOREGROUND = 'foreground',
  QUICK_START = 'quickStart'
}

export type AppEventListener = (event: AppEvent) => void;

export class AppEvents {
  private static listeners: AppEventListener[] = [];
  /** Quick start requested before the UI was ready (cold start from the watch face card). */
  private static pendingQuickStart: boolean = false;

  static on(listener: AppEventListener): void {
    AppEvents.listeners.push(listener);
  }

  static off(listener: AppEventListener): void {
    AppEvents.listeners = AppEvents.listeners.filter((l: AppEventListener) => l !== listener);
  }

  static emit(event: AppEvent): void {
    if (event === AppEvent.QUICK_START) {
      AppEvents.pendingQuickStart = true;
    }
    const copy = AppEvents.listeners.slice();
    for (const l of copy) {
      l(event);
    }
  }

  /** Returns and clears a pending quick-start request. */
  static takeQuickStart(): boolean {
    const v = AppEvents.pendingQuickStart;
    AppEvents.pendingQuickStart = false;
    return v;
  }
}
