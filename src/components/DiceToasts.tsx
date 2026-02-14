// src/components/DiceToasts.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import OBR from '@owlbear-rodeo/sdk';
import { cn } from '../utils/cn';
import { DICE_BROADCAST_CHANNEL, type BroadcastMessage, onLocalDiceMessage } from '../services/diceService';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface ToastState extends BroadcastMessage {
  phase: 'enter' | 'visible' | 'exit';
}

const TOAST_DURATION = 4000;
const TOAST_EXIT_DURATION = 400;
const MAX_VISIBLE = 4;

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export function DiceToasts() {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const processedIds = useRef(new Set<string>());
  const [isObrReady, setIsObrReady] = useState(false);

  // Добавление toast
  const addToast = useCallback((msg: BroadcastMessage) => {
    // Проверяем дубликаты
    if (processedIds.current.has(msg.id)) return;
    processedIds.current.add(msg.id);
    
    console.log('[DiceToasts] Adding toast:', msg.title);
    
    const newToast: ToastState = { ...msg, phase: 'enter' };
    
    setToasts(prev => [...prev, newToast].slice(-MAX_VISIBLE));

    // Enter -> Visible
    requestAnimationFrame(() => {
      setTimeout(() => {
        setToasts(prev => prev.map(t => 
          t.id === msg.id ? { ...t, phase: 'visible' } : t
        ));
      }, 50);
    });

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

  // Подписка на ЛОКАЛЬНЫЕ сообщения (от себя)
  useEffect(() => {
    console.log('[DiceToasts] Subscribing to local messages');
    const unsubscribe = onLocalDiceMessage(addToast);
    return () => { unsubscribe(); };
  }, [addToast]);

  // Подписка на BROADCAST (от других игроков)
  useEffect(() => {
    if (!isObrReady) return;

    console.log('[DiceToasts] Subscribing to OBR broadcast');
    const unsubscribe = OBR.broadcast.onMessage(DICE_BROADCAST_CHANNEL, (event) => {
      const msg = event.data as BroadcastMessage | undefined;
      if (!msg || typeof msg !== 'object' || !msg.id) return;
      addToast(msg);
    });

    return () => { unsubscribe(); };
  }, [isObrReady, addToast]);

  // OBR ready
  useEffect(() => {
    OBR.onReady(() => {
      console.log('[DiceToasts] OBR Ready');
      setIsObrReady(true);
    });
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

  if (toasts.length === 0) return null;

  return (
    <div className="dice-toasts-container">
      {toasts.map((toast) => (
        <MiniToast 
          key={toast.id} 
          toast={toast} 
          onDismiss={() => dismissToast(toast.id)}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MINI TOAST
// ═══════════════════════════════════════════════════════════════

interface MiniToastProps {
  toast: ToastState;
  onDismiss: () => void;
}

function MiniToast({ toast, onDismiss }: MiniToastProps) {
  const {
    type, unitName, title, rolls, total,
    isCrit, isCritFail, color, hpBar, phase
  } = toast;

  const colorClass = {
    gold: 'mt-gold',
    blood: 'mt-blood',
    mana: 'mt-mana',
    green: 'mt-green',
    purple: 'mt-purple',
    white: 'mt-white',
  }[color ?? 'white'];

  const phaseClass = {
    enter: 'mt-enter',
    visible: 'mt-visible',
    exit: 'mt-exit',
  }[phase];

  const icon = getIcon(type, isCrit, isCritFail);

  return (
    <div 
      className={cn(
        'mini-toast',
        colorClass,
        phaseClass,
        isCrit && 'mt-crit',
        isCritFail && 'mt-fail'
      )}
      onClick={onDismiss}
    >
      {/* Иконка */}
      <span className={cn('mt-icon', isCrit && 'mt-icon-crit')}>
        {icon}
      </span>
      
      {/* Текст */}
      <div className="mt-text">
        {unitName && <span className="mt-unit">{unitName}:</span>}
        <span className="mt-title">{title}</span>
      </div>
      
      {/* Кубики или HP */}
      {rolls && rolls.length > 0 && (
        <div className="mt-rolls">
          {rolls.slice(0, 4).map((r, i) => (
            <span key={i} className={cn(
              'mt-die',
              i === 0 && r === 20 && 'mt-die-crit',
              i === 0 && r === 1 && 'mt-die-fail'
            )}>{r}</span>
          ))}
          {rolls.length > 4 && <span className="mt-die-more">+{rolls.length - 4}</span>}
          <span className="mt-eq">=</span>
          <span className={cn(
            'mt-total',
            isCrit && 'mt-total-crit',
            isCritFail && 'mt-total-fail'
          )}>{total}</span>
        </div>
      )}
      
      {/* Только total без кубиков */}
      {total !== undefined && (!rolls || rolls.length === 0) && !hpBar && (
        <span className={cn(
          'mt-total-big',
          isCrit && 'mt-total-crit',
          isCritFail && 'mt-total-fail'
        )}>{total}</span>
      )}
      
      {/* HP bar */}
      {hpBar && (
        <div className="mt-hp">
          <div 
            className={cn('mt-hp-fill', type === 'heal' ? 'mt-hp-heal' : 'mt-hp-dmg')}
            style={{ width: `${Math.max(0, Math.min(100, (hpBar.current / hpBar.max) * 100))}%` }}
          />
          <span className="mt-hp-txt">{hpBar.current}/{hpBar.max}</span>
        </div>
      )}
      
      {/* Крит/Провал бейдж */}
      {isCrit && <span className="mt-badge mt-badge-crit">КРИТ!</span>}
      {isCritFail && <span className="mt-badge mt-badge-fail">ПРОВАЛ</span>}
      
      {/* Progress bar */}
      <div className="mt-progress" />
    </div>
  );
}

function getIcon(type: BroadcastMessage['type'], isCrit?: boolean, isFail?: boolean): string {
  if (isCrit) return '✨';
  if (isFail) return '💀';
  switch (type) {
    case 'roll': return '🎲';
    case 'damage': return '💥';
    case 'hit': return '🎯';
    case 'miss': return '💨';
    case 'spell': return '✨';
    case 'heal': return '💚';
    case 'death': return '☠️';
    case 'rok-card': return '🃏';
    default: return '📜';
  }
}
