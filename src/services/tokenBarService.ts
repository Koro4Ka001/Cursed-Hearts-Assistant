import OBR, { buildShape, Item, isImage, isShape, Shape, Image } from "@owlbear-rodeo/sdk";

const METADATA_KEY = "cursed-hearts-assistant";
const BAR_PREFIX = `${METADATA_KEY}/bar`;

const CONFIG = {
  BAR_HEIGHT: 6,
  BAR_GAP: 2,
  BAR_OFFSET: 1,
  MIN_BAR_WIDTH: 40,
  MAX_BAR_WIDTH: 120,
  BAR_WIDTH_RATIO: 0.8,
  HP_BG: "#1a0808", HP_STROKE: "#4a2020",
  HP_HIGH: "#8b0000", HP_MED: "#cc4400", HP_LOW: "#ff2200", HP_CRIT: "#ff0000",
  MANA_BG: "#080818", MANA_STROKE: "#202050", MANA_FILL: "#2244aa",
  ANIM_INTERVAL: 100,
} as const;

interface BarState {
  tokenId: string;
  hp: number; maxHp: number;
  mana: number; maxMana: number;
  useManaAsHp: boolean;
  tokenX: number; tokenY: number; tokenH: number; barW: number;
  isDead: boolean;
  ids?: { hpBg: string; hpFill: string; manaBg: string; manaFill: string; }
}

