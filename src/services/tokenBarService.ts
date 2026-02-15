// src/services/tokenBarService.ts
import OBR, { buildShape, buildText, isShape, Item, Vector2 } from "@owlbear-rodeo/sdk";

const EXT = "cursed-hearts-assistant";
const META = `${EXT}/bar-v2`;

// Размеры и позиции
const BAR_WIDTH = 120;
const HP_HEIGHT = 10;
const MANA_HEIGHT = 8;
const SPACING = 3;
const Y_OFFSET = 60;

// Типы элементов бара
type BarElement = 'bg' | 'fill' | 'border' | 'shine' | 'glow' | 'text' | 'effect';
type BarType = 'hp' | 'mana';

interface BarMeta {
  tokenId: string;
  barType: BarType;
  element: BarElement;
  effectType?: string;
}

interface UnitLike {
  owlbearTokenId?: string;
  health: { current: number; max: number };
  mana: { current: number; max: number };
  useManaAsHp?: boolean;
}

interface BarState {
  tokenId: string;
  lastHP: number;
  lastMana: number;
  pulseInterval?: number;
  glowInterval?: number;
}

class TokenBarService {
  private ready = false;
  private barStates: Map<string, BarState> = new Map();
  
  async initialize(): Promise<void> {
    if (this.ready) return;
    try {
      if (await OBR.scene.isReady()) {
        this.ready = true;
        console.log("[TokenBars] Enhanced bars ready");
      }
    } catch (e) {
      console.warn("[TokenBars] Init:", e);
    }
  }

  private async isReady(): Promise<boolean> {
    if (this.ready) return true;
    try {
      if (await OBR.scene.isReady()) {
        this.ready = true;
        return true;
      }
    } catch {}
    return false;
  }

  private getMeta(item: Item): BarMeta | null {
    try {
      const m = item.metadata?.[META];
      if (m && typeof m === "object") {
        return m as BarMeta;
      }
    } catch {}
    return null;
  }

  // Получить все элементы баров токена
  private async getBarItems(tokenId: string): Promise<Item[]> {
    const items = await OBR.scene.items.getItems();
    return items.filter(i => {
      const meta = this.getMeta(i);
      return meta?.tokenId === tokenId;
    });
  }

  // Цвет HP в зависимости от процента
  private getHPColor(ratio: number, current: number): string {
    if (current < 0) return "#440000"; // Тёмно-красный для отрицательного HP
    if (ratio > 0.5) return "#22cc44";
    if (ratio > 0.25) return "#ccaa22";
    return "#cc2222";
  }

