// src/main.tsx
import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import OBR from "@owlbear-rodeo/sdk";
import "./index.css";
import { App } from "./App";
import { docsService } from "./services/docsService";
import { diceService } from "./services/diceService";
import { tokenBarService } from "./services/tokenBarService";
import { useGameStore } from "./stores/useGameStore";

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
      await tokenBarService.syncAllBars(units);
    }
  } catch (error) {
    console.error("[Main] Initialization error:", error);
  }
});

// Монтируем React (React 18 стиль)
const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

const root = createRoot(rootElement);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
setTimeout(async () => {
  try {
    const testTokenId = "8fccc7ac-7b1d-4f97-921f-6a4a9a057ee1"; // НОВЫЙ ID!
    await tokenBarService.createBars(testTokenId, 50, 100, 30, 50, false);
    console.log("TEST BARS CREATED!");
  } catch (e) {
    console.error("TEST FAILED:", e);
  }
}, 3000);
