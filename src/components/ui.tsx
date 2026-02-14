// ... (весь существующий код ui.tsx остаётся)

// ════════════════════════════════════════════════════════════
// ROLL MODIFIER SELECTOR — Переключатель преимущества/помехи
// ════════════════════════════════════════════════════════════

import type { RollModifier } from '../types';

interface RollModifierSelectorProps {
  value: RollModifier;
  onChange: (value: RollModifier) => void;
  className?: string;
}

export function RollModifierSelector({ value, onChange, className }: RollModifierSelectorProps) {
  return (
    <div className={cn('flex items-center gap-1 p-1 bg-obsidian rounded-lg border border-edge-bone', className)}>
      <button
        type="button"
        onClick={() => onChange('disadvantage')}
        className={cn(
          'px-2 py-1 text-xs font-cinzel rounded transition-all duration-200',
          value === 'disadvantage'
            ? 'bg-blood/30 text-blood-bright border border-blood/50 shadow-[0_0_8px_rgba(139,0,0,0.3)]'
            : 'text-faded hover:text-blood-bright hover:bg-blood/10'
        )}
        title="Помеха: 2d20, берём меньший"
      >
        💨 Помеха
      </button>
      
      <button
        type="button"
        onClick={() => onChange('normal')}
        className={cn(
          'px-2 py-1 text-xs font-cinzel rounded transition-all duration-200',
          value === 'normal'
            ? 'bg-gold/20 text-gold border border-gold/50 shadow-[0_0_8px_rgba(212,167,38,0.2)]'
            : 'text-faded hover:text-gold hover:bg-gold/10'
        )}
        title="Обычный бросок"
      >
        🎲 Обычный
      </button>
      
      <button
        type="button"
        onClick={() => onChange('advantage')}
        className={cn(
          'px-2 py-1 text-xs font-cinzel rounded transition-all duration-200',
          value === 'advantage'
            ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-600/50 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
            : 'text-faded hover:text-emerald-400 hover:bg-emerald-900/10'
        )}
        title="Преимущество: 2d20, берём больший"
      >
        🎯 Преимущ.
      </button>
    </div>
  );
}
// ... (весь существующий код ui.tsx остаётся без изменений)

// ════════════════════════════════════════════════════════════
// ROLL MODIFIER SELECTOR — Переключатель преимущества/помехи
// ════════════════════════════════════════════════════════════

interface RollModifierSelectorProps {
  value: 'normal' | 'advantage' | 'disadvantage';
  onChange: (value: 'normal' | 'advantage' | 'disadvantage') => void;
  className?: string;
}

export function RollModifierSelector({ value, onChange, className }: RollModifierSelectorProps) {
  return (
    <div className={cn('flex items-center gap-1 p-1 bg-obsidian rounded-lg border border-edge-bone', className)}>
      <button
        type="button"
        onClick={() => onChange('disadvantage')}
        className={cn(
          'px-2 py-1.5 text-[10px] font-cinzel rounded transition-all duration-200 uppercase tracking-wider',
          value === 'disadvantage'
            ? 'bg-blood/30 text-blood-bright border border-blood/50 shadow-[0_0_8px_rgba(139,0,0,0.3)]'
            : 'text-faded hover:text-blood-bright hover:bg-blood/10'
        )}
        title="Помеха: 2d20, берём меньший"
      >
        💨 Помеха
      </button>
      
      <button
        type="button"
        onClick={() => onChange('normal')}
        className={cn(
          'px-2 py-1.5 text-[10px] font-cinzel rounded transition-all duration-200 uppercase tracking-wider',
          value === 'normal'
            ? 'bg-gold/20 text-gold border border-gold/50 shadow-[0_0_8px_rgba(212,167,38,0.2)]'
            : 'text-faded hover:text-gold hover:bg-gold/10'
        )}
        title="Обычный бросок"
      >
        🎲 Обычный
      </button>
      
      <button
        type="button"
        onClick={() => onChange('advantage')}
        className={cn(
          'px-2 py-1.5 text-[10px] font-cinzel rounded transition-all duration-200 uppercase tracking-wider',
          value === 'advantage'
            ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
            : 'text-faded hover:text-emerald-400 hover:bg-emerald-900/20'
        )}
        title="Преимущество: 2d20, берём больший"
      >
        🎯 Преимущ.
      </button>
    </div>
  );
}
