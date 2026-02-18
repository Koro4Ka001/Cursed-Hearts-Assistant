// src/notification/main.tsx
import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import OBR from "@owlbear-rodeo/sdk";
import { NotificationPopover } from "./NotificationPopover";
import "./notification.css";

OBR.onReady(() => {
  console.log("[Notification] Popover ready!");
  
  const rootElement = document.getElementById("root");
  if (!rootElement) throw new Error("Root element not found");
  
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <NotificationPopover />
    </StrictMode>
  );
});
