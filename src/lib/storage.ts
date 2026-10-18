const WATCH_KEY = 'pawchive-mobile-watchlist-v1';
const SETTINGS_KEY = 'pawchive-mobile-settings-v1';

export interface Settings { wifiOnly: boolean; compactView: boolean; }
export const DEFAULT_SETTINGS: Settings = { wifiOnly: false, compactView: false };

export function readWatchlist(): string[] {
  try { const raw = JSON.parse(localStorage.getItem(WATCH_KEY) || '[]'); return Array.isArray(raw) ? raw.filter(x => typeof x === 'string').slice(0, 1000) : []; }
  catch { return []; }
}
export function saveWatchlist(items: string[]): void { localStorage.setItem(WATCH_KEY, JSON.stringify(items)); }
export function readSettings(): Settings {
  try { const x = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); return { ...DEFAULT_SETTINGS, wifiOnly: x.wifiOnly === true, compactView: x.compactView === true }; }
  catch { return { ...DEFAULT_SETTINGS }; }
}
export function saveSettings(settings: Settings): void { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
