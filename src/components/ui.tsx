// src/components/ui.tsx
import React, { useState, useCallback, Component, type ReactNode, type ChangeEvent } from 'react';
import { cn } from '../utils/cn';
import type { DiceRollResult, RollModifier } from '../types';

// ════════════════════════════════════════════════════════════
// ERROR BOUNDARY
// ════════════════════════════════════════════════════════════

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  tabName?: string;
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

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary] ${this.props.tabName ?? 'Unknown'}:`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="p-6 flex flex-col items-center justify-center h-full text-center">
          <div className="text-5xl mb-4 animate-float">⚠️</div>
          <h3 className="font-cinzel text-blood-bright text-sm uppercase tracking-widest mb-2">
            Ошибка
          </h3>
          <p className="text-faded text-sm font-garamond mb-4 max-w-xs">
            {this.state.error?.message ?? 'Неизвестная ошибка'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="btn btn-gold px-4 py-2"
          >
            Повторить
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ════════════════════════════════════════════════════════════
// BUTTON — Рунная печать
// ════════════════════════════════════════════════════════════

type ButtonVariant = 'primary' | 'gold' | 'success' | 'danger' | 'secondary' | 'mana';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'btn-gold',
  gold: 'btn-gold',
  success: 'btn-success',
  danger: 'btn-blood',
  secondary: 'btn-secondary',
  mana: 'btn-mana',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'px-2 py-1 text-[10px]',
  md: 'px-3 py-1.5 text-xs',
  lg: 'px-4 py-2 text-sm',
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
        'btn',
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        'active:scale-[0.97] transition-transform',
        loading && 'cursor-wait opacity-60',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        children
      )}
    </button>
  );
}

// ════════════════════════════════════════════════════════════
// INPUT — Поле ввода на пергаменте
// ════════════════════════════════════════════════════════════

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  error?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
}

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <>
          <label className="font-cinzel text-[10px] text-faded uppercase tracking-widest">
            {label}
          </label>
          <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-edge-bone/30 to-transparent -mt-0.5 mb-0.5" />
        </>
      )}
      <input
        className={cn(
          'bg-obsidian border border-edge-bone text-bone rounded px-2.5 py-1.5',
          'font-garamond text-sm placeholder:text-dim',
          'focus:outline-none focus:border-gold focus:shadow-[0_0_8px_rgba(212,167,38,0.15)]',
          'transition-all duration-200',
          error && 'border-blood focus:border-blood',
          className
        )}
        {...props}
      />
      {error && (
        <span className="text-[10px] text-blood-bright font-garamond">{error}</span>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// FORMULA INPUT — Поле ввода формулы с валидацией
// ════════════════════════════════════════════════════════════

import { validateFormula, formatFormulaRange } from '../utils/formulaValidator';

interface FormulaInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  showRange?: boolean;
  placeholder?: string;
  className?: string;
}

export function FormulaInput({ 
  label, 
  value, 
  onChange, 
  showRange = true,
  placeholder,
  className
}: FormulaInputProps) {
  const validation = validateFormula(value || '');
  const range = showRange && value ? formatFormulaRange(value) : '';
  const hasValue = value && value.length > 0;
  
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <>
          <label className="font-cinzel text-[10px] text-faded uppercase tracking-widest">
            {label}
          </label>
          <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-edge-bone/30 to-transparent -mt-0.5 mb-0.5" />
        </>
      )}
      <div className="relative">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'w-full bg-obsidian border text-bone rounded px-2.5 py-1.5 pr-16',
            'font-garamond text-sm placeholder:text-dim',
            'focus:outline-none transition-all duration-200',
            !hasValue || validation.isValid 
              ? 'border-edge-bone focus:border-gold focus:shadow-[0_0_8px_rgba(212,167,38,0.15)]'
              : 'border-blood focus:border-blood-bright',
            className
          )}
        />
        {/* Индикатор диапазона */}
        {validation.isValid && range && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-ancient pointer-events-none">
            {range}
          </span>
        )}
        {/* Индикатор ошибки */}
        {hasValue && !validation.isValid && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-blood-bright pointer-events-none">
            ⚠️
          </span>
        )}
      </div>
      {/* Сообщение об ошибке */}
      {hasValue && !validation.isValid && (
        <span className="text-[10px] text-blood-bright font-garamond">
          {validation.error}
        </span>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TEXTAREA
// ════════════════════════════════════════════════════════════

interface TextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  label?: string;
  onChange?: (e: ChangeEvent<HTMLTextAreaElement>) => void;
}

export function Textarea({ label, className, ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1 h-full">
      {label && (
        <>
          <label className="font-cinzel text-[10px] text-faded uppercase tracking-widest">
            {label}
          </label>
          <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-edge-bone/30 to-transparent -mt-0.5 mb-0.5" />
        </>
      )}
      <textarea
        className={cn(
          'flex-1 bg-obsidian border border-edge-bone text-bone rounded px-2.5 py-2',
          'font-garamond text-sm placeholder:text-dim resize-none',
          'focus:outline-none focus:border-gold focus:shadow-[0_0_8px_rgba(212,167,38,0.15)]',
          'transition-all duration-200',
          className
        )}
        {...props}
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// SELECT
// ════════════════════════════════════════════════════════════

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'children'> {
  label?: string;
  options: SelectOption[];
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
}

export function Select({ label, options, className, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <>
          <label className="font-cinzel text-[10px] text-faded uppercase tracking-widest">
            {label}
          </label>
          <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-edge-bone/30 to-transparent -mt-0.5 mb-0.5" />
        </>
      )}
      <select
        className={cn(
          'bg-obsidian border border-edge-bone text-bone rounded px-2.5 py-1.5 pr-8',
          'font-garamond text-sm cursor-pointer appearance-none',
          'focus:outline-none focus:border-gold focus:shadow-[0_0_8px_rgba(212,167,38,0.15)]',
          'transition-all duration-200',
          'bg-[url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' fill=\'%237a6f62\'%3E%3Cpath d=\'M6 8L1 3h10z\'/%3E%3C/svg%3E")]',
          'bg-no-repeat bg-[right_0.5rem_center]',
          className
        )}
        {...props}
      >
        {(options ?? []).map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// PROGRESS BAR — Сосуд с кровью / Магический кристалл
// ════════════════════════════════════════════════════════════

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
  className,
}: ProgressBarProps) {
  const v = Math.max(0, value ?? 0);
  const m = Math.max(1, max ?? 1);
  const pct = Math.min(100, (v / m) * 100);
  const isLow = type === 'hp' && pct < 25 && pct > 0;

  if (type === 'hp') {
    return (
      <div className={cn('hp-bar-wrap', isLow && 'hp-bar-low', className)}>
        <div className="hp-bar-fill" style={{ width: `${pct}%` }} />
        {showText && (
          <div className="hp-bar-label">❤ {v}/{m}</div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('mana-bar-wrap', className)}>
      <div className="mana-bar-fill" style={{ width: `${pct}%` }} />
      {showText && (
        <div className="mana-bar-label">💠 {v}/{m}</div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// SECTION — Страница гримуара
// ════════════════════════════════════════════════════════════

interface SectionProps {
  title: string;
  icon?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}

export function Section({
  title,
  icon,
  collapsible = false,
  defaultOpen = true,
  children,
  className,
}: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleToggle = useCallback(() => {
    if (collapsible) setIsOpen((prev) => !prev);
  }, [collapsible]);

  return (
    <div className={cn('panel', className)}>
      <div
        className={cn(
          'section-header',
          collapsible && 'cursor-pointer select-none hover:bg-white/[0.02]'
        )}
        onClick={handleToggle}
      >
        {icon && <span className="text-base shrink-0">{icon}</span>}
        <h3 className="flex-1 truncate">{title}</h3>
        {collapsible && (
          <span
            className={cn(
              'text-faded text-xs transition-transform duration-300',
              isOpen ? 'rotate-0' : '-rotate-90'
            )}
          >
            ▾
          </span>
        )}
      </div>

      <div className="h-[1px] bg-gradient-to-r from-transparent via-gold-dark/30 to-transparent" />

      <div
        className={cn(
          'overflow-hidden transition-all duration-300 ease-out',
          isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="p-3">{children}</div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// MODAL — Развёрнутый свиток
// ════════════════════════════════════════════════════════════

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={cn('modal-box', className)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 className="font-cinzel text-gold text-sm uppercase tracking-widest truncate flex-1">
            {title}
          </h2>
          <button
            onClick={onClose}
            className={cn(
              'text-faded hover:text-gold text-xl leading-none ml-3 shrink-0',
              'transition-all duration-200 hover:rotate-90'
            )}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// NUMBER STEPPER
// ════════════════════════════════════════════════════════════

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
  className,
}: NumberStepperProps) {
  const v = value ?? 0;

  const clamp = useCallback(
    (n: number) => Math.max(min, Math.min(max, n)),
    [min, max]
  );

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <>
          <label className="font-cinzel text-[10px] text-faded uppercase tracking-widest truncate">
            {label}
          </label>
          <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-edge-bone/30 to-transparent -mt-0.5 mb-0.5" />
        </>
      )}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(clamp(v - step))}
          disabled={v <= min}
          className="btn btn-secondary px-2 py-1 text-xs active:scale-95 transition-transform"
        >
          −
        </button>
        <input
          type="number"
          value={v}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (!isNaN(n)) onChange(clamp(n));
          }}
          className={cn(
            'w-14 text-center bg-obsidian border border-edge-bone text-bone rounded py-1',
            'font-cinzel text-sm',
            'focus:outline-none focus:border-gold transition-colors'
          )}
        />
        <button
          type="button"
          onClick={() => onChange(clamp(v + step))}
          disabled={v >= max}
          className="btn btn-secondary px-2 py-1 text-xs active:scale-95 transition-transform"
        >
          +
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// CHECKBOX — Рунная метка
// ════════════════════════════════════════════════════════════

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  className?: string;
}

export function Checkbox({ checked, onChange, label, className }: CheckboxProps) {
  return (
    <label className={cn('flex items-center gap-2.5 cursor-pointer group', className)}>
      <div
        className={cn(
          'w-4 h-4 rounded-sm border-2 flex items-center justify-center shrink-0',
          'transition-all duration-200',
          checked
            ? 'bg-gold border-gold text-abyss'
            : 'bg-obsidian border-edge-bone group-hover:border-gold-dark'
        )}
        onClick={() => onChange(!checked)}
      >
        {checked && <span className="text-[9px] font-bold leading-none">✓</span>}
      </div>
      <span className="text-bone font-garamond text-sm select-none">{label}</span>
    </label>
  );
}

// ════════════════════════════════════════════════════════════
// SUB TABS — Закладки гримуара
// ════════════════════════════════════════════════════════════

interface SubTab {
  id: string;
  label: string;
  icon?: string;
}

interface SubTabsProps {
  tabs: SubTab[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export function SubTabs({ tabs, activeTab, onChange, className }: SubTabsProps) {
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {(tabs ?? []).map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'sub-tab',
            activeTab === tab.id && 'sub-tab-active'
          )}
        >
          {tab.icon && <span className="mr-1">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// NOTIFICATION TOAST — Горящий свиток
// ════════════════════════════════════════════════════════════

interface NotificationToastProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  onClose: () => void;
}

const TOAST_ICONS: Record<string, string> = {
  success: '✅',
  error: '❌',
  info: 'ℹ️',
  warning: '⚠️',
};

export function NotificationToast({ message, type, onClose }: NotificationToastProps) {
  return (
    <div className={cn('toast', `toast-${type}`)}>
      <div className="flex items-start gap-2">
        <span className="shrink-0 text-sm">{TOAST_ICONS[type]}</span>
        <span className="flex-1 font-garamond text-sm break-words">{message}</span>
        <button
          onClick={onClose}
          className="shrink-0 ml-1 text-lg leading-none opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Закрыть"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// DICE RESULT DISPLAY — Свиток с результатом
// ════════════════════════════════════════════════════════════

interface DiceResultDisplayProps {
  results: DiceRollResult[];
  className?: string;
}

export function DiceResultDisplay({ results, className }: DiceResultDisplayProps) {
  if (!results || results.length === 0) return null;

  return (
    <div className={cn('space-y-2', className)}>
      {results.map((result, idx) => {
        const rolls = result.rolls ?? [];
        const hasD20 = result.rawD20 !== undefined;
        const isCrit = result.isCrit;
        const isFail = result.isCritFail;

        return (
          <div
            key={idx}
            className={cn(
              'dice-card animate-unfurl',
              isCrit && 'dice-card-crit',
              isFail && 'dice-card-fail'
            )}
            style={{ animationDelay: `${idx * 80}ms` }}
          >
            {result.label && (
              <div className="font-cinzel text-[10px] text-faded uppercase tracking-widest mb-2 truncate">
                {result.label}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1 mb-2">
              {rolls.map((roll, ri) => {
                const isFirstD20 = ri === 0 && hasD20;
                const isCritFace = isFirstD20 && roll === 20;
                const isFailFace = isFirstD20 && roll === 1;

                return (
                  <span
                    key={ri}
                    className={cn(
                      'die-face',
                      isCritFace && 'die-face-crit',
                      isFailFace && 'die-face-fail'
                    )}
                  >
                    {roll}
                  </span>
                );
              })}

              {(result.bonus ?? 0) !== 0 && (
                <span className="text-faded text-sm font-garamond ml-1">
                  {result.bonus > 0 ? '+' : ''}{result.bonus}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-dim text-xs">=</span>
              <span
                className={cn(
                  'dice-total',
                  isCrit && 'dice-crit',
                  isFail && 'dice-fail',
                  !isCrit && !isFail && 'text-bone'
                )}
              >
                {result.total ?? 0}
              </span>

              {isCrit && (
                <span className="text-gold-bright text-xs font-cinzel uppercase tracking-wider animate-float">
                  ✨ Крит
                </span>
              )}
              {isFail && (
                <span className="text-blood-bright text-xs font-cinzel uppercase tracking-wider">
                  💀 Провал
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// COMBAT LOG — Хроника боя
// ════════════════════════════════════════════════════════════

interface CombatLogProps {
  lines: string[];
  className?: string;
}

function getLogLineClass(line: string): string {
  if (line.startsWith('---') || line.startsWith('═')) return 'log-section';
  if (line.includes('✨') || line.includes('КРИТ') || line.includes('Крит')) return 'log-crit';
  if (line.includes('🎯') || line.includes('✅') || line.includes('Попадание')) return 'log-hit';
  if (line.includes('❌') || line.includes('💨') || line.includes('💀') || line.includes('Промах')) return 'log-miss';
  if (line.includes('💠') || line.includes('мана') || line.includes('маны') || line.includes('Мана')) return 'log-mana';
  if (line.includes('💥') || line.includes('урон') || line.includes('Урон')) return 'log-damage';
  return 'log-info';
}

export function CombatLog({ lines, className }: CombatLogProps) {
  if (!lines || lines.length === 0) return null;

  return (
    <div className={cn('combat-log', className)}>
      {lines.map((line, idx) => (
        <div key={idx} className={cn('combat-log-line', getLogLineClass(line))}>
          {line}
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// LOADING SPINNER — Вращающаяся руна
// ════════════════════════════════════════════════════════════

interface LoadingSpinnerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingSpinner({ className, size = 'md' }: LoadingSpinnerProps) {
  const sizeClass = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
  }[size];

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div className={cn('rune-spinner', sizeClass)} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// EMPTY STATE — Пустое состояние
// ════════════════════════════════════════════════════════════

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-10 px-4 text-center', className)}>
      <span className="text-5xl mb-4 animate-float">{icon}</span>
      <h3 className="font-cinzel text-gold text-sm uppercase tracking-widest mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-faded text-sm font-garamond mb-4 max-w-xs">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// BUTTON GROUP
// ════════════════════════════════════════════════════════════

interface ButtonGroupProps {
  children: ReactNode;
  className?: string;
}

export function ButtonGroup({ children, className }: ButtonGroupProps) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {children}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// UNDO BUTTON — Кнопка отмены
// ════════════════════════════════════════════════════════════

interface UndoButtonProps {
  onClick: () => void;
  description?: string;
  count?: number;
  disabled?: boolean;
  className?: string;
}

export function UndoButton({ onClick, description, count = 0, disabled = false, className }: UndoButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={description ? `Отменить: ${description}` : 'Нечего отменять'}
      className={cn(
        'px-2 py-1 rounded text-xs font-cinzel transition-all flex items-center gap-1',
        !disabled
          ? 'bg-gold/20 text-gold hover:bg-gold/30 border border-gold/50'
          : 'bg-obsidian text-dim border border-edge-bone cursor-not-allowed opacity-50',
        className
      )}
    >
      ↩️
      {count > 0 && <span>({count})</span>}
    </button>
  );
}
