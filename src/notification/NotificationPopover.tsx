// src/notification/NotificationPopover.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import OBR from "@owlbear-rodeo/sdk";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface NotificationMessage {
  id: string;
  type: 'roll' | 'damage' | 'hit' | 'miss' | 'spell' | 'heal' | 'death' | 'rok-card' | 'custom';
  unitName: string;
  title: string;
  subtitle?: string;
  icon?: string;
  rolls?: number[];
  total?: number;
  isCrit?: boolean;
  isCritFail?: boolean;
  color?: 'gold' | 'blood' | 'mana' | 'green' | 'purple' | 'white';
  hpBar?: { current: number; max: number };
  details?: string[];
  timestamp: number;
}

interface QueuedNotification extends NotificationMessage {
  state: 'entering' | 'visible' | 'exiting';
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const BROADCAST_CHANNEL = "cursed-hearts/dice-roll";
const LOCAL_STORAGE_KEY = "cursed-hearts-pending-notification";
const MAX_VISIBLE = 4;
const DISPLAY_TIME = 5000;
const ANIMATION_TIME = 400;

const BORDER_COLORS: Record<string, string> = {
  gold: "#c9a227",
  blood: "#8b0000",
  mana: "#2244aa",
  green: "#228b22",
  purple: "#6b2d8b",
  white: "#8b7355"
};

const GLOW_COLORS: Record<string, string> = {
  gold: "rgba(201, 162, 39, 0.6)",
  blood: "rgba(139, 0, 0, 0.5)",
  mana: "rgba(34, 68, 170, 0.5)",
  green: "rgba(34, 139, 34, 0.5)",
  purple: "rgba(107, 45, 139, 0.5)",
  white: "rgba(139, 115, 85, 0.3)"
};

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export function NotificationPopover() {
  const [notifications, setNotifications] = useState<QueuedNotification[]>([]);
  const timeoutsRef = useRef<Map<string, number>>(new Map());
  const processedIdsRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(false);
  
  console.log("[NotificationPopover] Render, notifications:", notifications.length);
  
  // Удаление уведомления
  const removeNotification = useCallback((id: string) => {
    console.log("[NotificationPopover] Removing:", id);
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, state: 'exiting' as const } : n)
    );
    
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, ANIMATION_TIME);
  }, []);
  
  // Добавление уведомления
  const addNotification = useCallback((msg: NotificationMessage) => {
    if (processedIdsRef.current.has(msg.id)) {
      console.log("[NotificationPopover] Skip duplicate:", msg.id);
      return;
    }
    processedIdsRef.current.add(msg.id);
    
    if (processedIdsRef.current.size > 100) {
      const arr = Array.from(processedIdsRef.current);
      processedIdsRef.current = new Set(arr.slice(-50));
    }
    
    console.log("[NotificationPopover] ✅ Adding:", msg.title);
    const queued: QueuedNotification = { ...msg, state: 'entering' };
    
    setNotifications(prev => {
      let newList = [...prev, queued];
      while (newList.length > MAX_VISIBLE) {
        const oldest = newList[0];
        if (oldest) {
          const oldTimeout = timeoutsRef.current.get(oldest.id);
          if (oldTimeout) {
            window.clearTimeout(oldTimeout);
            timeoutsRef.current.delete(oldest.id);
          }
        }
        newList = newList.slice(1);
      }
      return newList;
    });
    
    setTimeout(() => {
      setNotifications(prev =>
        prev.map(n => n.id === msg.id ? { ...n, state: 'visible' as const } : n)
      );
    }, 50);
    
    const timeout = window.setTimeout(() => {
      removeNotification(msg.id);
      timeoutsRef.current.delete(msg.id);
    }, DISPLAY_TIME);
    
    timeoutsRef.current.set(msg.id, timeout);
  }, [removeNotification]);
  
  // Читаем очередь из localStorage
  const processQueue = useCallback(() => {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!data) return;
      
      const queue = JSON.parse(data) as NotificationMessage[];
      if (!Array.isArray(queue) || queue.length === 0) return;
      
      console.log("[NotificationPopover] 📨 Processing queue:", queue.length);
      
      // Очищаем localStorage сразу
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      
      // Добавляем все сообщения
      for (const msg of queue) {
        addNotification(msg);
      }
    } catch (e) {
      console.error("[NotificationPopover] Queue error:", e);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, [addNotification]);
  
  // Обрабатываем очередь при монтировании
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    
    console.log("[NotificationPopover] 🚀 Mounted, checking queue...");
    
    // Небольшая задержка чтобы localStorage успел обновиться
    setTimeout(() => {
      processQueue();
    }, 50);
  }, [processQueue]);
  
  // Polling localStorage (fallback)
  useEffect(() => {
    const interval = setInterval(() => {
      processQueue();
    }, 150);
    
    return () => clearInterval(interval);
  }, [processQueue]);
  
  // Слушаем broadcast (от других игроков)
  useEffect(() => {
    console.log("[NotificationPopover] 📡 Setting up broadcast listener...");
    
    const unsubscribe = OBR.broadcast.onMessage(BROADCAST_CHANNEL, (event) => {
      const msg = event.data as NotificationMessage;
      console.log("[NotificationPopover] 📨 BROADCAST:", msg.title);
      addNotification(msg);
    });
    
    return () => {
      unsubscribe();
      timeoutsRef.current.forEach(t => window.clearTimeout(t));
    };
  }, [addNotification]);
  
  // Закрываем popover когда пусто
  useEffect(() => {
    if (notifications.length === 0) {
      const closeTimeout = setTimeout(() => {
        console.log("[NotificationPopover] Closing popover (empty)");
        OBR.popover.close("cursed-hearts-notification");
      }, 800);
      return () => clearTimeout(closeTimeout);
    }
  }, [notifications.length]);
  
  return (
    <div className="notification-container">
      {notifications.map((notif, index) => (
        <NotificationCard 
          key={notif.id} 
          notification={notif}
          index={index}
          onDismiss={() => removeNotification(notif.id)}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// NOTIFICATION CARD
// ═══════════════════════════════════════════════════════════════

interface CardProps {
  notification: QueuedNotification;
  index: number;
  onDismiss: () => void;
}

function NotificationCard({ notification, index, onDismiss }: CardProps) {
  const borderColor = BORDER_COLORS[notification.color ?? 'white'];
  const glowColor = GLOW_COLORS[notification.color ?? 'white'];
  
  const cardClass = [
    'notification-card',
    notification.state,
    notification.isCrit && 'crit-pulse',
    notification.isCritFail && 'fail-shake',
    notification.type === 'death' && 'death-glow'
  ].filter(Boolean).join(' ');
  
  return (
    <div 
      className={cardClass}
      style={{ 
        '--border-color': borderColor,
        '--glow-color': glowColor,
        '--index': index
      } as React.CSSProperties}
      onClick={onDismiss}
    >
      <div className="card-header">
        <span className="card-icon">{notification.icon ?? '🎲'}</span>
        <span className="card-title">{notification.title}</span>
        <span className="card-unit">{notification.unitName}</span>
      </div>
      
      {notification.subtitle && (
        <div className="card-subtitle">{notification.subtitle}</div>
      )}
      
      {notification.rolls && notification.rolls.length > 0 && (
        <div className="card-rolls">
          <span className="rolls-dice">🎲</span>
          <span className="rolls-values">
            [{notification.rolls.slice(0, 8).join(', ')}
            {notification.rolls.length > 8 && '...'}]
          </span>
          {notification.total !== undefined && (
            <span className="rolls-total">= {notification.total}</span>
          )}
        </div>
      )}
      
      {notification.isCrit && (
        <div className="card-crit">✨ КРИТИЧЕСКИЙ УСПЕХ! ✨</div>
      )}
      {notification.isCritFail && (
        <div className="card-critfail">💀 КРИТИЧЕСКИЙ ПРОВАЛ! 💀</div>
      )}
      
      {notification.details && notification.details.length > 0 && (
        <div className="card-details">
          {notification.details.map((detail, i) => (
            <div key={i} className="detail-line">{detail}</div>
          ))}
        </div>
      )}
      
      {notification.hpBar && (
        <div className="card-hpbar">
          <div className="hpbar-track">
            <div 
              className="hpbar-fill"
              style={{ 
                width: `${Math.max(0, Math.min(100, (notification.hpBar.current / notification.hpBar.max) * 100))}%` 
              }}
            />
          </div>
          <div className="hpbar-text">
            HP: {notification.hpBar.current}/{notification.hpBar.max}
          </div>
        </div>
      )}
    </div>
  );
}
