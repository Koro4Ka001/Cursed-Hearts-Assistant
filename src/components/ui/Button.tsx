import { cn } from '@/utils/cn';
import type { ReactNode, ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  children?: ReactNode;
}

export function Button({ 
  variant = 'primary', 
  size = 'md', 
  icon, 
  children, 
  className,
  disabled,
  ...props 
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-200 border rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white border-amber-500 focus:ring-amber-500 shadow-lg shadow-amber-900/30',
    secondary: 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-600 focus:ring-gray-500',
    danger: 'bg-gradient-to-r from-red-700 to-red-800 hover:from-red-600 hover:to-red-700 text-white border-red-600 focus:ring-red-500 shadow-lg shadow-red-900/30',
    success: 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white border-emerald-500 focus:ring-emerald-500 shadow-lg shadow-emerald-900/30',
    ghost: 'bg-transparent hover:bg-gray-800 text-gray-300 border-transparent focus:ring-gray-500',
  };
  
  const sizes = {
    sm: 'px-2 py-1 text-xs gap-1',
    md: 'px-3 py-2 text-sm gap-2',
    lg: 'px-4 py-3 text-base gap-2',
  };
  
  return (
    <button 
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  );
}
