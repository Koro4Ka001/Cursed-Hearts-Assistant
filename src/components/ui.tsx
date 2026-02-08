import React, { useState } from 'react';
import { cn } from '@/utils/cn';
import { useGameStore } from '@/stores/useGameStore';

// ===== BUTTON =====
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'gold' | 'success' | 'danger' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function Button({ variant = 'secondary', size = 'md', loading, children, className, disabled, ...props }: ButtonProps) {
  const sizeClasses = {
    sm: 'h-8 px-2 text-[11px]',
    md: 'h-9 px-3 text-[12px]',
    lg: 'h-10 px-4 text-[13px]',
  };
  const variantClasses: Record<string, string> = {
    primary: 'bg-[#8b0000] hover:bg-[#a00000] text-[#d4c8b8] border-[#5a0000]',
    gold: 'bg-[#6a5014] hover:bg-[#8b6914] text-[#ffd700] border-[#4a3810]',
    success: 'bg-[#2e5a1c] hover:bg-[#3a6a24] text-[#a0d090] border-[#1e4010]',
    danger: 'bg-[#4a0000] hover:bg-[#5a1c1c] text-[#d09090] border-[#3a0000]',
    secondary: 'bg-[#1a1816] hover:bg-[#252220] text-[#b8a892] border-[#3a332a]',
    ghost: 'bg-transparent hover:bg-[#1a1816] text-[#7a6f62] border-transparent',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium transition-all duration-150',
        'active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none cursor-pointer',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {children}
    </button>
  );
}

// ===== INPUT =====
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ label, error, className, ...props }, ref) => (
  <div className="w-full">
    {label && <label className="block mb-0.5 text-[10px] uppercase tracking-wider text-[#7a6f62] font-semibold">{label}</label>}
    <input
      ref={ref}
      className={cn(
        'w-full h-9 px-3 bg-[#161412] text-[#d4c8b8] text-[14px] rounded-lg border transition-all duration-150',
        'placeholder:text-[#4a433a] focus:outline-none',
        error
          ? 'border-[#8b0000] focus:border-[#ff2a2a]'
          : 'border-[#3a332a] focus:border-[#d4a726] focus:shadow-[0_0_6px_rgba(212,167,38,0.15)]',
        className
      )}
      {...props}
    />
    {error && <p className="mt-0.5 text-[10px] text-[#d09090]">{error}</p>}
  </div>
));
Input.displayName = 'Input';

