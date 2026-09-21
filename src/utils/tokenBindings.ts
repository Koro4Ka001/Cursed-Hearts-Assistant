// src/utils/tokenBindings.ts
// 🔗 Привязки токенов юнита: новый массив + обратная совместимость
// со старым одиночным полем owlbearTokenId.

import type { Unit } from '../types';

/** Все привязанные токены юнита (уникальные) */
export function getUnitTokenIds(unit: Unit): string[] {
  const arr = unit.owlbearTokenIds;
  if (arr && arr.length > 0) return [...new Set(arr.filter(Boolean))];
  return unit.owlbearTokenId ? [unit.owlbearTokenId] : [];
}

/** Сохраняет массив привязок + синхронизирует старое поле (первый токен) */
export function normalizeTokenBindings(unit: Unit, ids: string[]): { owlbearTokenIds: string[]; owlbearTokenId?: string } {
  const uniq = [...new Set(ids.filter(Boolean))];
  return { owlbearTokenIds: uniq, owlbearTokenId: uniq[0] };
}
