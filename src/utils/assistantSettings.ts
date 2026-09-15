// src/utils/assistantSettings.ts
// Персональные настройки интерфейса ассистента: хранятся в localStorage,
// поэтому у каждого игрока (каждого браузера) — свои.

export type AssistantTabId = 'combat' | 'magic' | 'actions' | 'rage' | 'notes' | 'rok';

export interface AssistantUISettings {
  visibleTabs: Record<AssistantTabId, boolean>;
  showTokenBars: boolean;
  showNotifications: boolean;
}

const STORAGE_KEY = 'ch-assistant-ui-settings';
export const ASSISTANT_UI_EVENT = 'ch-assistant-ui-changed';

const DEFAULTS: AssistantUISettings = {
  // Все вкладки включены по умолчанию, кроме «Карты Рока»
  visibleTabs: { combat: true, magic: true, actions: true, rage: true, notes: true, rok: false },
  showTokenBars: true,
  showNotifications: true,
};

function defaults(): AssistantUISettings {
  return { ...DEFAULTS, visibleTabs: { ...DEFAULTS.visibleTabs } };
}

export function loadAssistantSettings(): AssistantUISettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as Partial<AssistantUISettings>;
    return {
      showTokenBars: parsed.showTokenBars ?? DEFAULTS.showTokenBars,
      showNotifications: parsed.showNotifications ?? DEFAULTS.showNotifications,
      visibleTabs: { ...DEFAULTS.visibleTabs, ...(parsed.visibleTabs ?? {}) },
    };
  } catch {
    return defaults();
  }
}

export function saveAssistantSettings(s: AssistantUISettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // localStorage недоступен — настройки просто не сохранятся
  }
  window.dispatchEvent(new CustomEvent(ASSISTANT_UI_EVENT));
}
