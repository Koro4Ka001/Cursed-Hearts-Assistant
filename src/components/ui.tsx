import React, { useState, useCallback } from 'react';
import { cn } from '../utils/cn';
import type { DiceRollResult } from '../types';

// === BUTTON ===

type ButtonVariant = 'primary' | 'gold' | 'success' | 'danger' | 'secondary' | 'mana';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-panel border-gold text-gold hover:bg-gold-dark hover:shadow-[0_0_10px_var(--color-gold)]',
  gold: 'btn-gold',
  success: 'bg-panel border-green-700 text-green-500 hover:bg-green-900 hover:shadow-[0_0_10px_#22c55e]',
  danger: 'btn-blood',
  secondary: 'bg-obsidian border-edge-bone text-faded hover:text-ancient hover:border-ancient',
  mana: 'btn-mana'
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
  lg: 'px-4 py-2 text-base'
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
        'btn font-cinzel uppercase tracking-wider border rounded transition-all duration-200',
        buttonVariants[variant],
        buttonSizes[size],
        loading && 'opacity-50 cursor-wait',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? '⏳' : children}
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
        <label className="text-xs text-faded uppercase tracking-wider font-cinzel">
          {label}
        </label>
      )}
      <input
        className={cn(
          'bg-obsidian border border-edge-bone text-bone rounded px-2 py-1.5',
          'focus:border-gold focus:shadow-[0_0_5px_var(--color-gold-dark)] outline-none',
          'font-garamond',
          error && 'border-blood',
          className
        )}
        {...props}
      />
      {error && <span className="text-xs text-blood-bright">{error}</span>}
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
        <label className="text-xs text-faded uppercase tracking-wider font-cinzel">
          {label}
        </label>
      )}
      <select
        className={cn(
          'bg-obsidian border border-edge-bone text-bone rounded px-2 py-1.5',
          'focus:border-gold focus:shadow-[0_0_5px_var(--color-gold-dark)] outline-none',
          'font-garamond cursor-pointer',
          className
        )}
        {...props}
      >
        {options.map(opt => (
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
  const percent = Math.max(0, Math.min(100, (value / max) * 100));
  const isLow = type === 'hp' && percent < 25;
  
  const barColors = {
    hp: 'bg-gradient-to-r from-blood-dark via-blood to-blood-bright',
    mana: 'bg-gradient-to-r from-mana-dark via-mana to-mana-bright'
  };
  
  return (
    <div className={cn('relative h-6 bg-obsidian rounded border border-edge-bone overflow-hidden', className)}>
      <div
        className={cn(
          'absolute inset-y-0 left-0 transition-all duration-300',
          barColors[type],
          isLow && 'animate-pulse-blood',
          type === 'mana' && 'animate-shimmer-mana'
        )}
        style={{ width: `${percent}%` }}
      />
      {showText && (
        <div className="absolute inset-0 flex items-center justify-center text-sm font-cinzel text-bone drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
          {type === 'hp' ? '🩸' : '💠'} {value}/{max}
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
    <div className={cn('panel p-3 rounded', className)}>
      <div
        className={cn(
          'flex items-center gap-2 mb-2',
          collapsible && 'cursor-pointer hover:text-gold-bright'
        )}
        onClick={() => collapsible && setIsOpen(!isOpen)}
      >
        {icon && <span>{icon}</span>}
        <h3 className="heading text-sm text-gold flex-1">{title}</h3>
        {collapsible && (
          <span className="text-faded">{isOpen ? '▼' : '▶'}</span>
        )}
      </div>
      {(!collapsible || isOpen) && children}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-abyss/90"
        onClick={onClose}
      />
      <div className={cn(
        'relative bg-dark border border-edge-bone rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col',
        className
      )}>
        <div className="flex items-center justify-between p-4 border-b border-edge-bone">
          <h2 className="heading-decorative text-gold text-lg">{title}</h2>
          <button
            onClick={onClose}
            className="text-faded hover:text-gold text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
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
  const handleChange = useCallback((delta: number) => {
    const newValue = Math.max(min, Math.min(max, value + delta));
    onChange(newValue);
  }, [value, min, max, onChange]);
  
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <label className="text-xs text-faded uppercase tracking-wider font-cinzel">
          {label}
        </label>
      )}
      <div className="flex items-center gap-1">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleChange(-step)}
          disabled={value <= min}
        >
          −
        </Button>
        <input
          type="number"
          value={value}
          onChange={(e) => {
            const num = parseInt(e.target.value, 10);
            if (!isNaN(num)) {
              onChange(Math.max(min, Math.min(max, num)));
            }
          }}
          className="w-16 text-center bg-obsidian border border-edge-bone text-bone rounded py-1 font-garamond"
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleChange(step)}
          disabled={value >= max}
        >
          +
        </Button>
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
          'w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
          checked 
            ? 'bg-gold border-gold text-abyss' 
            : 'bg-obsidian border-edge-bone group-hover:border-gold'
        )}
        onClick={() => onChange(!checked)}
      >
        {checked && <span className="text-xs font-bold">✓</span>}
      </div>
      <span className="text-bone font-garamond">{label}</span>
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
    <div className={cn('flex gap-1 border-b border-edge-bone', className)}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'px-3 py-1.5 text-sm font-cinzel uppercase tracking-wider transition-all',
            activeTab === tab.id ? 'tab-active' : 'tab-inactive'
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

const toastColors = {
  success: 'border-green-600 bg-green-900/50 text-green-400',
  error: 'border-blood bg-blood-dark/50 text-blood-bright',
  info: 'border-mana bg-mana-dark/50 text-mana-bright',
  warning: 'border-gold bg-gold-dark/50 text-gold-bright'
};

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
    <div className={cn(
      'flex items-center gap-2 px-3 py-2 rounded border shadow-lg animate-in slide-in-from-right',
      toastColors[type]
    )}>
      <span>{toastIcons[type]}</span>
      <span className="flex-1 font-garamond text-sm">{message}</span>
      <button onClick={onClose} className="hover:text-white">×</button>
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
  if (results.length === 0) return null;
  
  return (
    <div className={cn('space-y-2', className)}>
      {results.map((result, idx) => (
        <div
          key={idx}
          className={cn(
            'p-2 rounded border',
            result.isCrit && 'border-gold bg-gold-dark/20 dice-crit',
            result.isCritFail && 'border-blood bg-blood-dark/20 dice-fail',
            !result.isCrit && !result.isCritFail && 'border-edge-bone bg-obsidian'
          )}
        >
          {result.label && (
            <div className="text-xs text-faded uppercase mb-1">{result.label}</div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-ancient">
              [{result.rolls.join(', ')}]
            </span>
            {result.bonus !== 0 && (
              <span className="text-faded">
                {result.bonus > 0 ? '+' : ''}{result.bonus}
              </span>
            )}
            <span className="text-gold">=</span>
            <span className={cn(
              'font-bold',
              result.isCrit && 'text-gold-bright',
              result.isCritFail && 'text-blood-bright',
              !result.isCrit && !result.isCritFail && 'text-bone'
            )}>
              {result.total}
            </span>
            {result.isCrit && <span className="text-gold-bright">✨ КРИТ!</span>}
            {result.isCritFail && <span className="text-blood-bright">💀 ПРОВАЛ!</span>}
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
      <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
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
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <span className="text-4xl mb-3">{icon}</span>
      <h3 className="heading text-gold mb-1">{title}</h3>
      {description && (
        <p className="text-faded text-sm mb-3">{description}</p>
      )}
      {action}
    </div>
  );
}
