import React, { useState, useCallback, Component, type ReactNode } from 'react';
import { cn } from '../utils/cn';
import type { DiceRollResult } from '../types';

// === ERROR BOUNDARY ===

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Ошибка:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="p-4 text-center">
          <div className="text-blood-bright text-sm">⚠️ Ошибка: {this.state.error?.message}</div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-2 text-xs text-gold underline"
          >
            Повторить
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// === BUTTON ===

type ButtonVariant = 'primary' | 'gold' | 'success' | 'danger' | 'secondary' | 'mana';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'btn-gold',
  gold: 'btn-gold',
  success: 'btn-success',
  danger: 'btn-danger',
  secondary: 'btn-secondary',
  mana: 'btn-mana'
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'px-2 py-1 text-[0.65rem]',
  md: 'px-3 py-1.5 text-xs',
  lg: 'px-4 py-2 text-sm'
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'btn rounded',
        buttonVariants[variant],
        buttonSizes[size],
        loading && 'opacity-50 cursor-wait',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="inline-block w-4 h-4 border border-current border-t-transparent rounded-full animate-spin" />
      ) : children}
    </button>
  );
}

// === INPUT ===

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({
  label,
  error,
  className,
  ...props
}: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-[0.65rem] text-faded uppercase tracking-wider font-cinzel">
          {label}
        </label>
      )}
      <input
        className={cn(
          'bg-obsidian border border-edge-bone text-bone rounded px-2 py-1.5',
          'focus:border-gold focus:shadow-[0_0_8px_var(--color-gold-shadow)] outline-none',
          'font-garamond min-w-0',
          error && 'border-blood',
          className
        )}
        {...props}
      />
      {error && <span className="text-xs text-blood-bright">{error}</span>}
    </div>
  );
}

// === TEXTAREA ===

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function Textarea({
  label,
  className,
  ...props
}: TextareaProps) {
  return (
    <div className="flex flex-col gap-1 h-full">
      {label && (
        <label className="text-[0.65rem] text-faded uppercase tracking-wider font-cinzel">
          {label}
        </label>
      )}
      <textarea
        className={cn(
          'bg-obsidian border border-edge-bone text-bone rounded px-2 py-1.5 flex-1',
          'focus:border-gold focus:shadow-[0_0_8px_var(--color-gold-shadow)] outline-none',
          'font-garamond min-w-0 resize-none',
          className
        )}
        {...props}
      />
    </div>
  );
}

// === SELECT ===

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string;
  options: SelectOption[];
}

export function Select({
  label,
  options,
  className,
  ...props
}: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-[0.65rem] text-faded uppercase tracking-wider font-cinzel">
          {label}
        </label>
      )}
      <select
        className={cn(
          'bg-obsidian border border-edge-bone text-bone rounded px-2 py-1.5 pr-8',
          'focus:border-gold focus:shadow-[0_0_8px_var(--color-gold-shadow)] outline-none',
          'font-garamond cursor-pointer min-w-0',
          className
        )}
        {...props}
      >
        {(options ?? []).map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// === PROGRESS BAR ===

interface ProgressBarProps {
  type: 'hp' | 'mana';
  value: number;
  max: number;
  showText?: boolean;
  className?: string;
}

export function ProgressBar({
  type,
  value,
  max,
  showText = true,
  className
}: ProgressBarProps) {
  const safeValue = value ?? 0;
  const safeMax = max ?? 1;
  const percent = Math.max(0, Math.min(100, (safeValue / safeMax) * 100));
  const isLow = type === 'hp' && percent < 25;
  
  if (type === 'hp') {
    return (
      <div className={cn('hp-bar-container', isLow && 'hp-bar-low', className)}>
        <div 
          className="hp-bar-fill"
          style={{ width: `${percent}%` }}
        />
        {showText && (
          <div className="hp-bar-label">
            ❤ {safeValue}/{safeMax}
          </div>
        )}
      </div>
    );
  }
  
  // Mana bar
  return (
    <div className={cn('mana-bar-container', className)}>
      <div 
        className="mana-bar-fill"
        style={{ width: `${percent}%` }}
      />
      {showText && (
        <div className="mana-bar-label">
          💠 {safeValue}/{safeMax}
        </div>
      )}
    </div>
  );
}

// === SECTION ===

interface SectionProps {
  title: string;
  icon?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Section({
  title,
  icon,
  collapsible = false,
  defaultOpen = true,
  children,
  className
}: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className={cn('grimoire-section panel', className)}>
      <div
        className={cn(
          'grimoire-section-header',
          collapsible && 'collapsible'
        )}
        onClick={() => collapsible && setIsOpen(!isOpen)}
      >
        {icon && <span className="text-sm">{icon}</span>}
        <h3>{title}</h3>
        {collapsible && (
          <span className="collapse-icon">
            {isOpen ? '▾' : '▸'}
          </span>
        )}
      </div>
      {(!collapsible || isOpen) && (
        <div className={cn('grimoire-section-body', isOpen && 'animate-fade-in-up')}>
          {children}
        </div>
      )}
    </div>
  );
}

// === MODAL ===

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  className
}: ModalProps) {
  if (!isOpen) return null;
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className={cn('modal-content', className)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button
            onClick={onClose}
            className="text-faded hover:text-gold text-xl leading-none transition-colors"
          >
            ×
          </button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}

// === NUMBER STEPPER ===

interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  className?: string;
}

