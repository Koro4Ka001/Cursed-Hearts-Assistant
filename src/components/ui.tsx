import React, { useState } from 'react';
import { cn } from '@/utils/cn';
import { useGameStore } from '@/stores/useGameStore';

// ===== BUTTON =====
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'gold' | 'success' | 'danger' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({ variant = 'secondary', size = 'md', loading, icon, children, className, disabled, ...props }: ButtonProps) {
  const sizeClasses = { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4 text-sm', lg: 'h-12 px-6 text-base' };
  const variantClasses: Record<string, string> = {
    primary: 'bg-[#8b0000] hover:bg-[#a00000] text-[#d4c8b8] border-[#5a0000] shadow-[0_0_10px_rgba(139,0,0,0.3)]',
    gold: 'bg-[#6a5014] hover:bg-[#8b6914] text-[#ffd700] border-[#4a3810] shadow-[0_0_10px_rgba(212,167,38,0.2)]',
    success: 'bg-[#2e5a1c] hover:bg-[#3a6a24] text-[#a0d090] border-[#1e4010]',
    danger: 'bg-[#4a0000] hover:bg-[#5a1c1c] text-[#d09090] border-[#3a0000]',
    secondary: 'bg-[#1a1816] hover:bg-[#252220] text-[#b8a892] border-[#3a332a]',
    ghost: 'bg-transparent hover:bg-[#1a1816] text-[#7a6f62] border-transparent',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg border font-medium transition-all duration-200',
        'active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none',
        'min-w-[44px] cursor-pointer',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : icon}
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
    {label && <label className="block mb-1 text-[10px] uppercase tracking-wider text-[#7a6f62] font-semibold">{label}</label>}
    <input
      ref={ref}
      className={cn(
        'w-full h-10 px-3.5 py-2.5 bg-[#161412] text-[#d4c8b8] text-sm rounded-lg border transition-all duration-200',
        'placeholder:text-[#4a433a] focus:outline-none',
        error
          ? 'border-[#8b0000] focus:border-[#ff2a2a] focus:shadow-[0_0_8px_rgba(139,0,0,0.3)]'
          : 'border-[#3a332a] focus:border-[#d4a726] focus:shadow-[0_0_8px_rgba(212,167,38,0.2)]',
        className
      )}
      {...props}
    />
    {error && <p className="mt-1 text-[11px] text-[#d09090]">{error}</p>}
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
      {label && <label className="block mb-1 text-[10px] uppercase tracking-wider text-[#7a6f62] font-semibold">{label}</label>}
      <select
        className={cn(
          'w-full h-10 px-3 bg-[#161412] text-[#d4c8b8] text-sm rounded-lg border border-[#3a332a]',
          'focus:outline-none focus:border-[#d4a726] focus:shadow-[0_0_8px_rgba(212,167,38,0.2)]',
          'cursor-pointer appearance-none',
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

// ===== PROGRESS BAR =====
interface ProgressBarProps {
  current: number;
  max: number;
  type: 'hp' | 'mana';
  label?: string;
  icon?: string;
  showControls?: boolean;
  onAdjust?: (amount: number) => void;
}

export function ProgressBar({ current, max, type, label, icon, showControls, onAdjust }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;
  const isLow = type === 'hp' && pct < 25;
  const [adjustVal, setAdjustVal] = useState('');

  const colors = type === 'hp'
    ? { bar: 'from-[#4a0000] to-[#8b0000]', glow: 'shadow-[0_0_10px_rgba(139,0,0,0.5)]', text: '#ff2a2a' }
    : { bar: 'from-[#0a2040] to-[#1a4a8b]', glow: 'shadow-[0_0_10px_rgba(74,158,255,0.4)]', text: '#4a9eff' };

  return (
    <div>
      <div className="flex items-center gap-2">
        {icon && <span className="text-base">{icon}</span>}
        {label && <span className="text-[10px] uppercase tracking-wider text-[#7a6f62] font-semibold">{label}</span>}
      </div>
      <div className={cn('relative h-7 bg-[#0c0a09] rounded-lg overflow-hidden border border-[#3a332a] mt-1', isLow && 'animate-[bloodPulse_2s_ease-in-out_infinite]')}>
        <div
          className={cn('absolute inset-y-0 left-0 bg-gradient-to-r rounded-lg transition-all duration-500', colors.bar, colors.glow)}
          style={{ width: `${pct}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-end pr-3">
          <span className="text-xs font-bold text-[#d4c8b8] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            {current}/{max}
          </span>
        </div>
      </div>
      {showControls && (
        <div className="flex gap-1 mt-1.5">
          <Button size="sm" variant="danger" onClick={() => onAdjust?.(-5)} className="min-w-[36px] px-1">-5</Button>
          <Button size="sm" variant="danger" onClick={() => onAdjust?.(-1)} className="min-w-[36px] px-1">-1</Button>
          <input
            type="number"
            value={adjustVal}
            onChange={(e) => setAdjustVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && adjustVal) { onAdjust?.(parseInt(adjustVal)); setAdjustVal(''); } }}
            placeholder="±"
            className="w-16 h-8 px-2 bg-[#161412] text-center text-[#d4c8b8] text-xs rounded border border-[#3a332a] focus:outline-none focus:border-[#d4a726]"
          />
          <Button size="sm" variant="success" onClick={() => onAdjust?.(1)} className="min-w-[36px] px-1">+1</Button>
          <Button size="sm" variant="success" onClick={() => onAdjust?.(5)} className="min-w-[36px] px-1">+5</Button>
        </div>
      )}
    </div>
  );
}

// ===== SECTION =====
export function Section({ title, icon, children, className, collapsible = false }: {
  title: string; icon?: string; children: React.ReactNode; className?: string; collapsible?: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className={cn('bg-[#0f0d0c] rounded-xl border border-[#3a332a] overflow-hidden', className)}>
      <button
        type="button"
        className={cn(
          'w-full flex items-center gap-2 px-4 py-2.5 text-left',
          collapsible && 'cursor-pointer hover:bg-[#1a1816]',
          !collapsible && 'cursor-default'
        )}
        onClick={() => collapsible && setOpen(!open)}
      >
        {icon && <span className="text-sm">{icon}</span>}
        <span className="text-[11px] uppercase tracking-wider text-[#d4a726] font-bold flex-1">{title}</span>
        {collapsible && <span className="text-[#7a6f62] text-xs">{open ? '▾' : '▸'}</span>}
      </button>
      {(!collapsible || open) && <div className="px-4 pb-3 space-y-2">{children}</div>}
    </div>
  );
}

// ===== MODAL =====
export function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-md' }: {
  isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; maxWidth?: string;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-[fadeIn_200ms]" onClick={onClose}>
      <div
        className={cn('w-full mx-4 bg-[#0f0d0c] border border-[#3a332a] rounded-xl shadow-2xl animate-[fadeSlideIn_300ms] max-h-[90vh] overflow-y-auto', maxWidth)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#3a332a]">
          <h3 className="text-sm font-bold text-[#d4a726]">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1a1816] text-[#7a6f62] cursor-pointer">✕</button>
        </div>
        <div className="p-4">{children}</div>
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
    <div className="fixed top-2 right-2 z-[100] w-80 space-y-2">
      {notifications.map((n) => (
        <div key={n.id} className={cn('p-3 rounded-lg border animate-[fadeSlideIn_300ms]', typeClasses[n.type])}>
          <div className="flex items-start gap-2">
            <span className="text-sm mt-0.5">{typeIcons[n.type]}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[#d4c8b8]">{n.title}</p>
              <p className="text-[11px] text-[#b8a892] mt-0.5">{n.message}</p>
            </div>
            <button onClick={() => removeNotification(n.id)} className="text-[#7a6f62] hover:text-[#d4c8b8] cursor-pointer">✕</button>
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
    <div className="bg-[#0c0a09] rounded-xl border border-[#3a332a] p-3 animate-[fadeSlideIn_300ms]">
      <h4 className="text-xs font-bold text-[#d4a726] mb-2">{title}</h4>
      <div className="space-y-1.5">
        {results.map((r, i) => (
          <div key={i} className={cn(
            'flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs',
            r.isCrit ? 'bg-[#2e5a1c]/30 border border-[#2e5a1c]' :
            r.isCritFail ? 'bg-[#5a1c1c]/30 border border-[#5a1c1c]' :
            r.success === true ? 'bg-[#1a2e14]/30' :
            r.success === false ? 'bg-[#2e1414]/30' :
            'bg-[#161412]'
          )}>
            <span className="text-[#7a6f62] w-24 truncate">{r.label}</span>
            <span className={cn('font-mono font-bold animate-[rollResult_400ms]',
              r.isCrit ? 'text-[#ffd700]' : r.isCritFail ? 'text-[#ff2a2a]' : 'text-[#d4c8b8]'
            )}>
              [{r.roll}]{r.bonus ? ` + ${r.bonus}` : ''} = {r.total}
            </span>
            {r.success !== undefined && (
              <span className={cn('ml-auto text-[10px] font-bold', r.success ? 'text-[#a0d090]' : 'text-[#d09090]')}>
                {r.isCrit ? 'КРИТ!' : r.isCritFail ? 'КРИТ.ПРОМАХ!' : r.success ? 'ПОПАЛ' : 'ПРОМАХ'}
              </span>
            )}
            {r.details && <span className="text-[10px] text-[#b8a892] ml-1">{r.details}</span>}
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
      {label && <label className="block mb-1 text-[10px] uppercase tracking-wider text-[#7a6f62] font-semibold">{label}</label>}
      <div className="flex items-center gap-1">
        <Button size="sm" variant="secondary" onClick={() => onChange(Math.max(min, value - 1))} className="min-w-[32px] px-0">−</Button>
        <input
          type="number"
          value={value}
          onChange={(e) => {
            const v = parseInt(e.target.value) || 0;
            onChange(Math.max(min, Math.min(max, v)));
          }}
          className="w-14 h-8 px-2 bg-[#161412] text-center text-[#d4c8b8] text-sm rounded border border-[#3a332a] focus:outline-none focus:border-[#d4a726]"
        />
        <Button size="sm" variant="secondary" onClick={() => onChange(Math.min(max, value + 1))} className="min-w-[32px] px-0">+</Button>
      </div>
    </div>
  );
}

// ===== CHECKBOX =====
export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer min-h-[44px]" onClick={() => onChange(!checked)}>
      <div className={cn(
        'w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
        checked ? 'bg-[#d4a726] border-[#d4a726]' : 'bg-[#161412] border-[#3a332a]'
      )}>
        {checked && <span className="text-[#030303] text-xs font-bold">✓</span>}
      </div>
      <span className="text-sm text-[#b8a892]">{label}</span>
    </label>
  );
}

// ===== TABS within tabs =====
export function SubTabs({ tabs, activeTab, onTabChange }: {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onTabChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 bg-[#0c0a09] rounded-lg p-1 border border-[#3a332a]">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onTabChange(t.id)}
          className={cn(
            'flex-1 h-8 rounded-md text-[11px] font-medium transition-all cursor-pointer',
            activeTab === t.id ? 'bg-[#1a1816] text-[#d4a726] shadow' : 'text-[#7a6f62] hover:text-[#b8a892]'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