  // Создание красивого HP бара
  private createHPBar(tokenId: string, current: number, max: number): Item[] {
    const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
    const isLow = ratio < 0.25;
    const isDead = current <= 0;
    const color = this.getHPColor(ratio, current);
    const items: Item[] = [];
    
    // Фоновая подложка
    items.push(
      buildShape()
        .shapeType("RECTANGLE")
        .width(BAR_WIDTH)
        .height(HP_HEIGHT)
        .position({ x: -BAR_WIDTH / 2, y: Y_OFFSET })
        .attachedTo(tokenId)
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(true)
        .zIndex(1)
        .name(`${EXT}-hp-bg`)
        .fillColor("#1a0808")
        .strokeColor("transparent")
        .strokeWidth(0)
        .metadata({ [META]: { tokenId, barType: 'hp', element: 'bg' } as BarMeta })
        .build()
    );

    // Заполнение
    const fillWidth = Math.max(1, BAR_WIDTH * ratio);
    items.push(
      buildShape()
        .shapeType("RECTANGLE")
        .width(fillWidth)
        .height(HP_HEIGHT)
        .position({ x: -BAR_WIDTH / 2, y: Y_OFFSET })
        .attachedTo(tokenId)
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(true)
        .zIndex(2)
        .name(`${EXT}-hp-fill`)
        .fillColor(color)
        .strokeColor("transparent")
        .strokeWidth(0)
        .metadata({ [META]: { tokenId, barType: 'hp', element: 'fill' } as BarMeta })
        .build()
    );

    // Золотая рамка
    items.push(
      buildShape()
        .shapeType("RECTANGLE")
        .width(BAR_WIDTH)
        .height(HP_HEIGHT)
        .position({ x: -BAR_WIDTH / 2, y: Y_OFFSET })
        .attachedTo(tokenId)
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(true)
        .zIndex(3)
        .name(`${EXT}-hp-border`)
        .fillColor("transparent")
        .strokeColor(isDead ? "#880000" : "#7a5a1e")
        .strokeWidth(isDead ? 2 : 1)
        .metadata({ [META]: { tokenId, barType: 'hp', element: 'border' } as BarMeta })
        .build()
    );

    // Блик сверху
    if (!isDead) {
      items.push(
        buildShape()
          .shapeType("RECTANGLE")
          .width(fillWidth * 0.8)
          .height(HP_HEIGHT * 0.3)
          .position({ x: -BAR_WIDTH / 2 + fillWidth * 0.1, y: Y_OFFSET + 1 })
          .attachedTo(tokenId)
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .visible(true)
          .zIndex(4)
          .name(`${EXT}-hp-shine`)
          .fillColor("#ffffff")
          .fillOpacity(0.2)
          .strokeColor("transparent")
          .strokeWidth(0)
          .metadata({ [META]: { tokenId, barType: 'hp', element: 'shine' } as BarMeta })
          .build()
      );
    }

    // Эффект свечения при низком HP
    if (isLow && !isDead) {
      items.push(
        buildShape()
          .shapeType("RECTANGLE")
          .width(BAR_WIDTH + 4)
          .height(HP_HEIGHT + 4)
          .position({ x: -BAR_WIDTH / 2 - 2, y: Y_OFFSET - 2 })
          .attachedTo(tokenId)
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .visible(true)
          .zIndex(0)
          .name(`${EXT}-hp-glow`)
          .fillColor("transparent")
          .strokeColor("#cc2222")
          .strokeWidth(2)
          .strokeOpacity(0.5)
          .metadata({ [META]: { tokenId, barType: 'hp', element: 'glow' } as BarMeta })
          .build()
      );
    }

    // "Трещины" при отрицательном HP
    if (isDead && current < 0) {
      // Трещина 1
      items.push(
        buildShape()
          .shapeType("POLYGON")
          .points([
            { x: -BAR_WIDTH / 2 + 20, y: Y_OFFSET },
            { x: -BAR_WIDTH / 2 + 22, y: Y_OFFSET + HP_HEIGHT / 2 },
            { x: -BAR_WIDTH / 2 + 25, y: Y_OFFSET + HP_HEIGHT }
          ])
          .attachedTo(tokenId)
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .visible(true)
          .zIndex(5)
          .name(`${EXT}-hp-crack-1`)
          .fillColor("#000000")
          .strokeColor("#cc0000")
          .strokeWidth(1)
          .metadata({ [META]: { tokenId, barType: 'hp', element: 'effect', effectType: 'crack' } as BarMeta })
          .build()
      );

      // Трещина 2
      items.push(
        buildShape()
          .shapeType("POLYGON")
          .points([
            { x: -BAR_WIDTH / 2 + 60, y: Y_OFFSET + HP_HEIGHT },
            { x: -BAR_WIDTH / 2 + 62, y: Y_OFFSET + HP_HEIGHT / 2 },
            { x: -BAR_WIDTH / 2 + 65, y: Y_OFFSET }
          ])
          .attachedTo(tokenId)
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .visible(true)
          .zIndex(5)
          .name(`${EXT}-hp-crack-2`)
          .fillColor("#000000")
          .strokeColor("#cc0000")
          .strokeWidth(1)
          .metadata({ [META]: { tokenId, barType: 'hp', element: 'effect', effectType: 'crack' } as BarMeta })
          .build()
      );
    }

    // Текст HP
    items.push(
      buildText()
        .position({ x: 0, y: Y_OFFSET + HP_HEIGHT / 2 })
        .attachedTo(tokenId)
        .plainText(`${current}/${max}`)
        .fontSize(8)
        .fontFamily("Arial")
        .textAlign("CENTER")
        .textAlignVertical("MIDDLE")
        .fillColor("#ffffff")
        .strokeColor("#000000")
        .strokeWidth(2)
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(true)
        .zIndex(6)
        .name(`${EXT}-hp-text`)
        .metadata({ [META]: { tokenId, barType: 'hp', element: 'text' } as BarMeta })
        .build()
    );

    return items;
  }

