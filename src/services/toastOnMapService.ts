// src/services/toastOnMapService.ts
import OBR, { buildShape, buildText } from "@owlbear-rodeo/sdk";
import type { BroadcastMessage } from "./diceService";

interface ToastItem {
  id: string;
  textId: string;
  bgId: string;
  timeoutId: number;
  index: number;
}

class ToastOnMapService {
  private toasts: Map<string, ToastItem> = new Map();
  private readonly TOAST_PREFIX = "cursed-hearts-toast-";
  private readonly TOAST_DURATION = 5000;
  private readonly TOAST_WIDTH = 320;
  private readonly TOAST_HEIGHT = 100;
  private readonly TOAST_MARGIN = 10;
  
  async initialize(): Promise<void> {
    try {
      await this.clearAllToasts();
    } catch (e) {
      console.warn('[ToastOnMap] Init error:', e);
    }
  }

  async showToast(msg: BroadcastMessage): Promise<void> {
    try {
      const viewport = await OBR.viewport.getViewportCenter();
      const bounds = await OBR.viewport.getViewportBounds();
      
      const index = this.toasts.size;
      const x = viewport.x + bounds.width / 2 - this.TOAST_WIDTH - 50;
      const y = viewport.y + bounds.height / 2 - (this.TOAST_HEIGHT + this.TOAST_MARGIN) * (index + 1) - 50;
      
      // Создаём фон
      const bgId = `${this.TOAST_PREFIX}bg-${msg.id}`;
      const bgColor = this.getColor(msg.color || 'white');
      
      const background = buildShape()
        .shapeType("RECTANGLE")
        .width(this.TOAST_WIDTH)
        .height(this.TOAST_HEIGHT)
        .position({ x, y })
        .fillColor(bgColor)
        .strokeColor(msg.isCrit ? "#e8d068" : msg.isCritFail ? "#cc2222" : "#666666")
        .strokeWidth(2)
        .layer("POPOVER")
        .disableHit(true)
        .locked(true)
        .visible(true)
        .name(bgId)
        .id(bgId)
        .build();

      // Создаём текст
      const textId = `${this.TOAST_PREFIX}text-${msg.id}`;
      const textContent = this.formatText(msg);
      
      const text = buildText()
        .position({ x: x + 10, y: y + 10 })
        .plainText(textContent)
        .textType("PLAIN")
        .fontSize(14)
        .fontFamily("Arial")
        .fillColor("#FFFFFF")
        .strokeColor("#000000")
        .strokeWidth(1)
        .layer("POPOVER")
        .disableHit(true)
        .locked(true)
        .visible(true)
        .name(textId)
        .id(textId)
        .width(this.TOAST_WIDTH - 20)
        .height(this.TOAST_HEIGHT - 20)
        .build();

      // Добавляем на сцену
      await OBR.scene.items.addItems([background, text]);

      // Автоудаление
      const timeoutId = window.setTimeout(() => {
        this.removeToast(msg.id);
      }, this.TOAST_DURATION);

      this.toasts.set(msg.id, {
        id: msg.id,
        textId,
        bgId,
        timeoutId,
        index
      });

    } catch (e) {
      console.warn('[ToastOnMap] Show error:', e);
    }
  }

  private formatText(msg: BroadcastMessage): string {
    let text = '';
    
    // Иконка и юнит
    if (msg.icon) text += msg.icon + ' ';
    if (msg.unitName) text += `[${msg.unitName}] `;
    text += '\n';
    
    // Заголовок
    text += msg.title;
    
    // Подзаголовок
    if (msg.subtitle) {
      text += '\n' + msg.subtitle;
    }
    
    // Броски
    if (msg.rolls && msg.rolls.length > 0) {
      const showRolls = msg.rolls.slice(0, 6).join(', ');
      const more = msg.rolls.length > 6 ? ` +${msg.rolls.length - 6}` : '';
      text += `\n[${showRolls}${more}]`;
      
      if (msg.total !== undefined) {
        text += ` = ${msg.total}`;
      }
    }
    
    // Критические метки
    if (msg.isCrit) {
      text += '\n✨ КРИТ! ✨';
    } else if (msg.isCritFail) {
      text += '\n💀 ПРОВАЛ! 💀';
    }
    
    // HP бар
    if (msg.hpBar) {
      text += `\nHP: ${msg.hpBar.current}/${msg.hpBar.max}`;
    }
    
    return text;
  }

  private getColor(color: string): string {
    const colors: Record<string, string> = {
      'gold': '#3a2e14',
      'blood': '#3a1414',
      'mana': '#142e3a',
      'green': '#143a14',
      'purple': '#2e143a',
      'white': '#2a2a2e'
    };
    return colors[color] || colors.white;
  }

  private async removeToast(id: string): Promise<void> {
    const toast = this.toasts.get(id);
    if (!toast) return;
    
    clearTimeout(toast.timeoutId);
    
    try {
      await OBR.scene.items.deleteItems([toast.bgId, toast.textId]);
    } catch (e) {
      console.warn('[ToastOnMap] Remove error:', e);
    }
    
    this.toasts.delete(id);
    await this.repositionToasts();
  }

  private async repositionToasts(): Promise<void> {
    try {
      const viewport = await OBR.viewport.getViewportCenter();
      const bounds = await OBR.viewport.getViewportBounds();
      
      const toastArray = Array.from(this.toasts.values());
      const updateIds: string[] = [];
      
      toastArray.forEach((toast, i) => {
        toast.index = i;
        updateIds.push(toast.bgId, toast.textId);
      });
      
      if (updateIds.length === 0) return;
      
      await OBR.scene.items.updateItems(updateIds, items => {
        for (const item of items) {
          const toast = toastArray.find(t => t.bgId === item.id || t.textId === item.id);
          if (!toast) continue;
          
          const x = viewport.x + bounds.width / 2 - this.TOAST_WIDTH - 50;
          const y = viewport.y + bounds.height / 2 - (this.TOAST_HEIGHT + this.TOAST_MARGIN) * (toast.index + 1) - 50;
          
          item.position = { x, y };
        }
      });
    } catch (e) {
      console.warn('[ToastOnMap] Reposition error:', e);
    }
  }

  private async clearAllToasts(): Promise<void> {
    try {
      const items = await OBR.scene.items.getItems();
      const toastItems = items.filter(item => 
        typeof item.id === 'string' && item.id.startsWith(this.TOAST_PREFIX)
      );
      
      if (toastItems.length > 0) {
        await OBR.scene.items.deleteItems(toastItems.map(i => i.id));
      }
    } catch (e) {
      console.warn('[ToastOnMap] Clear error:', e);
    }
    
    this.toasts.forEach(t => clearTimeout(t.timeoutId));
    this.toasts.clear();
  }
}

export const toastOnMapService = new ToastOnMapService();
