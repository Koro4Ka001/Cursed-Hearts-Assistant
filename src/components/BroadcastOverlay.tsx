// src/components/BroadcastOverlay.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import OBR from '@owlbear-rodeo/sdk';
import { onLocalDiceMessage, DICE_BROADCAST_CHANNEL, type BroadcastMessage } from '../services/diceService';
import { cn } from '../utils/cn';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface ToastState extends BroadcastMessage {
  phase: 'enter' | 'visible' | 'exit';
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const TOAST_DURATION = 5000;
const TOAST_EXIT_DURATION = 500;
const MAX_VISIBLE = 5;

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export function BroadcastOverlay() {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const processedIds = useRef(new Set<string>());

  // Обработка нового сообщения
  const handleMessage = useCallback((msg: BroadcastMessage) => {
    // Дедупликация
    if (processedIds.current.has(msg.id)) return;
    processedIds.current.add(msg.id);

    // Очистка старых ID (держим последние 100)
    if (processedIds.current.size > 100) {
      const arr = Array.from(processedIds.current);
      processedIds.current = new Set(arr.slice(-50));
    }

    // Добавляем toast
    setToasts(prev => {
      const newToast: ToastState = { ...msg, phase: 'enter' };
      return [...prev, newToast].slice(-MAX_VISIBLE);
    });

    // Enter → Visible
    setTimeout(() => {
      setToasts(prev => prev.map(t => 
        t.id === msg.id ? { ...t, phase: 'visible' } : t
      ));
    }, 50);

    // Visible → Exit
    setTimeout(() => {
      setToasts(prev => prev.map(t => 
        t.id === msg.id ? { ...t, phase: 'exit' } : t
      ));
    }, TOAST_DURATION);

    // Remove
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== msg.id));
    }, TOAST_DURATION + TOAST_EXIT_DURATION);
  }, []);

  // Подписка на ЛОКАЛЬНЫЕ сообщения (от себя)
  useEffect(() => {
    const unsubLocal = onLocalDiceMessage(handleMessage);
    return unsubLocal;
  }, [handleMessage]);

  // Подписка на BROADCAST сообщения (от других игроков)
  useEffect(() => {
    let unsubBroadcast: (() => void) | undefined;

    const setup = async () => {
      try {
        unsubBroadcast = OBR.broadcast.onMessage(DICE_BROADCAST_CHANNEL, (event) => {
          const data = event.data as BroadcastMessage;
          if (data && data.id) {
            handleMessage(data);
          }
        });
      } catch (e) {
        console.warn('[BroadcastOverlay] Failed to subscribe to broadcast:', e);
      }
    };

    setup();

    return () => {
      if (unsubBroadcast) unsubBroadcast();
    };
  }, [handleMessage]);

  // Ручное закрытие
  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.map(t => 
      t.id === id ? { ...t, phase: 'exit' } : t
    ));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, TOAST_EXIT_DURATION);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="dice-toast-container">
      {toasts.map((toast) => (
        <DiceToast 
          key={toast.id} 
          toast={toast} 
          onDismiss={() => dismissToast(toast.id)}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TOAST COMPONENT
// ═══════════════════════════════════════════════════════════════

interface DiceToastProps {
  toast: ToastState;
  onDismiss: () => void;
}

function DiceToast({ toast, onDismiss }: DiceToastProps) {
  const {
    type, unitName, title, subtitle, icon, rolls, total,
    isCrit, isCritFail, color, hpBar, details, phase
  } = toast;

  // Цвет фона
  const colorClass = {
    gold: 'toast-color-gold',
    blood: 'toast-color-blood',
    mana: 'toast-color-mana',
    green: 'toast-color-green',
    purple: 'toast-color-purple',
    white: 'toast-color-white',
  }[color ?? 'white'];

  // Фаза анимации
  const phaseClass = {
    enter: 'toast-enter',
    visible: 'toast-visible',
    exit: 'toast-exit',
  }[phase];

  // Иконка
  const displayIcon = icon ?? getDefaultIcon(type);
  const critIcon = isCrit ? '✨' : isCritFail ? '💀' : displayIcon;

  return (
    <div 
      className={cn(
        'dice-toast',
        colorClass,
        phaseClass,
        isCrit && 'toast-crit',
        isCritFail && 'toast-fail'
      )}
      onClick={onDismiss}
    >
      {/* Glow */}
      <div className="toast-glow" />
      
      {/* Crit rays */}
      {isCrit && <div className="toast-crit-rays" />}
      
      {/* Fail cracks */}
      {isCritFail && <div className="toast-fail-cracks" />}
      
      {/* Content */}
      <div className="toast-content">
        {/* Icon */}
        <div className={cn(
          'toast-icon',
          isCrit && 'toast-icon-crit',
          isCritFail && 'toast-icon-fail'
        )}>
          {critIcon}
        </div>
        
        {/* Body */}
        <div className="toast-body">
          {/* Unit name */}
          {unitName && (
            <div className="toast-unit">{unitName}</div>
          )}
          
          {/* Title */}
          <div className={cn(
            'toast-title',
            isCrit && 'toast-title-crit',
            isCritFail && 'toast-title-fail'
          )}>
            {title}
          </div>
          
          {/* Subtitle */}
          {subtitle && (
            <div className="toast-subtitle">{subtitle}</div>
          )}
          
          {/* Dice rolls */}
          {rolls && rolls.length > 0 && (
            <div className="toast-rolls">
              {rolls.slice(0, 6).map((roll, i) => (
                <span 
                  key={i} 
                  className={cn(
                    'toast-die',
                    i === 0 && roll === 20 && 'toast-die-crit',
                    i === 0 && roll === 1 && 'toast-die-fail'
                  )}
                  style={{ '--die-delay': `${i * 50}ms` } as React.CSSProperties}
                >
                  {roll}
                </span>
              ))}
              {rolls.length > 6 && (
                <span className="toast-die-more">+{rolls.length - 6}</span>
              )}
              {total !== undefined && (
                <>
                  <span className="toast-equals">=</span>
                  <span className={cn(
                    'toast-total',
                    isCrit && 'toast-total-crit',
                    isCritFail && 'toast-total-fail'
                  )}>
                    {total}
                  </span>
                </>
              )}
            </div>
          )}
          
          {/* HP bar */}
          {hpBar && (
            <div className="toast-hp">
              <div 
                className={cn(
                  'toast-hp-fill',
                  type === 'heal' ? 'toast-hp-heal' : 'toast-hp-damage'
                )}
                style={{ width: `${Math.max(0, Math.min(100, (hpBar.current / hpBar.max) * 100))}%` }}
              />
              <span className="toast-hp-text">
                {hpBar.current}/{hpBar.max}
              </span>
            </div>
          )}
          
          {/* Details */}
          {details && details.length > 0 && (
            <div className="toast-details">
              {details.map((line, i) => (
                <div key={i} className="toast-detail-line">{line}</div>
              ))}
            </div>
          )}
        </div>
        
        {/* Big result (when no rolls) */}
        {total !== undefined && (!rolls || rolls.length === 0) && (
          <div className={cn(
            'toast-result',
            isCrit && 'toast-result-crit',
            isCritFail && 'toast-result-fail'
          )}>
            {total}
          </div>
        )}
      </div>
      
      {/* Crit banner */}
      {isCrit && (
        <div className="toast-banner toast-banner-crit">
          ✨ КРИТИЧЕСКИЙ УСПЕХ ✨
        </div>
      )}
      
      {/* Fail banner */}
      {isCritFail && (
        <div className="toast-banner toast-banner-fail">
          💀 КРИТИЧЕСКИЙ ПРОВАЛ
        </div>
      )}
      
      {/* Progress bar */}
      <div className="toast-progress" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function getDefaultIcon(type: BroadcastMessage['type']): string {
  switch (type) {
    case 'roll': return '🎲';
    case 'damage': return '💥';
    case 'hit': return '🎯';
    case 'miss': return '💨';
    case 'spell': return '✨';
    case 'heal': return '💚';
    case 'death': return '💀';
    case 'rok-card': return '🃏';
    case 'custom': return '📜';
    default: return '🎲';
  }
}
