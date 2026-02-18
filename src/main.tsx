// src/main.tsx
import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import OBR from "@owlbear-rodeo/sdk";
import "./index.css";
import { App } from "./App";
import { docsService } from "./services/docsService";
import { diceService, DICE_BROADCAST_CHANNEL, onLocalDiceMessage } from "./services/diceService";
import { tokenBarService } from "./services/tokenBarService";
import { useGameStore } from "./stores/useGameStore";

const NOTIFICATION_POPOVER_ID = "cursed-hearts-notification";
let popoverOpen = false;

// Открытие popover
async function openNotificationPopover() {
  if (popoverOpen) return;
  
  try {
    console.log("[Main] 🔓 Opening notification popover...");
    popoverOpen = true;
    
    await OBR.popover.open({
      id: NOTIFICATION_POPOVER_ID,
      url: "/notification.html",
      width: 320,
      height: 500,
      anchorOrigin: { horizontal: "LEFT", vertical: "BOTTOM" },
      transformOrigin: { horizontal: "LEFT", vertical: "BOTTOM" },
      disableClickAway: true,
      hidePaper: true,
      marginThreshold: 0
    });
    
    console.log("[Main] ✅ Popover opened");
  } catch (e) {
    console.log("[Main] ⚠️ Popover error:", e);
    popoverOpen = false;
  }
}

// Инициализация OBR
OBR.onReady(async () => {
  console.log("[Main] OBR Ready!");
  
  try {
    // Инициализируем сервисы
    await diceService.initialize();
    await tokenBarService.initialize();
    
    // Устанавливаем соединение
    useGameStore.getState().setConnection("owlbear", true);
    
    // Проверяем URL документа
    const settings = useGameStore.getState().settings;
    if (settings.googleDocsUrl) {
      console.log("[Main] Setting docs URL from saved settings");
      docsService.setUrl(settings.googleDocsUrl);
    }
    
    // Запускаем автосинхронизацию если включена
    if (settings.autoSyncInterval > 0) {
      console.log("[Main] Starting auto sync with interval:", settings.autoSyncInterval);
      useGameStore.getState().startAutoSync();
    }
    
    // Синхронизируем бары для существующих юнитов
    if (settings.showTokenBars) {
      const units = useGameStore.getState().units;
      console.log(`[Main] Syncing bars for ${units.length} units`);
      await tokenBarService.syncAllBars(units);
    }
    
    // ═══════════════════════════════════════════════════════════
    // СЛУШАЕМ ЛОКАЛЬНЫЕ СОБЫТИЯ (для себя)
    // ═══════════════════════════════════════════════════════════
    
    console.log("[Main] 📡 Setting up LOCAL message listener");
    
    onLocalDiceMessage((msg) => {
      console.log("[Main] 📨 Received LOCAL message:", msg.title);
      openNotificationPopover();
    });
    
    // ═══════════════════════════════════════════════════════════
    // СЛУШАЕМ BROADCAST (для других игроков)
    // ═══════════════════════════════════════════════════════════
    
    console.log("[Main] 📡 Setting up BROADCAST listener for:", DICE_BROADCAST_CHANNEL);
    
    OBR.broadcast.onMessage(DICE_BROADCAST_CHANNEL, async (event) => {
      console.log("[Main] 📨 Received BROADCAST:", event.data);
      openNotificationPopover();
    });
    
    console.log("[Main] ✓ Initialization complete!");
  } catch (error) {
    console.error("[Main] Initialization error:", error);
  }
});

// Монтируем React
const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

const root = createRoot(rootElement);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
