// src/components/BroadcastOverlay.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '../utils/cn';

// ═══════════════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════════════

export interface BroadcastMessage {
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

interface ToastState extends BroadcastMessage {
  phase: 'enter' | 'visible' | 'exit';
}

// ═══════════════════════════════════════════════════════════════
// ГЛОБАЛЬНЫЙ СТЕЙТ
// ═══════════════════════════════════════════════════════════════

type Listener = (messages: BroadcastMessage[]) => void;
const listeners = new Set<Listener>();
let messageQueue: BroadcastMessage[] = [];

export function pushBroadcast(msg: BroadcastMessage) {
  messageQueue = [...messageQueue, msg].slice(-8); // Максимум 8 в очереди
  listeners.forEach(fn => fn(messageQueue));
}

function subscribe(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ═══════════════════════════════════════════════════════════════
// КОМПОНЕНТ OVERLAY
// ═══════════════════════════════════════════════════════════════

const TOAST_DURATION = 4000;      // Время показа
const TOAST_EXIT_DURATION = 500;  // Время исчезновения
const MAX_VISIBLE = 5;            // Максимум видимых toast-ов

export function BroadcastOverlay() {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const processedIds = useRef(new Set<string>());

  // Подписка на новые сообщения
  useEffect(() => {
    return subscribe((messages) => {
      const newMessages = messages.filter(m => !processedIds.current.has(m.id));
      
      newMessages.forEach(msg => {
        processedIds.current.add(msg.id);
        
        // Добавляем новый toast
        setToasts(prev => {
          const newToast: ToastState = { ...msg, phase: 'enter' };
          const updated = [...prev, newToast].slice(-MAX_VISIBLE);
          return updated;
        });
        
        // Переход в visible фазу
        setTimeout(() => {
          setToasts(prev => prev.map(t => 
            t.id === msg.id ? { ...t, phase: 'visible' } : t
          ));
        }, 50);
        
        // Начало выхода
        setTimeout(() => {
          setToasts(prev => prev.map(t => 
            t.id === msg.id ? { ...t, phase: 'exit' } : t
          ));
        }, TOAST_DURATION);
        
        // Удаление
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== msg.id));
        }, TOAST_DURATION + TOAST_EXIT_DURATION);
      });
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
    <div className="dice-toast-container">
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
// КОМПОНЕНТ TOAST
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

  // Определяем иконку
  const displayIcon = icon ?? getDefaultIcon(type);

  return (
    <div 
      className={cn(
        'dice-toast',
        colorClass,
        phaseClass,
        isCrit && 'toast-crit',
        isCritFail && 'toast-fail'
      )}
      style={{ '--toast-index': index } as React.CSSProperties}
      onClick={onDismiss}
    >
      {/* Декоративные элементы */}
      <div className="toast-glow" />
      {isCrit && <div className="toast-crit-rays" />}
      {isCritFail && <div className="toast-fail-cracks" />}
      
      {/* Основной контент */}
      <div className="toast-content">
        {/* Иконка */}
        <div className={cn(
          'toast-icon',
          isCrit && 'toast-icon-crit',
          isCritFail && 'toast-icon-fail'
        )}>
          {displayIcon}
        </div>
        
        {/* Текст */}
        <div className="toast-body">
          {/* Имя персонажа */}
          {unitName && (
            <div className="toast-unit">{unitName}</div>
          )}
          
          {/* Заголовок */}
          <div className={cn(
            'toast-title',
            isCrit && 'toast-title-crit',
            isCritFail && 'toast-title-fail'
          )}>
            {title}
          </div>
          
          {/* Подзаголовок */}
          {subtitle && (
            <div className="toast-subtitle">{subtitle}</div>
          )}
          
          {/* Кубики + результат */}
          {(rolls && rolls.length > 0) && (
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
          
          {/* HP бар */}
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
          
          {/* Детали */}
          {details && details.length > 0 && (
            <div className="toast-details">
              {details.map((line, i) => (
                <div key={i} className="toast-detail-line">{line}</div>
              ))}
            </div>
          )}
        </div>
        
        {/* Результат справа (большой) */}
        {total !== undefined && !rolls?.length && (
          <div className={cn(
            'toast-result',
            isCrit && 'toast-result-crit',
            isCritFail && 'toast-result-fail'
          )}>
            {total}
          </div>
        )}
      </div>
      
      {/* Баннер крита/провала */}
      {isCrit && (
        <div className="toast-banner toast-banner-crit">
          ✨ КРИТИЧЕСКИЙ УСПЕХ ✨
        </div>
      )}
      {isCritFail && (
        <div className="toast-banner toast-banner-fail">
          💀 КРИТИЧЕСКИЙ ПРОВАЛ
        </div>
      )}
      
      {/* Прогресс-бар автозакрытия */}
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
    default: return '📜';
  }
}
