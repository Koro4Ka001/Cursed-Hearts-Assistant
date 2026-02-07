import { cn } from '@/utils/cn';

interface ProgressBarProps {
  current: number;
  max: number;
  color?: 'red' | 'blue' | 'green' | 'amber' | 'purple';
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  label?: string;
}

export function ProgressBar({ 
  current, 
  max, 
  color = 'red', 
  showText = true,
  size = 'md',
  icon,
  label,
}: ProgressBarProps) {
  const percentage = max > 0 ? Math.min(100, (current / max) * 100) : 0;
  
  const colors = {
    red: 'from-red-600 to-red-700',
    blue: 'from-blue-500 to-blue-600',
    green: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600',
    purple: 'from-purple-500 to-purple-600',
  };
  
  const bgColors = {
    red: 'bg-red-900/30',
    blue: 'bg-blue-900/30',
    green: 'bg-emerald-900/30',
    amber: 'bg-amber-900/30',
    purple: 'bg-purple-900/30',
  };
  
  const glowColors = {
    red: 'shadow-red-500/30',
    blue: 'shadow-blue-500/30',
    green: 'shadow-emerald-500/30',
    amber: 'shadow-amber-500/30',
    purple: 'shadow-purple-500/30',
  };
  
  const sizes = {
    sm: 'h-3',
    md: 'h-5',
    lg: 'h-7',
  };
  
  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };
  
  return (
    <div className="space-y-1">
      {label && (
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{label}</span>
        </div>
      )}
      <div className={cn(
        'relative w-full rounded-full overflow-hidden border border-gray-700',
        bgColors[color],
        sizes[size]
      )}>
        {/* Bar */}
        <div 
          className={cn(
            'h-full rounded-full bg-gradient-to-r transition-all duration-300',
            colors[color],
            percentage > 0 && `shadow-lg ${glowColors[color]}`
          )}
          style={{ width: `${percentage}%` }}
        />
        
        {/* Text overlay */}
        {showText && (
          <div className={cn(
            'absolute inset-0 flex items-center justify-center font-medium text-white drop-shadow-lg',
            textSizes[size]
          )}>
            {icon && <span className="mr-1">{icon}</span>}
            <span>{current}/{max}</span>
          </div>
        )}
      </div>
    </div>
  );
}