  // Создание красивого мана бара
  private createManaBar(tokenId: string, current: number, max: number): Item[] {
    const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
    const items: Item[] = [];
    const yPos = Y_OFFSET + HP_HEIGHT + SPACING;
    
    // Фоновая подложка
    items.push(
      buildShape()
        .shapeType("RECTANGLE")
        .width(BAR_WIDTH)
        .height(MANA_HEIGHT)
        .position({ x: -BAR_WIDTH / 2, y: yPos })
        .attachedTo(tokenId)
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(true)
        .zIndex(1)
        .name(`${EXT}-mana-bg`)
        .fillColor("#0e1a28")
        .strokeColor("transparent")
        .strokeWidth(0)
        .metadata({ [META]: { tokenId, barType: 'mana', element: 'bg' } as BarMeta })
        .build()
    );

    // Заполнение
    const fillWidth = Math.max(1, BAR_WIDTH * ratio);
    items.push(
      buildShape()
        .shapeType("RECTANGLE")
        .width(fillWidth)
        .height(MANA_HEIGHT)
        .position({ x: -BAR_WIDTH / 2, y: yPos })
        .attachedTo(tokenId)
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(true)
        .zIndex(2)
        .name(`${EXT}-mana-fill`)
        .fillColor("#4499dd")
        .strokeColor("transparent")
        .strokeWidth(0)
        .metadata({ [META]: { tokenId, barType: 'mana', element: 'fill' } as BarMeta })
        .build()
    );

    // Золотая рамка
    items.push(
      buildShape()
        .shapeType("RECTANGLE")
        .width(BAR_WIDTH)
        .height(MANA_HEIGHT)
        .position({ x: -BAR_WIDTH / 2, y: yPos })
        .attachedTo(tokenId)
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(true)
        .zIndex(3)
        .name(`${EXT}-mana-border`)
        .fillColor("transparent")
        .strokeColor("#1a3a5a")
        .strokeWidth(1)
        .metadata({ [META]: { tokenId, barType: 'mana', element: 'border' } as BarMeta })
        .build()
    );

    // Блик
    items.push(
      buildShape()
        .shapeType("RECTANGLE")
        .width(fillWidth * 0.8)
        .height(MANA_HEIGHT * 0.3)
        .position({ x: -BAR_WIDTH / 2 + fillWidth * 0.1, y: yPos + 1 })
        .attachedTo(tokenId)
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(true)
        .zIndex(4)
        .name(`${EXT}-mana-shine`)
        .fillColor("#aaccff")
        .fillOpacity(0.3)
        .strokeColor("transparent")
        .strokeWidth(0)
        .metadata({ [META]: { tokenId, barType: 'mana', element: 'shine' } as BarMeta })
        .build()
    );

    // Свечение маны
    if (ratio > 0.8) {
      items.push(
        buildShape()
          .shapeType("RECTANGLE")
          .width(BAR_WIDTH + 4)
          .height(MANA_HEIGHT + 4)
          .position({ x: -BAR_WIDTH / 2 - 2, y: yPos - 2 })
          .attachedTo(tokenId)
          .layer("ATTACHMENT")
          .locked(true)
          .disableHit(true)
          .visible(true)
          .zIndex(0)
          .name(`${EXT}-mana-glow`)
          .fillColor("transparent")
          .strokeColor("#4499dd")
          .strokeWidth(2)
          .strokeOpacity(0.4)
          .metadata({ [META]: { tokenId, barType: 'mana', element: 'glow' } as BarMeta })
          .build()
      );
    }

    // Текст маны
    items.push(
      buildText()
        .position({ x: 0, y: yPos + MANA_HEIGHT / 2 })
        .attachedTo(tokenId)
        .plainText(`${current}/${max}`)
        .fontSize(7)
        .fontFamily("Arial")
        .textAlign("CENTER")
        .textAlignVertical("MIDDLE")
        .fillColor("#aaccff")
        .strokeColor("#000000")
        .strokeWidth(2)
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(true)
        .zIndex(6)
        .name(`${EXT}-mana-text`)
        .metadata({ [META]: { tokenId, barType: 'mana', element: 'text' } as BarMeta })
        .build()
    );

    return items;
  }

  // Создать бары для токена
  async createBars(
    tokenId: string,
    hpCurrent: number,
    hpMax: number,
    manaCurrent: number,
    manaMax: number,
    useManaAsHp?: boolean
  ): Promise<void> {
    if (!(await this.isReady())) return;
    
    try {
      // Удаляем старые бары
      await this.removeBars(tokenId);
      
      // Создаём новые
      const items = [
        ...this.createHPBar(tokenId, hpCurrent, hpMax),
        ...this.createManaBar(tokenId, manaCurrent, manaMax)
      ];
      
      await OBR.scene.items.addItems(items);
      
      // Сохраняем состояние
      this.barStates.set(tokenId, {
        tokenId,
        lastHP: hpCurrent,
        lastMana: manaCurrent
      });
      
      // Запускаем эффекты
      this.startEffects(tokenId, hpCurrent / hpMax);
      
    } catch (e) {
      console.warn("[TokenBars] Create error:", e);
    }
  }