// ===== SELECT =====
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, options, className, ...props }: SelectProps) {
  return (
    <div className="w-full">
      {label && <label className="block mb-0.5 text-[10px] uppercase tracking-wider text-[#7a6f62] font-semibold">{label}</label>}
      <select
        className={cn(
          'w-full h-9 px-2.5 bg-[#161412] text-[#d4c8b8] text-[13px] rounded-lg border border-[#3a332a]',
          'focus:outline-none focus:border-[#d4a726] cursor-pointer appearance-none',
          className
        )}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[#0f0d0c]">{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ===== PROGRESS BAR (COMPACT) =====
interface ProgressBarProps {
  current: number;
  max: number;
  type: 'hp' | 'mana';
  icon?: string;
  onAdjust?: (amount: number) => void;
  showControls?: boolean;
}

export function ProgressBar({ current, max, type, icon, onAdjust, showControls }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;
  const isLow = type === 'hp' && pct < 25;

  const colors = type === 'hp'
    ? { bar: 'from-[#8b0000] to-[#cc2020]', border: 'border-[#4a0000]', bg: 'bg-[#0a0606]' }
    : { bar: 'from-[#1a4a8b] to-[#4a9eff]', border: 'border-[#0a2040]', bg: 'bg-[#050a14]' };

  return (
    <div>
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-[12px] flex-shrink-0">{icon}</span>}
        <div className={cn(
          'flex-1 h-5 relative rounded-sm overflow-hidden border',
          colors.bg, colors.border,
          isLow && 'animate-[bloodPulse_2s_ease-in-out_infinite]'
        )}>
          <div
            className={cn('absolute inset-y-0 left-0 bg-gradient-to-r transition-all duration-500', colors.bar)}
            style={{ width: `${pct}%` }}
          />
          <span className="absolute right-1.5 top-0 leading-5 text-[11px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
            {current}/{max}
          </span>
        </div>
      </div>
      {showControls && onAdjust && (
        <div className="flex gap-1 mt-1 ml-5">
          <Button size="sm" variant="danger" onClick={() => onAdjust(-5)} className="min-w-[28px] px-0 h-6 text-[10px]">-5</Button>
          <Button size="sm" variant="danger" onClick={() => onAdjust(-1)} className="min-w-[28px] px-0 h-6 text-[10px]">-1</Button>
          <div className="flex-1" />
          <Button size="sm" variant="success" onClick={() => onAdjust(1)} className="min-w-[28px] px-0 h-6 text-[10px]">+1</Button>
          <Button size="sm" variant="success" onClick={() => onAdjust(5)} className="min-w-[28px] px-0 h-6 text-[10px]">+5</Button>
        </div>
      )}
    </div>
  );
}

// ===== SECTION =====
export function Section({ title, icon, children, className, collapsible = false, defaultOpen = true }: {
  title: string; icon?: string; children: React.ReactNode; className?: string; collapsible?: boolean; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn('bg-[#0c0a09] rounded-lg border border-[#3a332a] overflow-hidden', className)}>
      <button
        type="button"
        className={cn(
          'w-full flex items-center gap-1.5 px-3 py-2 text-left',
          collapsible && 'cursor-pointer hover:bg-[#1a1816]',
          !collapsible && 'cursor-default'
        )}
        onClick={() => collapsible && setOpen(!open)}
      >
        {icon && <span className="text-xs">{icon}</span>}
        <span className="text-[11px] uppercase tracking-wider text-[#d4a726] font-bold flex-1">{title}</span>
        {collapsible && <span className="text-[#7a6f62] text-[10px]">{open ? '▾' : '▸'}</span>}
      </button>
      {(!collapsible || open) && <div className="px-3 pb-2.5 space-y-2">{children}</div>}
    </div>
  );
}

// ===== MODAL =====
export function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-md' }: {
  isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; maxWidth?: string;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-[fadeIn_150ms]" onClick={onClose}>
      <div
        className={cn('w-full mx-3 bg-[#0f0d0c] border border-[#3a332a] rounded-xl shadow-2xl animate-[fadeSlideIn_200ms] max-h-[85vh] overflow-y-auto', maxWidth)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#3a332a] sticky top-0 bg-[#0f0d0c] z-10">
          <h3 className="text-[12px] font-bold text-[#d4a726]">{title}</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#1a1816] text-[#7a6f62] cursor-pointer text-sm">✕</button>
        </div>
        <div className="p-3">{children}</div>
      </div>
    </div>
  );
}

// ===== NOTIFICATIONS =====
export function NotificationContainer() {
  const notifications = useGameStore((s) => s.notifications);
  const removeNotification = useGameStore((s) => s.removeNotification);

  if (notifications.length === 0) return null;

  const typeClasses: Record<string, string> = {
    success: 'border-[#2e5a1c] bg-[#1a2e14]',
    error: 'border-[#5a1c1c] bg-[#2e1414]',
    warning: 'border-[#6a5014] bg-[#2e2414]',
    info: 'border-[#1a4a8b] bg-[#142030]',
  };
  const typeIcons: Record<string, string> = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

  return (
    <div className="fixed top-1 right-1 z-[100] w-72 space-y-1.5">
      {notifications.map((n) => (
        <div key={n.id} className={cn('p-2 rounded-lg border animate-[fadeSlideIn_200ms]', typeClasses[n.type])}>
          <div className="flex items-start gap-1.5">
            <span className="text-xs mt-0.5">{typeIcons[n.type]}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-[#d4c8b8]">{n.title}</p>
              <p className="text-[10px] text-[#b8a892] mt-0.5">{n.message}</p>
            </div>
            <button onClick={() => removeNotification(n.id)} className="text-[#7a6f62] hover:text-[#d4c8b8] cursor-pointer text-xs">✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ===== DICE RESULT DISPLAY =====
export function DiceResultDisplay({ results, title }: {
  results: Array<{ label: string; roll: number; bonus: number; total: number; success?: boolean; isCrit?: boolean; isCritFail?: boolean; details?: string }>;
  title: string;
}) {
  return (
    <div className="bg-[#0c0a09] rounded-lg border border-[#3a332a] p-2 animate-[fadeSlideIn_200ms]">
      <h4 className="text-[10px] font-bold text-[#d4a726] mb-1.5 uppercase tracking-wider">{title}</h4>
      <div className="space-y-1">
        {results.map((r, i) => (
          <div key={i} className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded text-[11px]',
            r.isCrit ? 'bg-[#2e5a1c]/30 border border-[#2e5a1c]' :
            r.isCritFail ? 'bg-[#5a1c1c]/30 border border-[#5a1c1c]' :
            r.success === true ? 'bg-[#1a2e14]/20' :
            r.success === false ? 'bg-[#2e1414]/20' :
            'bg-[#161412]'
          )}>
            <span className="text-[#7a6f62] w-20 truncate text-[10px]">{r.label}</span>
            <span className={cn('font-mono font-bold text-[11px] animate-[rollResult_400ms]',
              r.isCrit ? 'text-[#ffd700]' : r.isCritFail ? 'text-[#ff2a2a]' : 'text-[#d4c8b8]'
            )}>
              [{r.roll}]{r.bonus ? `+${r.bonus}` : ''}={r.total}
            </span>
            {r.success !== undefined && (
              <span className={cn('text-[9px] font-bold', r.success ? 'text-[#a0d090]' : 'text-[#d09090]')}>
                {r.isCrit ? 'КРИТ!' : r.isCritFail ? 'ПРОВАЛ!' : r.success ? 'ДА' : 'НЕТ'}
              </span>
            )}
            {r.details && <span className="text-[9px] text-[#7a6f62] ml-auto truncate max-w-[80px]">{r.details}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== NUMBER STEPPER =====
export function NumberStepper({ value, onChange, min = 0, max = 999, label }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; label?: string;
}) {
  return (
    <div>
      {label && <label className="block mb-0.5 text-[10px] uppercase tracking-wider text-[#7a6f62] font-semibold">{label}</label>}
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-7 h-7 flex items-center justify-center rounded bg-[#1a1816] border border-[#3a332a] text-[#b8a892] hover:bg-[#252220] cursor-pointer text-sm"
        >−</button>
        <input
          type="number"
          value={value}
          onChange={(e) => {
            const v = parseInt(e.target.value) || 0;
            onChange(Math.max(min, Math.min(max, v)));
          }}
          className="w-12 h-7 px-1 bg-[#161412] text-center text-[#d4c8b8] text-[13px] rounded border border-[#3a332a] focus:outline-none focus:border-[#d4a726]"
        />
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-7 h-7 flex items-center justify-center rounded bg-[#1a1816] border border-[#3a332a] text-[#b8a892] hover:bg-[#252220] cursor-pointer text-sm"
        >+</button>
      </div>
    </div>
  );
}

// ===== CHECKBOX =====
export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      className="flex items-center gap-2 cursor-pointer min-h-[32px] w-full text-left"
      onClick={() => onChange(!checked)}
    >
      <div className={cn(
        'w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0',
        checked ? 'bg-[#d4a726] border-[#d4a726]' : 'bg-[#161412] border-[#3a332a]'
      )}>
        {checked && <span className="text-[#030303] text-[9px] font-bold leading-none">✓</span>}
      </div>
      <span className="text-[12px] text-[#b8a892]">{label}</span>
    </button>
  );
}

// ===== SUB TABS =====
export function SubTabs({ tabs, activeTab, onTabChange }: {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onTabChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-0.5 bg-[#0c0a09] rounded-lg p-0.5 border border-[#3a332a]">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onTabChange(t.id)}
          className={cn(
            'flex-1 h-7 rounded text-[10px] font-medium transition-all cursor-pointer',
            activeTab === t.id ? 'bg-[#1a1816] text-[#d4a726] shadow' : 'text-[#7a6f62] hover:text-[#b8a892]'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ===== ERROR DISPLAY =====
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="bg-[#2a1515] border border-[#5a1c1c] text-[#d09090] p-2 rounded-lg text-[11px] flex items-center gap-1.5">
      <span>⚠</span>
      <span>{message}</span>
    </div>
  );
}
