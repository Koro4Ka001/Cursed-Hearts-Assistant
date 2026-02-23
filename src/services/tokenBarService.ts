// src/services/tokenBarService.ts

// ... (импорты и CONFIG те же) ...

// ... внутри класса TokenBarService ...

  async createBars(
    tokenId: string,
    hp: number,
    maxHp: number,
    mana: number,
    maxMana: number,
    useManaAsHp = false
  ): Promise<void> {
    if (!tokenId) {
      console.warn("[Bars] No tokenId provided");
      return;
    }

    try {
      const ready = await OBR.scene.isReady();
      if (!ready) {
        console.warn("[Bars] Scene not ready");
        return;
      }

      await this.removeExistingBarsFromScene(tokenId);
      this.bars.delete(tokenId);
      this.states.delete(tokenId);

      const items = await OBR.scene.items.getItems([tokenId]);
      if (!items.length) {
        console.warn(`[Bars] Token ${tokenId} not found on scene`);
        return;
      }
      
      const token = items[0];
      // Проверка типа элемента
      if (token.type !== 'IMAGE') {
        console.warn(`[Bars] Item ${tokenId} type is ${token.type}, expected IMAGE`);
        return;
      }

      const imgToken = token as Image;

      // Безопасный расчет размеров
      const scaleX = imgToken.scale?.x ?? 1;
      const scaleY = imgToken.scale?.y ?? 1;
      const width = imgToken.image?.width ?? 100;
      const height = imgToken.image?.height ?? 100;

      const tokenRealWidth = width * scaleX;
      const barW = Math.max(CONFIG.MIN_BAR_WIDTH, tokenRealWidth * CONFIG.BAR_WIDTH_RATIO);

      const showHp = !useManaAsHp;
      const { barX, hpBarY, manaBarY } = 
        this.calculateBarPositions(imgToken, barW, showHp);

      const dead = this.isDead(hp);
      const hpPct = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
      const manaPct = maxMana > 0 ? Math.max(0, Math.min(1, mana / maxMana)) : 0;

      const ts = Date.now();
      const ids: BarIds = {
        hpBg: `${BAR_PREFIX}/hpbg/${tokenId}/${ts}`,
        hpFill: `${BAR_PREFIX}/hpfill/${tokenId}/${ts}`,
        manaBg: `${BAR_PREFIX}/manabg/${tokenId}/${ts}`,
        manaFill: `${BAR_PREFIX}/manafill/${tokenId}/${ts}`,
      };

      const shapes: Shape[] = [];

      // Функция-хелпер для создания шейпа (чтобы не дублировать код)
      const makeBar = (id: string, w: number, h: number, x: number, y: number, color: string, z: number, visible: boolean, stroke?: string) => {
        const builder = buildShape()
          .shapeType("RECTANGLE")
          .width(w)
          .height(h)
          .position({ x, y })
          .attachedTo(tokenId)
          .layer("ATTACHMENT") // ⚠️ Может быть причиной ошибки, если слой недоступен
          .locked(true)
          .disableHit(true)
          .visible(visible)
          .fillColor(color)
          .zIndex(z)
          .id(id)
          .metadata({ [METADATA_KEY]: { type: "bar", tokenId } });
        
        if (stroke) {
          builder.strokeColor(stroke).strokeWidth(1);
        } else {
          builder.strokeWidth(0);
        }
        
        return builder.build();
      };

      // HP BAR
      if (showHp) {
        shapes.push(makeBar(ids.hpBg, barW, CONFIG.BAR_HEIGHT, barX, hpBarY, CONFIG.HP_BG, 1, token.visible && !dead, CONFIG.HP_STROKE));
        
        const hpFillW = Math.max(0, (barW - 2) * hpPct);
        shapes.push(makeBar(ids.hpFill, hpFillW, CONFIG.BAR_HEIGHT - 2, barX + 1, hpBarY + 1, this.getHpColor(hp, maxHp), 2, token.visible && !dead && hpPct > 0));
      }

      // MANA BAR
      if (!dead) {
        shapes.push(makeBar(ids.manaBg, barW, CONFIG.BAR_HEIGHT, barX, manaBarY, useManaAsHp ? CONFIG.HP_BG : CONFIG.MANA_BG, 1, token.visible, useManaAsHp ? CONFIG.HP_STROKE : CONFIG.MANA_STROKE));
        
        const manaFillW = Math.max(0, (barW - 2) * manaPct);
        shapes.push(makeBar(ids.manaFill, manaFillW, CONFIG.BAR_HEIGHT - 2, barX + 1, manaBarY + 1, useManaAsHp ? this.getHpColor(mana, maxMana) : CONFIG.MANA_FILL, 2, token.visible && manaPct > 0));
      }

      await OBR.scene.items.addItems(shapes);
      
      this.bars.set(tokenId, ids);
      this.states.set(tokenId, { 
        tokenId, hp, maxHp, mana, maxMana, useManaAsHp,
        tokenX: token.position.x, tokenY: token.position.y, tokenW: tokenRealWidth, tokenH: height * scaleY, barW,
        isDead: dead
      });

      if (showHp && dead && this.mode === 'quality') {
        await this.createDeathEffect(tokenId);
      }

    } catch (e: any) {
      // 🔥 ДЕТАЛЬНЫЙ ВЫВОД ОШИБКИ
      console.error("[Bars] Create error details:", JSON.stringify(e, Object.getOwnPropertyNames(e)));
      console.error("[Bars] Raw error:", e);
    }
  }

  // ... (остальной код тот же)
