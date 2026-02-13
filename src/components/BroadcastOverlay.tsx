// src/components/BroadcastOverlay.tsx
// Кастомные анимированные уведомления видимые ВСЕМ игрокам
import { useState, useEffect, useCallback } from 'react';
import { cn } from '../utils/cn';

// ── Типы ───────────────────────────────────────────────

export interface BroadcastMessage {
  id: string;
  type: 'roll' | 'hit' | 'miss' | 'damage' | 'heal' | 'spell' | 'rok-card' | 'mana' | 'death' | 'custom';
  unitName: string;
  title: string;
  subtitle?: string;
  icon?: string;
  rolls?: number[];
  total?: number;
  isCrit?: boolean;
  isCritFail?: boolean;
  color?: 'gold' | 'blood' | 'mana' | 'green' | 'purple' | 'white';
  details?: string[];
  hpBar?: { current: number; max: number };
  timestamp: number;
}

// ── Глобальная очередь (чтобы App и diceService могли добавлять) ─

type Listener = (msg: BroadcastMessage) => void;
const listeners: Set<Listener> = new Set();

export function pushBroadcast(msg: BroadcastMessage) {
  listeners.forEach(fn => fn(msg));
}

// ── Компонент одного уведомления ────────────────────────

function BroadcastCard({ msg, onDone }: { msg: BroadcastMessage; onDone: () => void }) {
  const [phase, setPhase] = useState<'enter' | 'visible' | 'exit'>('enter');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('visible'), 50);
    const t2 = setTimeout(() => setPhase('exit'), 4500);
    const t3 = setTimeout(onDone, 5200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  const colorMap: Record<string, string> = {
    gold: 'bc-gold',
    blood: 'bc-blood',
    mana: 'bc-mana',
    green: 'bc-green',
    purple: 'bc-purple',
    white: 'bc-white',
  };

  const colorClass = colorMap[msg.color ?? 'gold'] ?? 'bc-gold';

  // Иконка по типу
  const icon = msg.icon ?? ({
    roll: '🎲', hit: '🎯', miss: '💨', damage: '💥',
    heal: '💚', spell: '✨', 'rok-card': '🃏', mana: '💠',
    death: '💀', custom: '⟐'
  }[msg.type] ?? '⟐');

  return (
    <div className={cn(
      'bc-card',
      colorClass,
      msg.isCrit && 'bc-crit',
      msg.isCritFail && 'bc-fail',
      phase === 'enter' && 'bc-enter',
      phase === 'visible' && 'bc-visible',
      phase === 'exit' && 'bc-exit'
    )}>
      {/* Крит-лучи */}
      {msg.isCrit && <div className="bc-crit-rays" />}

      {/* Фейл-трещины */}
      {msg.isCritFail && <div className="bc-fail-crack" />}

      {/* Декоративные уголки */}
      <span className="bc-corner bc-corner-tl" />
      <span className="bc-corner bc-corner-tr" />
      <span className="bc-corner bc-corner-bl" />
      <span className="bc-corner bc-corner-br" />

      {/* Контент */}
      <div className="bc-body">
        {/* Иконка */}
        <div className={cn('bc-icon', msg.isCrit && 'bc-icon-crit')}>
          {icon}
        </div>

        {/* Текст */}
        <div className="bc-text">
          {/* Имя персонажа */}
          <div className="bc-unit-name">{msg.unitName}</div>

          {/* Заголовок */}
          <div className={cn('bc-title', msg.isCrit && 'bc-title-crit', msg.isCritFail && 'bc-title-fail')}>
            {msg.title}
          </div>

          {/* Кубики */}
          {msg.rolls && msg.rolls.length > 0 && (
            <div className="bc-rolls">
              {msg.rolls.map((r, i) => (
                <span key={i} className={cn(
                  'bc-die',
                  i === 0 && r === 20 && 'bc-die-crit',
                  i === 0 && r === 1 && 'bc-die-fail'
                )}>
                  {r}
                </span>
              ))}
              {msg.total !== undefined && (
                <span className="bc-total">= {msg.total}</span>
              )}
            </div>
          )}

          {/* Подзаголовок */}
          {msg.subtitle && (
            <div className="bc-subtitle">{msg.subtitle}</div>
          )}

          {/* Детали */}
          {msg.details && msg.details.length > 0 && (
            <div className="bc-details">
              {msg.details.map((d, i) => (
                <div key={i} className="bc-detail-line">{d}</div>
              ))}
            </div>
          )}

          {/* HP бар */}
          {msg.hpBar && (
            <div className="bc-hp-bar">
              <div
                className={cn('bc-hp-fill', msg.type === 'heal' ? 'bc-hp-heal' : 'bc-hp-damage')}
                style={{ width: `${Math.max(0, Math.min(100, (msg.hpBar.current / msg.hpBar.max) * 100))}%` }}
              />
              <span className="bc-hp-text">{msg.hpBar.current}/{msg.hpBar.max}</span>
            </div>
          )}
        </div>
      </div>

      {/* Крит/Провал баннер */}
      {msg.isCrit && (
        <div className="bc-banner bc-banner-crit">✨ КРИТИЧЕСКОЕ ПОПАДАНИЕ ✨</div>
      )}
      {msg.isCritFail && (
        <div className="bc-banner bc-banner-fail">💀 КРИТИЧЕСКИЙ ПРОВАЛ 💀</div>
      )}
    </div>
  );
}

// ── Основной оверлей ────────────────────────────────────

export function BroadcastOverlay() {
  const [messages, setMessages] = useState<BroadcastMessage[]>([]);

  const addMessage = useCallback((msg: BroadcastMessage) => {
    setMessages(prev => {
      const next = [...prev, msg];
      // Максимум 5 одновременно
      return next.length > 5 ? next.slice(-5) : next;
    });
  }, []);

  const removeMessage = useCallback((id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id));
  }, []);

  useEffect(() => {
    listeners.add(addMessage);
    return () => { listeners.delete(addMessage); };
  }, [addMessage]);

  if (messages.length === 0) return null;

  return (
    <div className="bc-overlay">
      {messages.map(msg => (
        <BroadcastCard
          key={msg.id}
          msg={msg}
          onDone={() => removeMessage(msg.id)}
        />
      ))}
    </div>
  );
}
