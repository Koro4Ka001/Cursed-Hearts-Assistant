// src/utils/weaponEffects.ts
import type { SpellAction } from '../types';

/**
 * Контекст для выполнения оружейных эффектов.
 * Все поля доступны через ключ (без скобок) в branch conditions,
 * и через {ключ} в message templates.
 */
export interface WeaponEffectContext {
  hitRoll: number;
  hitTotal: number;
  isCrit: boolean;
  isCritFail: boolean;
  damage: number;
  weaponName: string;
  unitName: string;
  targetIndex: number;
  shotIndex: number;
  values: Record<string, unknown>;
  log: string[];
}

/**
 * Выполняет цепочку SpellAction[] как оружейные эффекты.
 */
export function executeWeaponEffects(
  actions: SpellAction[],
  ctx: WeaponEffectContext,
  addCombatLog: (unitName: string, action: string, details: string) => void
): void {
  if (!actions.length) return;
  
  const sorted = [...actions].sort((a, b) => a.order - b.order);
  let currentIndex = 0;
  let iterations = 0;
  const MAX_ITERATIONS = 50;
  
  while (currentIndex >= 0 && currentIndex < sorted.length && iterations < MAX_ITERATIONS) {
    iterations++;
    const action = sorted[currentIndex]!;
    
    // Проверяем condition если задан
    if (action.condition && action.condition.type !== 'always') {
      if (!evaluateCondition(action.condition, ctx)) {
        currentIndex++;
        continue;
      }
    }
    
    switch (action.type) {
      case 'branch': {
        const cond = action.branchCondition;
        if (!cond) { currentIndex++; break; }
        
        const condMet = evaluateBranchCondition(cond, ctx);
        console.log('[WeaponFX] Branch:', cond.key, cond.type, cond.value, '→', condMet);
        const targetId = condMet ? action.branchTrueStepId : action.branchFalseStepId;
        currentIndex = resolveTarget(targetId, sorted, currentIndex);
        break;
      }
      
      case 'message': {
        const msg = interpolateTemplate(action.messageTemplate ?? '', ctx);
        if (msg) {
          ctx.log.push(msg);
          addCombatLog(ctx.unitName, ctx.weaponName, msg);
        }
        currentIndex++;
        break;
      }
      
      case 'set_value': {
        if (action.setKey) {
          if (action.setValueFromContext) {
            ctx.values[action.setKey] = resolveValue(action.setValueFromContext, ctx);
          } else {
            ctx.values[action.setKey] = action.setValue;
          }
        }
        currentIndex++;
        break;
      }
      
      case 'goto': {
        currentIndex = resolveTarget(action.gotoStepId, sorted, currentIndex);
        break;
      }
      
      case 'stop':
        return;
      
      default:
        currentIndex++;
    }
  }
  
  if (iterations >= MAX_ITERATIONS) {
    console.warn('[WeaponFX] Max iterations reached, possible infinite loop');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ВНУТРЕННИЕ ФУНКЦИИ
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🔥 Очищает ключ от фигурных скобок.
 * Пользователь может ввести "{hitTotal}" вместо "hitTotal" — защищаемся.
 */
function cleanKey(key: string): string {
  return key.replace(/^\{|\}$/g, '').trim();
}

function resolveValue(key: string, ctx: WeaponEffectContext): unknown {
  const cleaned = cleanKey(key);
  
  // Сначала пользовательские значения
  if (cleaned in ctx.values) return ctx.values[cleaned];
  
  // Потом встроенные поля контекста
  switch (cleaned) {
    case 'hitRoll': return ctx.hitRoll;
    case 'hitTotal': return ctx.hitTotal;
    case 'isCrit': return ctx.isCrit;
    case 'isCritFail': return ctx.isCritFail;
    case 'damage': return ctx.damage;
    case 'weaponName': return ctx.weaponName;
    case 'unitName': return ctx.unitName;
    case 'targetIndex': return ctx.targetIndex;
    case 'shotIndex': return ctx.shotIndex;
    default: return undefined;
  }
}

function evaluateCondition(
  condition: NonNullable<SpellAction['condition']>,
  ctx: WeaponEffectContext
): boolean {
  if (condition.type === 'always') return true;
  
  const val = condition.key ? resolveValue(condition.key, ctx) : undefined;
  
  switch (condition.type) {
    case 'value_equals': return String(val) === String(condition.value);
    case 'value_gte': return Number(val) >= Number(condition.value);
    case 'value_lte': return Number(val) <= Number(condition.value);
    case 'value_exists': return val !== undefined && val !== null;
    default: return true;
  }
}

function evaluateBranchCondition(
  cond: NonNullable<SpellAction['branchCondition']>,
  ctx: WeaponEffectContext
): boolean {
  const val = resolveValue(cond.key, ctx);
  
  console.log('[WeaponFX] Branch eval:', `key="${cond.key}" → cleaned="${cleanKey(cond.key)}" → val=${val}, compare ${cond.type} ${cond.value}`);
  
  switch (cond.type) {
    case 'value_gte': return Number(val) >= Number(cond.value);
    case 'value_lte': return Number(val) <= Number(cond.value);
    case 'value_equals': return String(val) === String(cond.value);
    case 'value_exists': return val !== undefined && val !== null;
    case 'value_in_range': {
      const n = Number(val);
      return n >= Number(cond.value) && n <= Number(cond.valueMax ?? cond.value);
    }
    default: return false;
  }
}

function interpolateTemplate(template: string, ctx: WeaponEffectContext): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = resolveValue(key, ctx);
    return v !== undefined ? String(v) : `{${key}}`;
  });
}

function resolveTarget(
  targetId: string | undefined,
  sorted: SpellAction[],
  currentIndex: number
): number {
  if (!targetId || targetId === 'next') return currentIndex + 1;
  if (targetId === 'stop') return -1;
  const idx = sorted.findIndex(a => a.id === targetId);
  return idx >= 0 ? idx : currentIndex + 1;
}
