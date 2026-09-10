/**
 * Constantes de timing para debouncing, retries y delays.
 * Centraliza valores hardcodeados de tiempo.
 */
export const TIMINGS = {

  // Debounce intervals (ms)
  WEBVIEW_REFRESH_DEBOUNCE: 30,
  ICON_THEME_CHANGE_DEBOUNCE: 100,
  // Structural changes arrive in bursts and this one answers with disk reads:
  // one window per burst instead of one scan per event.
  CLAUDE_TITLE_DEBOUNCE: 150,

  // Retry delays (ms)
  ACTIVATION_RETRY_DELAY: 50,
  ACTIVATION_MAX_RETRIES: 3,
  // Focusing a group in another window brings that window forward, but the OS
  // focus lands asynchronously: a webview pane defers its focus by 50 ms and
  // the window switch is a round trip through the main process on top. The
  // poll asks the workbench which window it is looking at until it changes.
  WINDOW_FOCUS_POLL: 25,
  WINDOW_FOCUS_TIMEOUT: 250,

  // Sync delays (ms)
  SYNC_PROPAGATION_DELAY: 5, // Tiempo para que VS Code propague el estado de bays

  // Cache TTL (ms)
  ICON_CACHE_TTL: 300000, // 5 minutos

} as const;
