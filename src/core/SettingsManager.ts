// Settings Manager - Local Storage Persistence
import type { AppSettings } from '../types/settings';
import { DEFAULT_SETTINGS } from '../types/settings';

const SETTINGS_KEY = 'paper-reader-settings';

export class SettingsManager {
  static load(): AppSettings {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (!stored) {
        return DEFAULT_SETTINGS;
      }
      const parsed = JSON.parse(stored) as Partial<AppSettings>;
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        theme: 'light', // FORCE LIGHT MODE
        // Ensure all keys exist
        apiKeys: { ...DEFAULT_SETTINGS.apiKeys, ...parsed.apiKeys },
        modelAssignments: { ...DEFAULT_SETTINGS.modelAssignments, ...parsed.modelAssignments },
        shortcuts: parsed.shortcuts || DEFAULT_SETTINGS.shortcuts,
      };
    } catch (error) {
      console.error('Failed to load settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  static save(settings: AppSettings): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  static reset(): AppSettings {
    localStorage.removeItem(SETTINGS_KEY);
    return DEFAULT_SETTINGS;
  }
}