  // Обновить бары
  async updateBars(
    tokenId: string,
    hpCurrent: number,
    hpMax: number,
    manaCurrent: number,
    manaMax: number,
    useManaAsHp?: boolean
  ): Promise<void> {
    if (!(await this.isReady())) return;
    
    try {
      const state = this.barStates.get(tokenId);
      const items = await this.getBarItems(tokenId);
      
      if (items.length < 10) {
        // Если баров нет или они неполные - создаём заново
        await this.createBars(tokenId, hpCurrent, hpMax, manaCurrent, manaMax, useManaAsHp);
        return;
      }
      
      // Обновляем существующие бары
      const updateIds: string[] = [];
      const updateMap = new Map<string, (item: Item) => void>();
      
      // Подготовка обновлений
      for (const item of items) {
        const meta = this.getMeta(item);
        if (!meta) continue;
        
        if (meta.barType === 'hp') {
          if (meta.element === 'fill') {
            updateIds.push(item.id);
            const ratio = hpMax > 0 ? Math.max(0, Math.min(1, hpCurrent / hpMax)) : 0;
            const newColor = this.getHPColor(ratio, hpCurrent);
            updateMap.set(item.id, (i) => {
              if (isShape(i)) {
                i.width = Math.max(1, BAR_WIDTH * ratio);
                i.style.fillColor = newColor;
              }
            });
          } else if (meta.element === 'text') {
            updateIds.push(item.id);
            updateMap.set(item.id, (i) => {
              if (i.text) {
                i.text.plainText = `${hpCurrent}/${hpMax}`;
              }
            });
          } else if (meta.element === 'border' && hpCurrent <= 0) {
            updateIds.push(item.id);
            updateMap.set(item.id, (i) => {
              if (isShape(i)) {
                i.style.strokeColor = "#880000";
                i.style.strokeWidth = 2;
              }
            });
          }
        } else if (meta.barType === 'mana') {
          if (meta.element === 'fill') {
            updateIds.push(item.id);
            const ratio = manaMax > 0 ? Math.max(0, Math.min(1, manaCurrent / manaMax)) : 0;
            updateMap.set(item.id, (i) => {
              if (isShape(i)) {
                i.width = Math.max(1, BAR_WIDTH * ratio);
              }
            });
          } else if (meta.element === 'text') {
            updateIds.push(item.id);
            updateMap.set(item.id, (i) => {
              if (i.text) {
                i.text.plainText = `${manaCurrent}/${manaMax}`;
              }
            });
          }
        }
      }
      
      // Применяем обновления
      if (updateIds.length > 0) {
        await OBR.scene.items.updateItems(updateIds, (items) => {
          for (const item of items) {
            const updater = updateMap.get(item.id);
            if (updater) updater(item);
          }
        });
      }
      
      // Эффекты при изменении
      if (state) {
        // Эффект исцеления
        if (hpCurrent > state.lastHP) {
          await this.showHealEffect(tokenId, hpCurrent - state.lastHP);
        }
        
        // Эффект урона
        if (hpCurrent < state.lastHP) {
          await this.showDamageEffect(tokenId);
        }
        
        // Обновляем состояние
        state.lastHP = hpCurrent;
        state.lastMana = manaCurrent;
      }
      
      // Обновляем эффекты
      this.stopEffects(tokenId);
      this.startEffects(tokenId, hpCurrent / hpMax);
      
    } catch (e) {
      console.warn("[TokenBars] Update error:", e);
    }
  }

  // Эффект исцеления
  private async showHealEffect(tokenId: string, amount: number): Promise<void> {
    try {
      // Создаём временную вспышку зелёного света
      const flash = buildShape()
        .shapeType("RECTANGLE")
        .width(BAR_WIDTH + 10)
        .height(HP_HEIGHT + MANA_HEIGHT + SPACING + 10)
        .position({ x: -BAR_WIDTH / 2 - 5, y: Y_OFFSET - 5 })
        .attachedTo(tokenId)
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(true)
        .zIndex(10)
        .fillColor("#22cc44")
        .fillOpacity(0.3)
        .strokeColor("#44ff66")
        .strokeWidth(2)
        .strokeOpacity(0.5)
        .build();
      
      await OBR.scene.items.addItems([flash]);
      
      // Удаляем через 500мс
      setTimeout(async () => {
        await OBR.scene.items.deleteItems([flash.id]);
      }, 500);
      
    } catch (e) {
      console.warn("[TokenBars] Heal effect error:", e);
    }
  }

