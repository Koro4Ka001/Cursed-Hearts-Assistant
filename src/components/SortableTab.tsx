// src/components/SortableTab.tsx
// 🧩 Сортировка блоков внутри вкладки: дочерние <Section sortableId="..."/>
// рендерятся в порядке из персональных настроек (blockOrder). Перетаскивание
// активно только когда в «Настройки → Ассистент» снят замок.

import React, { useEffect, isValidElement, type ReactElement, type ReactNode } from 'react';
import { loadAssistantSettings, saveAssistantSettings } from '../utils/assistantSettings';
import { isDraggingSection } from './ui';

/**
 * 🔧 Скролл во время перетаскивания: браузер блокирует колесо при нативном
 * drag&drop, поэтому крутим контейнер сами — колесом мыши и авто-прокруткой
 * у верхнего/нижнего края видимой области.
 */
function useDragScrolling(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    let dir = 0;
    let speed = 0;
    let container: HTMLElement | null = null;
    let raf = 0;

    const findScrollable = (x: number, y: number): HTMLElement | null => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      let node: HTMLElement | null = el;
      while (node) {
        const style = window.getComputedStyle(node);
        const scrollable = /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 4;
        if (scrollable) return node;
        node = node.parentElement;
      }
      return null;
    };

    // 🔧 Мягкая авто-прокрутка: узкая зона у края + скорость растёт плавно,
    // чем глубже в зону (2 → 9 px/кадр) — без резких рывков и болтанки.
    const EDGE = 36;
    const MAX_SPEED = 9;

    const onDragOver = (e: DragEvent) => {
      if (e.clientX === 0 && e.clientY === 0) return; // синтетическое событие
      container = findScrollable(e.clientX, e.clientY);
      if (!container) { dir = 0; speed = 0; return; }
      const rect = container.getBoundingClientRect();
      const topDist = e.clientY - rect.top;
      const botDist = rect.bottom - e.clientY;
      if (topDist < EDGE) {
        dir = -1;
        speed = 2 + (1 - Math.max(0, topDist) / EDGE) * (MAX_SPEED - 2);
      } else if (botDist < EDGE) {
        dir = 1;
        speed = 2 + (1 - Math.max(0, botDist) / EDGE) * (MAX_SPEED - 2);
      } else {
        dir = 0;
        speed = 0;
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (!isDraggingSection()) return;
      const c = findScrollable(e.clientX, e.clientY);
      if (c) {
        e.preventDefault();
        c.scrollTop += e.deltaY;
      }
    };

    const tick = () => {
      if (dir !== 0 && container) container.scrollTop += dir * speed;
      raf = requestAnimationFrame(tick);
    };

    const onEnd = () => { dir = 0; container = null; };

    document.addEventListener('dragover', onDragOver);
    document.addEventListener('dragend', onEnd);
    document.addEventListener('drop', onEnd);
    window.addEventListener('wheel', onWheel, { passive: false });
    raf = requestAnimationFrame(tick);

    return () => {
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('dragend', onEnd);
      document.removeEventListener('drop', onEnd);
      window.removeEventListener('wheel', onWheel);
      cancelAnimationFrame(raf);
    };
  }, [enabled]);
}

export function SortableTab({ tabId, children }: { tabId: string; children: ReactNode }) {
  const ui = loadAssistantSettings();
  const unlocked = !ui.layoutLocked;
  useDragScrolling(unlocked);
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
