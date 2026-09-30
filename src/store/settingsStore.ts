import { create } from 'zustand';
import { loadSettings, saveSettings } from '../storage/saveSystem';

let settingsPersistenceQueue: Promise<void> = Promise.resolve();

function queueSettingsSave(): void {
  const snapshot = useSettingsStore.getState();
  settingsPersistenceQueue = settingsPersistenceQueue.then(() => saveSettings(snapshot), () => saveSettings(snapshot)).catch(() => undefined);
}

export type SettingsState = {
  soundEnabled: boolean;
  animationSpeed: 'NORMAL' | 'FAST' | 'INSTANT';
  aiSpeed: 'NORMAL' | '2X' | 'INSTANT';
  allInConfirmation: boolean;
  autoShowWinningHand: boolean;
  shortDeckNotice: boolean;
};

export type SettingsStore = SettingsState & {
  updateSettings: (patch: Partial<SettingsState>) => void;
  save: () => Promise<void>;
  load: () => Promise<SettingsState | null>;
};

export const DEFAULT_SETTINGS: SettingsState = {
  soundEnabled: true,
  animationSpeed: 'NORMAL',
  aiSpeed: 'NORMAL',
  allInConfirmation: true,
  autoShowWinningHand: true,
  shortDeckNotice: true,
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  ...DEFAULT_SETTINGS,
  updateSettings: (patch) => set((state) => ({ ...state, ...patch })),
  save: async () => {
    queueSettingsSave();
    await settingsPersistenceQueue;
  },
  load: async () => {
    const settings = await loadSettings();
    if (settings) set(settings);
    return settings;
  },
}));