  // Эффект урона
  private async showDamageEffect(tokenId: string): Promise<void> {
    try {
      // Создаём временную красную вспышку
      const flash = buildShape()
        .shapeType("RECTANGLE")
        .width(BAR_WIDTH + 10)
        .height(HP_HEIGHT + 10)
        .position({ x: -BAR_WIDTH / 2 - 5, y: Y_OFFSET - 5 })
        .attachedTo(tokenId)
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .visible(true)
        .zIndex(10)
        .fillColor("#cc2222")
        .fillOpacity(0.4)
        .strokeColor("transparent")
        .strokeWidth(0)
        .build();
      
      await OBR.scene.items.addItems([flash]);
      
      // Удаляем через 300мс
      setTimeout(async () => {
        await OBR.scene.items.deleteItems([flash.id]);
      }, 300);
      
    } catch (e) {
      console.warn("[TokenBars] Damage effect error:", e);
    }
  }

  // Запустить эффекты (пульсация при низком HP)
  private startEffects(tokenId: string, hpRatio: number): void {
    const state = this.barStates.get(tokenId);
    if (!state) return;
    
    // Пульсация при низком HP
    if (hpRatio < 0.25 && hpRatio > 0) {
      state.pulseInterval = window.setInterval(async () => {
        try {
          const items = await this.getBarItems(tokenId);
          const glow = items.find(i => {
            const meta = this.getMeta(i);
            return meta?.barType === 'hp' && meta?.element === 'glow';
          });
          
          if (glow) {
            await OBR.scene.items.updateItems([glow.id], (items) => {
              for (const item of items) {
                if (isShape(item)) {
                  // Переключаем видимость для эффекта пульсации
                  item.visible = !item.visible;
                }
              }
            });
          }
        } catch (e) {
          console.warn("[TokenBars] Pulse effect error:", e);
        }
      }, 500);
    }
  }

  // Остановить эффекты
  private stopEffects(tokenId: string): void {
    const state = this.barStates.get(tokenId);
    if (!state) return;
    
    if (state.pulseInterval) {
      clearInterval(state.pulseInterval);
      state.pulseInterval = undefined;
    }
    
    if (state.glowInterval) {
      clearInterval(state.glowInterval);
      state.glowInterval = undefined;
    }
  }

  // Удалить бары
  async removeBars(tokenId: string): Promise<void> {
    if (!(await this.isReady())) return;
    
    try {
      this.stopEffects(tokenId);
      this.barStates.delete(tokenId);
      
      const items = await this.getBarItems(tokenId);
      if (items.length > 0) {
        await OBR.scene.items.deleteItems(items.map(i => i.id));
      }
    } catch (e) {
      console.warn("[TokenBars] Remove error:", e);
    }
  }

  // Удалить все бары
  async removeAllBars(): Promise<void> {
    if (!(await this.isReady())) return;
    
    try {
      // Останавливаем все эффекты
      for (const tokenId of this.barStates.keys()) {
        this.stopEffects(tokenId);
      }
      this.barStates.clear();
      
      // Удаляем все бары
      const items = await OBR.scene.items.getItems();
      const barItems = items.filter(i => this.getMeta(i) !== null);
      
      if (barItems.length > 0) {
        await OBR.scene.items.deleteItems(barItems.map(i => i.id));
        console.log(`[TokenBars] Removed ${barItems.length} bar elements`);
      }
    } catch (e) {
      console.warn("[TokenBars] Remove all error:", e);
    }
  }

  // Синхронизировать бары для всех юнитов
  async syncAllBars(units: UnitLike[]): Promise<void> {
    for (const unit of units) {
      if (!unit.owlbearTokenId) continue;
      await this.updateBars(
        unit.owlbearTokenId,
        unit.health.current,
        unit.health.max,
        unit.mana.current,
        unit.mana.max,
        unit.useManaAsHp
      );
    }
  }
}

export const tokenBarService = new TokenBarService();
