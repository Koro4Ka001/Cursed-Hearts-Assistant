// src/ToastOverlayApp.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import OBR from '@owlbear-rodeo/sdk';
import { cn } from './utils/cn';
import { DICE_BROADCAST_CHANNEL } from './services/diceService';
import type { BroadcastMessage } from './components/BroadcastOverlay';

// ═══════════════════════════════════════════════════════════════
// TOAST STATE
// ═══════════════════════════════════════════════════════════════

interface ToastState extends BroadcastMessage {
  phase: 'enter' | 'visible' | 'exit';
}

const TOAST_DURATION = 5000;
const TOAST_EXIT_DURATION = 600;
const MAX_VISIBLE = 6;

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export function ToastOverlayApp() {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const [isReady, setIsReady] = useState(false);
  const processedIds = useRef(new Set<string>());

  // Инициализация OBR
  useEffect(() => {
    OBR.onReady(() => {
      setIsReady(true);
      console.log('[ToastOverlay] OBR Ready');
    });
  }, []);

  // Подписка на broadcast
  useEffect(() => {
    if (!isReady) return;

    const unsubscribe = OBR.broadcast.onMessage(DICE_BROADCAST_CHANNEL, (event) => {
      const msg = event.data as BroadcastMessage | undefined;
      if (!msg || typeof msg !== 'object' || !msg.id) return;
      if (processedIds.current.has(msg.id)) return;
      
      processedIds.current.add(msg.id);
      addToast(msg);
    });

    return () => {
      unsubscribe();
    };
  }, [isReady]);

  // Добавление toast
  const addToast = useCallback((msg: BroadcastMessage) => {
    const newToast: ToastState = { ...msg, phase: 'enter' };
    
    setToasts(prev => [...prev, newToast].slice(-MAX_VISIBLE));

    // Enter -> Visible
    setTimeout(() => {
      setToasts(prev => prev.map(t => 
        t.id === msg.id ? { ...t, phase: 'visible' } : t
      ));
    }, 50);

    // Start exit
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

  // Ручное закрытие
  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.map(t => 
      t.id === id ? { ...t, phase: 'exit' } : t
    ));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, TOAST_EXIT_DURATION);
  }, []);

  return (
    <div className="toast-overlay-root">
      {toasts.map((toast, index) => (
        <DiceToast 
          key={toast.id} 
          toast={toast} 
          index={index}
          onDismiss={() => dismissToast(toast.id)}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DICE TOAST COMPONENT
// ═══════════════════════════════════════════════════════════════

interface DiceToastProps {
  toast: ToastState;
  index: number;
  onDismiss: () => void;
}

function DiceToast({ toast, index, onDismiss }: DiceToastProps) {
  const {
    type, unitName, title, subtitle, icon, rolls, total,
    isCrit, isCritFail, color, hpBar, details, phase
  } = toast;

  const colorClass = {
    gold: 'dt-gold',
    blood: 'dt-blood',
    mana: 'dt-mana',
    green: 'dt-green',
    purple: 'dt-purple',
    white: 'dt-white',
  }[color ?? 'white'];

  const phaseClass = {
    enter: 'dt-enter',
    visible: 'dt-visible',
    exit: 'dt-exit',
  }[phase];

  const displayIcon = icon ?? getDefaultIcon(type);

  return (
    <div 
      className={cn(
        'dice-toast-card',
        colorClass,
        phaseClass,
        isCrit && 'dt-crit',
        isCritFail && 'dt-fail'
      )}
      style={{ '--dt-index': index } as React.CSSProperties}
      onClick={onDismiss}
    >
      {/* Glow effect */}
      <div className="dt-glow" />
      
      {/* Crit rays */}
      {isCrit && <div className="dt-crit-rays" />}
      
      {/* Fail cracks */}
      {isCritFail && <div className="dt-fail-cracks" />}
      
      {/* Content */}
      <div className="dt-content">
        {/* Icon */}
        <div className={cn(
          'dt-icon',
          isCrit && 'dt-icon-crit',
          isCritFail && 'dt-icon-fail'
        )}>
          {displayIcon}
        </div>
        
        {/* Body */}
        <div className="dt-body">
          {unitName && <div className="dt-unit">{unitName}</div>}
          
          <div className={cn(
            'dt-title',
            isCrit && 'dt-title-crit',
            isCritFail && 'dt-title-fail'
          )}>
            {title}
          </div>
          
          {subtitle && <div className="dt-subtitle">{subtitle}</div>}
          
          {/* Dice rolls */}
          {rolls && rolls.length > 0 && (
            <div className="dt-rolls">
              {rolls.slice(0, 8).map((roll, i) => (
                <span 
                  key={i} 
                  className={cn(
                    'dt-die',
                    i === 0 && roll === 20 && 'dt-die-crit',
                    i === 0 && roll === 1 && 'dt-die-fail'
                  )}
                  style={{ '--die-i': i } as React.CSSProperties}
                >
                  {roll}
                </span>
              ))}
              {rolls.length > 8 && (
                <span className="dt-die-more">+{rolls.length - 8}</span>
              )}
              {total !== undefined && (
                <>
                  <span className="dt-eq">=</span>
                  <span className={cn(
                    'dt-total',
                    isCrit && 'dt-total-crit',
                    isCritFail && 'dt-total-fail'
                  )}>
                    {total}
                  </span>
                </>
              )}
            </div>
          )}
          
          {/* HP Bar */}
          {hpBar && (
            <div className="dt-hp">
              <div 
                className={cn(
                  'dt-hp-fill',
                  type === 'heal' ? 'dt-hp-heal' : 'dt-hp-dmg'
                )}
                style={{ width: `${Math.max(0, Math.min(100, (hpBar.current / hpBar.max) * 100))}%` }}
              />
              <span className="dt-hp-txt">{hpBar.current}/{hpBar.max}</span>
            </div>
          )}
          
          {/* Details */}
          {details && details.length > 0 && (
            <div className="dt-details">
              {details.map((line, i) => (
                <div key={i} className="dt-detail-line">{line}</div>
              ))}
            </div>
          )}
        </div>
        
        {/* Big result on right (no rolls) */}
        {total !== undefined && (!rolls || rolls.length === 0) && (
          <div className={cn(
            'dt-result',
            isCrit && 'dt-result-crit',
            isCritFail && 'dt-result-fail'
          )}>
            {total}
          </div>
        )}
      </div>
      
      {/* Crit/Fail banner */}
      {isCrit && (
        <div className="dt-banner dt-banner-crit">
          ✨ КРИТИЧЕСКИЙ УСПЕХ ✨
        </div>
      )}
      {isCritFail && (
        <div className="dt-banner dt-banner-fail">
          💀 КРИТИЧЕСКИЙ ПРОВАЛ
        </div>
      )}
      
      {/* Progress bar */}
      <div className="dt-progress" />
    </div>
  );
}

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
    default: return '📜';
  }
}
