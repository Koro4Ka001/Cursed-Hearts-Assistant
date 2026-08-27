// src/main.tsx
import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import OBR from "@owlbear-rodeo/sdk";
import "./index.css";
import { App } from "./App";
import { diceService, DICE_BROADCAST_CHANNEL, onLocalDiceMessage, LOCAL_STORAGE_KEY } from "./services/diceService";
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
// 🔧 disableClickAway: false — клик вне плашки закрывает её, и игрок сразу может
// бросать кубики/кликать по карте (раньше плашка перехватывала все клики, пока
// не приходило новое сообщение). Дополнительно — автозакрытие через 10 секунд.
const POPOVER_AUTO_CLOSE_MS = 10_000;
let popoverAutoCloseTimer: number | null = null;

function schedulePopoverAutoClose() {
  if (popoverAutoCloseTimer !== null) window.clearTimeout(popoverAutoCloseTimer);
  popoverAutoCloseTimer = window.setTimeout(() => {
    popoverAutoCloseTimer = null;
    OBR.popover.close(NOTIFICATION_POPOVER_ID).catch(() => {});
  }, POPOVER_AUTO_CLOSE_MS);
}

async function openNotificationPopover() {
  try {
    await OBR.popover.open({
      id: NOTIFICATION_POPOVER_ID,
      url: "/notification.html",
      width: 320,
      height: 500,
      anchorOrigin: { horizontal: "LEFT", vertical: "BOTTOM" },
      transformOrigin: { horizontal: "LEFT", vertical: "BOTTOM" },
      disableClickAway: false,
      hidePaper: true,
      marginThreshold: 0
    });
  } catch {
    // Ошибка означает что popover уже открыт — это нормально
  }
  schedulePopoverAutoClose();
}

// Регистрируем слушатели уведомлений при готовности OBR
// (инициализация сервисов и UI происходит в App.tsx)
OBR.onReady(async () => {
  try {
    // Ждём пока diceService будет инициализирован (App.tsx делает это)
    await diceService.initialize();

    // СЛУШАЕМ ЛОКАЛЬНЫЕ СОБЫТИЯ (когда Я бросаю кубик)
    onLocalDiceMessage((msg) => {
      addToLocalQueue(msg);
      openNotificationPopover();
    });

    // СЛУШАЕМ BROADCAST (когда ДРУГОЙ игрок бросает кубик)
    OBR.broadcast.onMessage(DICE_BROADCAST_CHANNEL, async (event) => {
      const msg = event.data as BroadcastMessage;
      addToLocalQueue(msg);
      openNotificationPopover();
    });
  } catch (error) {
    console.error("[Main] Notification listener init error:", error);
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
