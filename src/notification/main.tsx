// src/notification/main.tsx
import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import OBR from "@owlbear-rodeo/sdk";
import { NotificationPopover } from "./NotificationPopover";
import "./notification.css";

console.log("[Notification] Script loaded!");

OBR.onReady(() => {
  console.log("[Notification] ✅ OBR Ready in popover!");
  
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    console.error("[Notification] ❌ Root element not found!");
    return;
  }
  
  console.log("[Notification] Mounting React...");
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <NotificationPopover />
    </StrictMode>
  );
  console.log("[Notification] ✅ React mounted!");
});
