import React from 'react';
import { cn } from '@/utils/cn';

// ============== BUTTON ==============
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...props }: ButtonProps) {
  const base = 'font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-gold-dark/60 hover:bg-gold-dark text-bone border border-border-gold hover:border-gold',
    secondary: 'bg-input hover:bg-hover text-ancient border border-border-bone hover:text-bone',
    danger: 'bg-blood-dark/40 hover:bg-blood-dark/70 text-error-text border border-blood-dark hover:border-blood',
    ghost: 'bg-transparent hover:bg-hover text-faded hover:text-ancient',
    gold: 'bg-gradient-to-r from-gold-dark to-gold/80 hover:from-gold/80 hover:to-gold text-abyss font-bold border border-gold',
  };
  const sizes = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} disabled={disabled || loading} {...props}>
      {loading && <span className="animate-spin">⏳</span>}
      {children}
    </button>
  );
}

// ============== INPUT ==============
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ label, error, className, ...props }, ref) => {
  return (
    <div className="space-y-1">
      {label && <label className="text-xs text-faded uppercase tracking-wider">{label}</label>}
      <input
        ref={ref}
        className={cn(
          'w-full bg-input border border-border-bone rounded-lg px-3 py-1.5 text-sm text-bone',
          'focus:outline-none focus:border-gold-dark focus:ring-1 focus:ring-gold-dark/30',
          'placeholder:text-dim transition-colors',
          error && 'border-blood',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-error-text">{error}</p>}
    </div>
  );
});
Input.displayName = 'Input';

// ============== SELECT ==============
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, options, className, ...props }: SelectProps) {
  return (
    <div className="space-y-1">
      {label && <label className="text-xs text-faded uppercase tracking-wider">{label}</label>}
      <select
        className={cn(
          'w-full bg-input border border-border-bone rounded-lg px-3 py-1.5 text-sm text-bone',
          'focus:outline-none focus:border-gold-dark focus:ring-1 focus:ring-gold-dark/30',
          'cursor-pointer transition-colors',
          className
        )}
        {...props}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ============== CHECKBOX ==============
interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export function Checkbox({ label, checked, onChange, className }: CheckboxProps) {
  return (
    <label className={cn('flex items-center gap-2 cursor-pointer group', className)}>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div className={cn(
        'w-4 h-4 rounded border transition-colors flex items-center justify-center',
        checked ? 'bg-gold-dark border-gold' : 'bg-input border-border-bone group-hover:border-faded'
      )}>
        {checked && <span className="text-[10px]">✓</span>}
      </div>
      <span className="text-sm text-ancient group-hover:text-bone transition-colors">{label}</span>
    </label>
  );
}

// ============== MODAL ==============
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  if (!open) return null;
  const sizes = { sm: 'max-w-xs', md: 'max-w-sm', lg: 'max-w-md' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className={cn('bg-panel border border-border-bone rounded-xl w-full animate-fade-in', sizes[size])} onClick={e => e.stopPropagation()}>
        {title && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-bone">
            <h3 className="text-sm font-bold text-gold">{title}</h3>
            <button onClick={onClose} className="text-faded hover:text-bone transition-colors cursor-pointer">✕</button>
          </div>
        )}
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

// ============== PROGRESS BAR ==============
interface ProgressBarProps {
  current: number;
  max: number;
  color: 'blood' | 'mana' | 'gold';
  label?: string;
  showValues?: boolean;
  height?: 'sm' | 'md';
  onIncrement?: () => void;
  onDecrement?: () => void;
}

export function ProgressBar({ current, max, color, label, showValues = true, height = 'md', onIncrement, onDecrement }: ProgressBarProps) {
  const pct = max > 0 ? Math.round((current / max) * 100) : 0;
  const colors = {
    blood: { bg: 'bg-blood-dark/30', fill: 'bg-gradient-to-r from-blood-dark to-blood', text: 'text-blood-bright' },
    mana: { bg: 'bg-mana-dark/30', fill: 'bg-gradient-to-r from-mana-dark to-mana', text: 'text-mana-bright' },
    gold: { bg: 'bg-gold-dark/30', fill: 'bg-gradient-to-r from-gold-dark to-gold', text: 'text-gold-bright' },
  };
  const heights = { sm: 'h-3', md: 'h-5' };
  const c = colors[color];

  return (
    <div className="space-y-0.5">
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-faded uppercase tracking-wider">{label}</span>
          {showValues && <span className={cn('text-xs font-mono font-bold', c.text)}>{current}/{max}</span>}
        </div>
      )}
      <div className="flex items-center gap-1">
        {onDecrement && (
          <button onClick={onDecrement} className="text-xs text-faded hover:text-blood-bright w-5 h-5 flex items-center justify-center rounded bg-input hover:bg-hover transition-colors cursor-pointer">−</button>
        )}
        <div className={cn('flex-1 rounded-full overflow-hidden', c.bg, heights[height])}>
          <div className={cn('h-full rounded-full transition-all duration-300', c.fill)} style={{ width: `${pct}%` }} />
        </div>
        {onIncrement && (
          <button onClick={onIncrement} className="text-xs text-faded hover:text-success-text w-5 h-5 flex items-center justify-center rounded bg-input hover:bg-hover transition-colors cursor-pointer">+</button>
        )}
      </div>
    </div>
  );
}

// ============== SECTION ==============
interface SectionProps {
  title: string;
  icon?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export function Section({ title, icon, children, actions, collapsible, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="border border-border-bone rounded-lg bg-panel/50">
      <div
        className={cn('flex items-center justify-between px-3 py-2', collapsible && 'cursor-pointer hover:bg-hover transition-colors')}
        onClick={collapsible ? () => setOpen(!open) : undefined}
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-sm">{icon}</span>}
          <h4 className="text-xs font-bold text-gold uppercase tracking-wider">{title}</h4>
          {collapsible && <span className={cn('text-xs text-faded transition-transform', open && 'rotate-90')}>▶</span>}
        </div>
        {actions && <div onClick={e => e.stopPropagation()}>{actions}</div>}
      </div>
      {(!collapsible || open) && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

// ============== BADGE ==============
interface BadgeProps {
  children: React.ReactNode;
  color?: 'gold' | 'blood' | 'mana' | 'success' | 'error' | 'faded';
}

export function Badge({ children, color = 'faded' }: BadgeProps) {
  const colors = {
    gold: 'bg-gold-dark/30 text-gold border-gold-dark',
    blood: 'bg-blood-dark/30 text-blood-bright border-blood-dark',
    mana: 'bg-mana-dark/30 text-mana-bright border-mana-dark',
    success: 'bg-success/30 text-success-text border-success',
    error: 'bg-error/30 text-error-text border-error',
    faded: 'bg-hover text-faded border-border-bone',
  };
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 text-xs rounded border', colors[color])}>
      {children}
    </span>
  );
}

// ============== CONFIRM DIALOG ==============
interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-ancient mb-4">{message}</p>
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" size="sm" onClick={onClose}>Отмена</Button>
        <Button variant="danger" size="sm" onClick={() => { onConfirm(); onClose(); }}>Удалить</Button>
      </div>
    </Modal>
  );
}

// ============== EMPTY STATE ==============
export function EmptyState({ icon, message, action }: { icon: string; message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <span className="text-3xl mb-2">{icon}</span>
      <p className="text-sm text-faded mb-3">{message}</p>
      {action}
    </div>
  );
}
