// src/services/toastOnMapService.ts
import OBR, { buildShape, buildText, Item } from "@owlbear-rodeo/sdk";
import type { BroadcastMessage } from "./diceService";

interface ToastItem {
  id: string;
  items: string[];
  timeoutId: number;
}

class ToastOnMapService {
  private toasts: Map<string, ToastItem> = new Map();
  private readonly TOAST_PREFIX = "cursed-hearts-toast-";
  private readonly TOAST_DURATION = 5000;
  
  async initialize(): Promise<void> {
    console.log('[ToastOnMap] Initializing...');
    await this.clearAllToasts();
  }

  async showToast(msg: BroadcastMessage): Promise<void> {
    console.log('[ToastOnMap] Showing toast:', msg.title);
    
    try {
      const scene = await OBR.scene.isReady();
      if (!scene) {
        console.warn('[ToastOnMap] Scene not ready');
        return;
      }

      // Получаем позицию камеры
      const position = await OBR.viewport.getPosition();
      const scale = await OBR.viewport.getScale();
      const viewWidth = await OBR.viewport.getWidth();
      const viewHeight = await OBR.viewport.getHeight();
      
      // Вычисляем bounds из позиции и размера viewport
      const bounds = {
        min: { x: position.x, y: position.y },
        max: { x: position.x + viewWidth / scale, y: position.y + viewHeight / scale }
      };
      
      // Позиция в правом нижнем углу
      const padding = 20 / scale;
      const width = 300 / scale;
      const height = 80 / scale;
      const index = this.toasts.size;
      const spacing = 10 / scale;
      
      const x = bounds.max.x - width - padding;
      const y = bounds.max.y - height - padding - (height + spacing) * index;
      
      const items: Item[] = [];
      
      // Фоновый прямоугольник
      const bgId = `${this.TOAST_PREFIX}bg-${msg.id}`;
      const bg = buildShape()
        .shapeType("RECTANGLE")
        .width(width)
        .height(height)
        .position({ x, y })
        .fillColor(this.getBgColor(msg))
        .strokeColor(this.getBorderColor(msg))
        .strokeWidth(2)
        .layer("DRAWING")
        .name("Toast Background")
        .locked(true)
        .disableHit(true)
        .visible(true)
        .id(bgId)
        .metadata({ toast: true })
        .build();
      
      items.push(bg);
      
      // Текст заголовка
      const titleId = `${this.TOAST_PREFIX}title-${msg.id}`;
      const title = buildText()
        .position({ x: x + padding/2, y: y + padding/2 })
        .plainText(`${msg.icon || '🎲'} ${msg.unitName ? `[${msg.unitName}] ` : ''}${msg.title}`)
        .fontSize(16 / scale)
        .fontFamily("Arial")
        .fillColor("#FFFFFF")
        .strokeColor("#000000")
        .strokeWidth(1)
        .textType("PLAIN")
        .layer("DRAWING")
        .name("Toast Title")
        .locked(true)
        .disableHit(true)
        .visible(true)
        .id(titleId)
        .metadata({ toast: true })
        .build();
      
      items.push(title);
      
      // Дополнительный текст
      if (msg.subtitle || msg.rolls) {
        const detailsId = `${this.TOAST_PREFIX}details-${msg.id}`;
        let detailsText = '';
        
        if (msg.subtitle) {
          detailsText += msg.subtitle + '\n';
        }
        
        if (msg.rolls && msg.rolls.length > 0) {
          const showRolls = msg.rolls.slice(0, 6).join(', ');
          const more = msg.rolls.length > 6 ? ` +${msg.rolls.length - 6}` : '';
          detailsText += `Броски: [${showRolls}${more}]`;
          if (msg.total !== undefined) {
            detailsText += ` = ${msg.total}`;
          }
        }
        
        const details = buildText()
          .position({ x: x + padding/2, y: y + height/2 })
          .plainText(detailsText)
          .fontSize(12 / scale)
          .fontFamily("Arial")
          .fillColor("#CCCCCC")
          .textType("PLAIN")
          .layer("DRAWING")
          .name("Toast Details")
          .locked(true)
          .disableHit(true)
          .visible(true)
          .id(detailsId)
          .metadata({ toast: true })
          .build();
        
        items.push(details);
      }
      
      // Добавляем на сцену
      await OBR.scene.items.addItems(items);
      console.log('[ToastOnMap] Added', items.length, 'items to scene');
      
      // Автоудаление
      const timeoutId = window.setTimeout(() => {
        this.removeToast(msg.id);
      }, this.TOAST_DURATION);
      
      this.toasts.set(msg.id, {
        id: msg.id,
        items: items.map(i => i.id),
        timeoutId
      });
      
    } catch (e) {
      console.error('[ToastOnMap] Error:', e);
    }
  }
  
  private getBgColor(msg: BroadcastMessage): string {
    if (msg.isCrit) return "#3a2e14";
    if (msg.isCritFail) return "#3a1414";
    
    const colors: Record<string, string> = {
      'gold': '#3a2e14',
      'blood': '#3a1414',
      'mana': '#142e3a',
      'green': '#143a14',
      'purple': '#2e143a',
      'white': '#2a2a2e'
    };
    return colors[msg.color || 'white'] || '#2a2a2e';
  }
  
  private getBorderColor(msg: BroadcastMessage): string {
    if (msg.isCrit) return "#e8d068";
    if (msg.isCritFail) return "#cc2222";
    
    const colors: Record<string, string> = {
      'gold': '#c8a84e',
      'blood': '#cc2222',
      'mana': '#4499dd',
      'green': '#44cc44',
      'purple': '#9650dc',
      'white': '#666666'
    };
    return colors[msg.color || 'white'] || '#666666';
  }
  
  private async removeToast(id: string): Promise<void> {
    console.log('[ToastOnMap] Removing toast:', id);
    
    const toast = this.toasts.get(id);
    if (!toast) return;
    
    clearTimeout(toast.timeoutId);
    
    try {
      await OBR.scene.items.deleteItems(toast.items);
    } catch (e) {
      console.warn('[ToastOnMap] Error removing items:', e);
    }
    
    this.toasts.delete(id);
  }
  
  private async clearAllToasts(): Promise<void> {
    console.log('[ToastOnMap] Clearing all toasts');
    
    try {
      const items = await OBR.scene.items.getItems();
      const toastItems = items.filter(item => 
        item.metadata?.toast === true || 
        (typeof item.id === 'string' && item.id.startsWith(this.TOAST_PREFIX))
      );
      
      if (toastItems.length > 0) {
        await OBR.scene.items.deleteItems(toastItems.map(i => i.id));
        console.log('[ToastOnMap] Cleared', toastItems.length, 'old toast items');
      }
    } catch (e) {
      console.warn('[ToastOnMap] Error clearing:', e);
    }
    
    this.toasts.forEach(t => clearTimeout(t.timeoutId));
    this.toasts.clear();
  }
}

export const toastOnMapService = new ToastOnMapService();
