// src/main.tsx
import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import OBR from "@owlbear-rodeo/sdk";
import "./index.css";
import { App } from "./App";
import { docsService } from "./services/docsService";
import { diceService, DICE_BROADCAST_CHANNEL, onLocalDiceMessage, LOCAL_STORAGE_KEY } from "./services/diceService";
import { tokenBarService } from "./services/tokenBarService";
import { useGameStore } from "./stores/useGameStore";
import { ErrorBoundary } from "./components/ui";
import type { BroadcastMessage } from "./services/diceService";

const NOTIFICATION_POPOVER_ID = "cursed-hearts-notification";

// Добавляем сообщение в очередь localStorage
function addToLocalQueue(msg: BroadcastMessage) {
  try {
    const existing = localStorage.getItem(LOCAL_STORAGE_KEY);
    let queue: BroadcastMessage[] = [];
    
    if (existing) {
      try {
        queue = JSON.parse(existing);
        if (!Array.isArray(queue)) queue = [];
      } catch {
        queue = [];
      }
    }
    
    queue.push(msg);
    if (queue.length > 10) queue = queue.slice(-10);
    
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn('[Main] localStorage error:', e);
  }
}

// Открытие popover
async function openNotificationPopover() {
  try {
    console.log("[Main] 🔓 Opening notification popover...");
    
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
    // Ошибка означает что popover уже открыт — это нормально
    console.log("[Main] ⚠️ Popover already open or error:", e);
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
    if (settings.autoSyncInterval && settings.autoSyncInterval > 0) {
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
    // СЛУШАЕМ ЛОКАЛЬНЫЕ СОБЫТИЯ (когда Я бросаю кубик)
    // ═══════════════════════════════════════════════════════════
    
    console.log("[Main] 📡 Setting up LOCAL message listener");
    
    onLocalDiceMessage((msg) => {
      console.log("[Main] 📨 LOCAL message:", msg.title);
      addToLocalQueue(msg);
      openNotificationPopover();
    });
    
    // ═══════════════════════════════════════════════════════════
    // СЛУШАЕМ BROADCAST (когда ДРУГОЙ игрок бросает кубик)
    // ═══════════════════════════════════════════════════════════
    
    console.log("[Main] 📡 Setting up BROADCAST listener");
    
    OBR.broadcast.onMessage(DICE_BROADCAST_CHANNEL, async (event) => {
      const msg = event.data as BroadcastMessage;
      console.log("[Main] 📨 BROADCAST from other player:", msg.title);
      
      addToLocalQueue(msg);
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
    <ErrorBoundary tabName="App">
      <App />
    </ErrorBoundary>
  </StrictMode>
);
