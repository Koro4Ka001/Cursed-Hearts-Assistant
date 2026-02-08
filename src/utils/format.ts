export function formatTime(date: Date = new Date()): string {
  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatLogMessage(shortName: string, action: string): string {
  return `[${formatTime()}] ${shortName} ${action}`;
}

export function formatStatValue(current: number, max: number): string {
  return `${current}/${max}`;
}

export function getPercentage(current: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round((current / max) * 100);
}

export function formatBonus(value: number): string {
  if (value >= 0) return `+${value}`;
  return `${value}`;
}

export function pluralize(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export function formatDamageLog(damage: number, type: string): string {
  return `${damage} ${type} урона`;
}
