// src/components/SortableTab.tsx
// 🧩 Сортировка блоков внутри вкладки: дочерние <Section sortableId="..."/>
// рендерятся в порядке из персональных настроек (blockOrder). Перетаскивание
// активно только когда в «Настройки → Ассистент» снят замок.

import React, { isValidElement, type ReactElement, type ReactNode } from 'react';
import { loadAssistantSettings, saveAssistantSettings } from '../utils/assistantSettings';

export function SortableTab({ tabId, children }: { tabId: string; children: ReactNode }) {
  const ui = loadAssistantSettings();
  const unlocked = !ui.layoutLocked;
  const order = ui.blockOrder[tabId] ?? [];

  const kids = React.Children.toArray(children).filter(isValidElement) as ReactElement<{ sortableId?: string }>[];

  // Стабильная сортировка: секции из blockOrder — по порядку, остальные — после них
  const sorted = [...kids].sort((a, b) => {
    const ia = order.indexOf(a.props.sortableId ?? '');
    const ib = order.indexOf(b.props.sortableId ?? '');
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  const handleDropSection = (dragId: string, targetId: string, before: boolean) => {
    const current = sorted.map(k => k.props.sortableId).filter((x): x is string => !!x);
    const arr = current.filter(x => x !== dragId);
    let to = arr.indexOf(targetId);
    if (to < 0) return;
    if (!before) to += 1;
    arr.splice(to, 0, dragId);
    const next = loadAssistantSettings();
    saveAssistantSettings({ ...next, blockOrder: { ...next.blockOrder, [tabId]: arr } });
  };

  return (
    <>
      {sorted.map(el =>
        el.props.sortableId
          ? React.cloneElement(el as ReactElement<any>, { unlocked, onDropSection: handleDropSection })
          : el
      )}
    </>
  );
}