export function NumberStepper({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  label,
  className
}: NumberStepperProps) {
  const safeValue = value ?? 0;
  
  const handleChange = useCallback((delta: number) => {
    const newValue = Math.max(min, Math.min(max, safeValue + delta));
    onChange(newValue);
  }, [safeValue, min, max, onChange]);
  
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <label className="text-[0.65rem] text-faded uppercase tracking-wider font-cinzel truncate">
          {label}
        </label>
      )}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => handleChange(-step)}
          disabled={safeValue <= min}
          className="btn btn-secondary px-2 py-1 text-sm min-w-[32px]"
        >
          −
        </button>
        <input
          type="number"
          value={safeValue}
          onChange={(e) => {
            const num = parseInt(e.target.value, 10);
            if (!isNaN(num)) {
              onChange(Math.max(min, Math.min(max, num)));
            }
          }}
          className="w-14 text-center bg-obsidian border border-edge-bone text-bone rounded py-1 font-cinzel text-sm"
        />
        <button
          type="button"
          onClick={() => handleChange(step)}
          disabled={safeValue >= max}
          className="btn btn-secondary px-2 py-1 text-sm min-w-[32px]"
        >
          +
        </button>
      </div>
    </div>
  );
}

// === CHECKBOX ===

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  className?: string;
}

export function Checkbox({
  checked,
  onChange,
  label,
  className
}: CheckboxProps) {
  return (
    <label className={cn('flex items-center gap-2 cursor-pointer group', className)}>
      <div
        className={cn(
          'w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0',
          checked 
            ? 'bg-gold border-gold text-abyss' 
            : 'bg-obsidian border-edge-bone group-hover:border-gold'
        )}
        onClick={(e) => {
          e.preventDefault();
          onChange(!checked);
        }}
      >
        {checked && <span className="text-xs font-bold">✓</span>}
      </div>
      <span className="text-bone font-garamond text-sm">{label}</span>
    </label>
  );
}

// === SUB TABS ===

interface SubTabsProps {
  tabs: { id: string; label: string; icon?: string }[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export function SubTabs({
  tabs,
  activeTab,
  onChange,
  className
}: SubTabsProps) {
  return (
    <div className={cn('sub-tabs', className)}>
      {(tabs ?? []).map(tab => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            'sub-tab',
            activeTab === tab.id && 'active'
          )}
        >
          {tab.icon && <span className="mr-1">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// === NOTIFICATION TOAST ===

interface NotificationToastProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  onClose: () => void;
}

const toastIcons = {
  success: '✅',
  error: '❌',
  info: 'ℹ️',
  warning: '⚠️'
};

export function NotificationToast({
  message,
  type,
  onClose
}: NotificationToastProps) {
  return (
    <div className={cn('toast', `toast-${type}`)}>
      <div className="flex items-start gap-2">
        <span className="shrink-0">{toastIcons[type]}</span>
        <span className="flex-1 font-garamond text-sm break-words">{message}</span>
        <button 
          onClick={onClose} 
          className="hover:text-white shrink-0 ml-1 opacity-60 hover:opacity-100 transition-opacity"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// === DICE RESULT DISPLAY ===

interface DiceResultDisplayProps {
  results: DiceRollResult[];
  className?: string;
}

export function DiceResultDisplay({
  results,
  className
}: DiceResultDisplayProps) {
  if (!results || results.length === 0) return null;
  
  return (
    <div className={cn('space-y-2 animate-unfurl', className)}>
      {results.map((result, idx) => (
        <div
          key={idx}
          className={cn(
            'dice-result-card',
            result.isCrit && 'crit',
            result.isCritFail && 'fail'
          )}
        >
          {result.label && (
            <div className="text-[0.65rem] text-faded uppercase mb-1 truncate tracking-wider">
              {result.label}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1 text-sm font-garamond">
            <span className="text-ancient">
              [{(result.rolls ?? []).join(', ')}]
            </span>
            {(result.bonus ?? 0) !== 0 && (
              <span className="text-faded">
                {result.bonus > 0 ? '+' : ''}{result.bonus}
              </span>
            )}
            <span className="text-gold">=</span>
            <span className={cn(
              'font-bold font-cinzel',
              result.isCrit && 'dice-crit',
              result.isCritFail && 'dice-fail',
              !result.isCrit && !result.isCritFail && 'text-bone'
            )}>
              {result.total ?? 0}
            </span>
            {result.isCrit && <span className="text-gold-bright text-xs">✨ КРИТ!</span>}
            {result.isCritFail && <span className="text-blood-bright text-xs">💀 ПРОВАЛ!</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// === LOADING SPINNER ===

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div className="rune-spinner" />
    </div>
  );
}

// === EMPTY STATE ===

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  action
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon">{icon}</span>
      <h3 className="heading text-gold text-sm mb-1">{title}</h3>
      {description && (
        <p className="text-faded text-sm mb-3 font-garamond">{description}</p>
      )}
      {action}
    </div>
  );
}

// === INLINE BUTTON GROUP ===

interface ButtonGroupProps {
  children: React.ReactNode;
  className?: string;
}

export function ButtonGroup({ children, className }: ButtonGroupProps) {
  return (
    <div className={cn('btn-group', className)}>
      {children}
    </div>
  );
}