class TokenBarService {
  private states = new Map<string, BarState>();
  private initialized = false;
  private animInterval: number | null = null;
  private frame = 0;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const ready = await OBR.scene.isReady();
      if (!ready) {
        OBR.scene.onReadyChange(async (r) => { if (r && !this.initialized) await this.doInit(); });
        return;
      }
      await this.doInit();
    } catch (e) { console.error("[Bars] Init error:", e); }
  }

  private async doInit(): Promise<void> {
    await this.cleanup();
    this.startAnim();
    this.initialized = true;
    console.log("[Bars] Ready");
  }

  private isDead(hp: number): boolean { return hp <= 0; }

  // 🔹 ВАЖНО: Удаляем ВСЕ бары, привязанные к этому токену, чтобы избежать дублей
  private async removeExistingBars(tokenId: string): Promise<void> {
    try {
      const items = await OBR.scene.items.getItems();
      // Ищем элементы, которые начинаются с нашего префикса И привязаны к этому токену
      const toDelete = items.filter(i => 
        i.id.startsWith(BAR_PREFIX) && i.attachedTo === tokenId
      );
      if (toDelete.length > 0) {
        await OBR.scene.items.deleteItems(toDelete.map(i => i.id));
      }
    } catch (e) {
      console.warn("Error removing existing bars", e);
    }
  }

  async createBars(tokenId: string, hp: number, maxHp: number, mana: number, maxMana: number, useManaAsHp = false): Promise<void> {
    if (!tokenId) return;
    try {
      const ready = await OBR.scene.isReady();
      if (!ready) return;

      // Сначала чистим
      await this.removeExistingBars(tokenId);

      const items = await OBR.scene.items.getItems([tokenId]);
      if (!items.length || !isImage(items[0])) return;

      const token = items[0] as Image;
      const tokenW = token.image.width * token.scale.x;
      const tokenH = token.image.height * token.scale.y;
      const barW = Math.min(CONFIG.MAX_BAR_WIDTH, Math.max(CONFIG.MIN_BAR_WIDTH, tokenW * CONFIG.BAR_WIDTH_RATIO));
      
      const barX = token.position.x - barW / 2;
      const hpBarY = token.position.y + tokenH / 2 + CONFIG.BAR_OFFSET;
      const manaBarY = !useManaAsHp ? hpBarY + CONFIG.BAR_HEIGHT + CONFIG.BAR_GAP : hpBarY;

      const dead = this.isDead(hp);
      const hpPct = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
      const manaPct = maxMana > 0 ? Math.max(0, Math.min(1, mana / maxMana)) : 0;

      const ts = Date.now();
      const ids = {
        hpBg: `${BAR_PREFIX}/hpbg/${tokenId}/${ts}`,
        hpFill: `${BAR_PREFIX}/hpfill/${tokenId}/${ts}`,
        manaBg: `${BAR_PREFIX}/manabg/${tokenId}/${ts}`,
        manaFill: `${BAR_PREFIX}/manafill/${tokenId}/${ts}`,
      };

      const shapes: Shape[] = [];

      if (!useManaAsHp) {
        shapes.push(
          buildShape().shapeType("RECTANGLE").width(barW).height(CONFIG.BAR_HEIGHT)
            .position({ x: barX, y: hpBarY }).attachedTo(tokenId).layer("ATTACHMENT")
            .locked(true).disableHit(true).visible(token.visible && !dead)
            .fillColor(CONFIG.HP_BG).strokeColor(CONFIG.HP_STROKE).strokeWidth(1)
            .id(ids.hpBg).build(),
          buildShape().shapeType("RECTANGLE").width(Math.max(1, (barW - 2) * hpPct))
            .height(CONFIG.BAR_HEIGHT - 2).position({ x: barX + 1, y: hpBarY + 1 })
            .attachedTo(tokenId).layer("ATTACHMENT").locked(true).disableHit(true)
            .visible(token.visible && !dead && hpPct > 0).fillColor(this.hpColor(hpPct))
            .strokeWidth(0).id(ids.hpFill).build()
        );
      }

      shapes.push(
        buildShape().shapeType("RECTANGLE").width(barW).height(CONFIG.BAR_HEIGHT)
          .position({ x: barX, y: manaBarY }).attachedTo(tokenId).layer("ATTACHMENT")
          .locked(true).disableHit(true).visible(token.visible)
          .fillColor(useManaAsHp ? CONFIG.HP_BG : CONFIG.MANA_BG)
          .strokeColor(useManaAsHp ? CONFIG.HP_STROKE : CONFIG.MANA_STROKE).strokeWidth(1)
          .id(ids.manaBg).build(),
        buildShape().shapeType("RECTANGLE").width(Math.max(1, (barW - 2) * manaPct))
          .height(CONFIG.BAR_HEIGHT - 2).position({ x: barX + 1, y: manaBarY + 1 })
          .attachedTo(tokenId).layer("ATTACHMENT").locked(true).disableHit(true)
          .visible(token.visible && manaPct > 0)
          .fillColor(useManaAsHp ? this.hpColor(manaPct) : CONFIG.MANA_FILL)
          .strokeWidth(0).id(ids.manaFill).build()
      );

      await OBR.scene.items.addItems(shapes);
      
      this.states.set(tokenId, { 
        tokenId, hp, maxHp, mana, maxMana, useManaAsHp,
        tokenX: token.position.x, tokenY: token.position.y, tokenH, barW,
        isDead: dead, ids
      });

      if (!useManaAsHp && dead) await this.createDeathEffect(tokenId);

    } catch (e) { console.error("[Bars] Create error:", e); }
  }

  async updateBars(tokenId: string, hp: number, maxHp: number, mana: number, maxMana: number, useManaAsHp = false): Promise<void> {
    const state = this.states.get(tokenId);
    // Если состояние не найдено или ID баров потеряны — пересоздаем полностью
    if (!state || !state.ids) {
      await this.createBars(tokenId, hp, maxHp, mana, maxMana, useManaAsHp);
      return;
    }

    try {
      const dead = this.isDead(hp);
      const wasDead = state.isDead;
      
      // Обновляем состояние
      state.hp = hp; state.maxHp = maxHp; state.mana = mana; state.maxMana = maxMana;
      state.isDead = dead;

      const items = await OBR.scene.items.getItems([state.ids.hpFill, state.ids.manaFill, state.ids.hpBg]);
      // Если элементы не найдены на сцене (удалены вручную) — пересоздаем
      if (items.length === 0) {
        await this.createBars(tokenId, hp, maxHp, mana, maxMana, useManaAsHp);
        return;
      }

      // Обновляем ширину (width)
      const hpPct = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
      const manaPct = maxMana > 0 ? Math.max(0, Math.min(1, mana / maxMana)) : 0;
      const barW = state.barW;

      await OBR.scene.items.updateItems([state.ids.hpFill, state.ids.manaFill, state.ids.hpBg], (items) => {
        for (const item of items) {
          if (!isShape(item)) continue;
          if (item.id === state.ids!.hpFill) {
            item.width = Math.max(1, (barW - 2) * hpPct);
            item.style.fillColor = this.hpColor(hpPct);
            item.visible = !dead && !useManaAsHp;
          } else if (item.id === state.ids!.manaFill) {
            item.width = Math.max(1, (barW - 2) * manaPct);
          } else if (item.id === state.ids!.hpBg) {
            item.visible = !dead && !useManaAsHp;
          }
        }
      });

      if (!useManaAsHp) {
        if (dead && !wasDead) await this.createDeathEffect(tokenId);
        else if (!dead && wasDead) await this.removeDeathEffect(tokenId);
      }

    } catch (e) {
      // При любой ошибке обновления — пересоздаем
      await this.createBars(tokenId, hp, maxHp, mana, maxMana, useManaAsHp);
    }
  }

  async removeBars(tokenId: string): Promise<void> {
    await this.removeExistingBars(tokenId);
    this.states.delete(tokenId);
  }

  private async createDeathEffect(tokenId: string): Promise<void> {
    // Упрощенная логика: создаем 2 скрещенные линии (крест)
    const state = this.states.get(tokenId);
    if (!state) return;
    
    const size = 20;
    const x = state.tokenX;
    const y = state.tokenY + state.tokenH / 2 + CONFIG.BAR_OFFSET + 4;

    const cross1 = buildShape().shapeType("RECTANGLE").width(size).height(4)
      .position({ x: x - size/2, y }).rotation(45).fillColor("#550000")
      .attachedTo(tokenId).layer("ATTACHMENT").locked(true).disableHit(true)
      .metadata({ [METADATA_KEY]: { type: "crack" } }).build();
      
    const cross2 = buildShape().shapeType("RECTANGLE").width(size).height(4)
      .position({ x: x - size/2, y }).rotation(-45).fillColor("#550000")
      .attachedTo(tokenId).layer("ATTACHMENT").locked(true).disableHit(true)
      .metadata({ [METADATA_KEY]: { type: "crack" } }).build();

    await OBR.scene.items.addItems([cross1, cross2]);
  }

  private async removeDeathEffect(tokenId: string): Promise<void> {
    const items = await OBR.scene.items.getItems();
    const cracks = items.filter(i => i.attachedTo === tokenId && i.metadata?.[METADATA_KEY]?.type === "crack");
    if (cracks.length) await OBR.scene.items.deleteItems(cracks.map(i => i.id));
  }

  private hpColor(pct: number): string {
    if (pct < 0.25) return CONFIG.HP_CRIT;
    if (pct < 0.5) return CONFIG.HP_MED;
    return CONFIG.HP_HIGH;
  }

  private async cleanup(): Promise<void> {
    const items = await OBR.scene.items.getItems();
    const ours = items.filter(i => i.id.startsWith(BAR_PREFIX) || i.metadata?.[METADATA_KEY]?.type === "crack");
    if (ours.length) await OBR.scene.items.deleteItems(ours.map(i => i.id));
  }

  private startAnim(): void {
    if (this.animInterval) return;
    this.animInterval = window.setInterval(() => { this.frame++; }, CONFIG.ANIM_INTERVAL);
  }
}

export const tokenBarService = new TokenBarService();
