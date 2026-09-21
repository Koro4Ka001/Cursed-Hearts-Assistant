// src/utils/assistantSettings.ts
// Персональные настройки интерфейса ассистента: хранятся в localStorage,
// поэтому у каждого игрока (каждого браузера) — свои.

export type AssistantTabId = 'combat' | 'magic' | 'actions' | 'rage' | 'notes' | 'rok' | 'hunger';

export interface AssistantUISettings {
  visibleTabs: Record<AssistantTabId, boolean>;
  showTokenBars: boolean;
  showNotifications: boolean;
  /** 📢 Уведомления через системные тосты Owlbear (гарантированно не перекрывают карту) */
  useSystemToasts: boolean;
  /** Замок перетаскивания блоков: true (по умолчанию) — блоки закреплены */
  layoutLocked: boolean;
  /** Порядок секций по вкладкам: tabId → [sectionId, ...] (несортируемые вкладки отсутствуют) */
  blockOrder: Record<string, string[]>;
}

const STORAGE_KEY = 'ch-assistant-ui-settings';
export const ASSISTANT_UI_EVENT = 'ch-assistant-ui-changed';

const DEFAULTS: AssistantUISettings = {
  // Все вкладки включены по умолчанию, кроме «Карты Рока» и «Голода»
  visibleTabs: { combat: true, magic: true, actions: true, rage: true, notes: true, rok: false, hunger: false },
  showTokenBars: true,
  showNotifications: true,
  useSystemToasts: false,
  layoutLocked: true,
  blockOrder: {},
};

function defaults(): AssistantUISettings {
  return {
    ...DEFAULTS,
    visibleTabs: { ...DEFAULTS.visibleTabs },
    blockOrder: { ...DEFAULTS.blockOrder },
  };
}

export function loadAssistantSettings(): AssistantUISettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as Partial<AssistantUISettings>;
    return {
      showTokenBars: parsed.showTokenBars ?? DEFAULTS.showTokenBars,
      showNotifications: parsed.showNotifications ?? DEFAULTS.showNotifications,
      useSystemToasts: parsed.useSystemToasts ?? DEFAULTS.useSystemToasts,
      visibleTabs: { ...DEFAULTS.visibleTabs, ...(parsed.visibleTabs ?? {}) },
      layoutLocked: parsed.layoutLocked ?? DEFAULTS.layoutLocked,
      blockOrder: parsed.blockOrder ?? {},
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
