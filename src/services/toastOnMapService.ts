// src/services/toastOnMapService.ts
import OBR, { buildText, buildImage, isText, Vector2 } from "@owlbear-rodeo/sdk";
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
  private readonly TOAST_HEIGHT = 120;
  private readonly TOAST_MARGIN = 10;
  
  async initialize(): Promise<void> {
    // Очистить старые тосты при инициализации
    await this.clearAllToasts();
  }

  async showToast(msg: BroadcastMessage): Promise<void> {
    try {
      const viewport = await OBR.viewport.getViewportCenter();
      const bounds = await OBR.viewport.getViewportBounds();
      
      // Позиция в правом нижнем углу экрана
      const index = this.toasts.size;
      const x = viewport.x + bounds.width / 2 - this.TOAST_WIDTH / 2 - 50;
      const y = viewport.y + bounds.height / 2 - (this.TOAST_HEIGHT + this.TOAST_MARGIN) * (index + 1) - 50;
      
      // Создаём фон тоста
      const bgId = `${this.TOAST_PREFIX}bg-${msg.id}`;
      const background = buildImage({
        id: bgId,
        image: {
          url: this.createToastBackground(msg),
          mime: "image/svg+xml"
        },
        position: { x, y },
        width: this.TOAST_WIDTH,
        height: this.TOAST_HEIGHT,
        layer: "POPOVER",
        disableHit: true,
        locked: true,
        visible: true,
        zIndex: 999990 + index * 2
      });

      // Создаём текст тоста
      const textId = `${this.TOAST_PREFIX}text-${msg.id}`;
      const text = buildText()
        .id(textId)
        .position({ x: x + 10, y: y + 10 })
        .plainText(this.formatToastText(msg))
        .textType("PLAIN")
        .fontSize(16)
        .fontFamily("Arial")
        .fillColor("#FFFFFF")
        .strokeColor("#000000")
        .strokeWidth(1)
        .layer("POPOVER")
        .disableHit(true)
        .locked(true)
        .visible(true)
        .zIndex(999991 + index * 2)
        .build();

      // Добавляем на сцену
      await OBR.scene.items.addItems([background, text]);

      // Анимация появления
      await this.animateIn(bgId, textId);

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
      console.warn('[ToastOnMap] Failed to show toast:', e);
    }
  }

  private createToastBackground(msg: BroadcastMessage): string {
    const color = this.getColor(msg);
    const isCrit = msg.isCrit;
    const isFail = msg.isCritFail;
    
    // SVG с градиентом и рамкой
    return `data:image/svg+xml,${encodeURIComponent(`
      <svg width="${this.TOAST_WIDTH}" height="${this.TOAST_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${color.bg1};stop-opacity:0.95" />
            <stop offset="100%" style="stop-color:${color.bg2};stop-opacity:0.98" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="${isCrit ? '5' : '2'}" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <rect x="2" y="2" width="${this.TOAST_WIDTH - 4}" height="${this.TOAST_HEIGHT - 4}" 
              rx="12" fill="url(#grad)" 
              stroke="${isCrit ? '#e8d068' : isFail ? '#cc2222' : color.border}" 
              stroke-width="2"
              filter="${isCrit ? 'url(#glow)' : ''}" />
        ${isCrit ? this.createCritRays() : ''}
        ${msg.icon ? this.createIcon(msg.icon, 20, 20) : ''}
      </svg>
    `)}`;
  }

  private createCritRays(): string {
    return `
      <g opacity="0.3">
        ${Array.from({length: 8}, (_, i) => `
          <line x1="160" y1="60" 
                x2="${160 + Math.cos(i * Math.PI / 4) * 200}" 
                y2="${60 + Math.sin(i * Math.PI / 4) * 200}" 
                stroke="#e8d068" stroke-width="1.5" />
        `).join('')}
      </g>
    `;
  }

  private createIcon(icon: string, x: number, y: number): string {
    return `<text x="${x}" y="${y + 20}" font-family="Arial" font-size="28" fill="#FFFFFF">${icon}</text>`;
  }

  private formatToastText(msg: BroadcastMessage): string {
    let text = '';
    
    if (msg.unitName) {
      text += `[${msg.unitName}]\n`;
    }
    
    text += msg.title;
    
    if (msg.subtitle) {
      text += `\n${msg.subtitle}`;
    }
    
    if (msg.rolls && msg.rolls.length > 0) {
      const showRolls = msg.rolls.slice(0, 6).join(', ');
      const more = msg.rolls.length > 6 ? ` +${msg.rolls.length - 6}` : '';
      text += `\nБроски: [${showRolls}${more}]`;
    }
    
    if (msg.total !== undefined) {
      text += ` = ${msg.total}`;
    }
    
    if (msg.isCrit) {
      text += '\n✨ КРИТИЧЕСКИЙ УСПЕХ! ✨';
    } else if (msg.isCritFail) {
      text += '\n💀 КРИТИЧЕСКИЙ ПРОВАЛ! 💀';
    }
    
    if (msg.hpBar) {
      text += `\nHP: ${msg.hpBar.current}/${msg.hpBar.max}`;
    }
    
    return text;
  }

  private getColor(msg: BroadcastMessage) {
    const colors: Record<string, {bg1: string, bg2: string, border: string}> = {
      'gold': { bg1: '#3a2e14', bg2: '#2a1e0a', border: '#c8a84e' },
      'blood': { bg1: '#3a1414', bg2: '#2a0a0a', border: '#cc2222' },
      'mana': { bg1: '#142e3a', bg2: '#0a1e2a', border: '#4499dd' },
      'green': { bg1: '#143a14', bg2: '#0a2a0a', border: '#44cc44' },
      'purple': { bg1: '#2e143a', bg2: '#1e0a2a', border: '#9650dc' },
      'white': { bg1: '#2a2a2e', bg2: '#1a1a1e', border: '#aaa' }
    };
    
    return colors[msg.color || 'white'] || colors.white;
  }

  private async animateIn(bgId: string, textId: string): Promise<void> {
    // Плавное появление
    await OBR.scene.items.updateItems([bgId, textId], items => {
      for (const item of items) {
        if (item.id === bgId || item.id === textId) {
          // Можно добавить scale или другие эффекты
          item.scale = { x: 1, y: 1 };
        }
      }
    });
  }

  private async removeToast(id: string): Promise<void> {
    const toast = this.toasts.get(id);
    if (!toast) return;
    
    clearTimeout(toast.timeoutId);
    
    // Удаляем с карты
    await OBR.scene.items.deleteItems([toast.bgId, toast.textId]).catch(console.warn);
    
    this.toasts.delete(id);
    
    // Сдвигаем остальные тосты вниз
    await this.repositionToasts();
  }

  private async repositionToasts(): Promise<void> {
    const viewport = await OBR.viewport.getViewportCenter();
    const bounds = await OBR.viewport.getViewportBounds();
    
    const toastArray = Array.from(this.toasts.values());
    
    for (let i = 0; i < toastArray.length; i++) {
      const toast = toastArray[i];
      const x = viewport.x + bounds.width / 2 - this.TOAST_WIDTH / 2 - 50;
      const y = viewport.y + bounds.height / 2 - (this.TOAST_HEIGHT + this.TOAST_MARGIN) * (i + 1) - 50;
      
      await OBR.scene.items.updateItems([toast.bgId, toast.textId], items => {
        for (const item of items) {
          item.position = { x, y };
          item.zIndex = 999990 + i * 2 + (item.id.includes('text') ? 1 : 0);
        }
      });
    }
  }

  private async clearAllToasts(): Promise<void> {
    const items = await OBR.scene.items.getItems();
    const toastItems = items.filter(item => item.id.startsWith(this.TOAST_PREFIX));
    
    if (toastItems.length > 0) {
      await OBR.scene.items.deleteItems(toastItems.map(i => i.id));
    }
    
    this.toasts.clear();
  }
}

export const toastOnMapService = new ToastOnMapService();
