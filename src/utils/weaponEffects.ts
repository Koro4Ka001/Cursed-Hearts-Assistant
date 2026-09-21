// src/utils/weaponEffects.ts
import type { SpellAction } from '../types';
import { DAMAGE_TYPE_NAMES } from '../types';
import { rollFormula } from '../services/diceService';
import { resolveAmountValue } from '../utils/dice';
import { useGameStore } from '../stores/useGameStore';

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
  /** id юнита-владельца оружия (для шагов modify_resource) */
  unitId?: string;
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

      case 'roll_dice': {
        const total = rollFormula(action.diceFormula ?? 'd6');
        const key = action.saveResultAs ?? 'lastRoll';
        ctx.values[key] = total;
        ctx.values['lastRoll'] = total;
        const msg = `🎲 ${action.label || 'Бросок'}: ${total}`;
        ctx.log.push(msg);
        addCombatLog(ctx.unitName, ctx.weaponName, msg);
        currentIndex++;
        break;
      }

      case 'roll_damage': {
        // 🔧 «Бросок урона» хранит формулу в damageFormula (поле «Формула урона»).
        // Раньше читался diceFormula («Бросок кубиков») — из-за этого введённая
        // формула/число игнорировалась и катился случайный d6.
        // Формула может быть и просто числом: «45».
        const formula = action.damageFormula ?? action.diceFormula ?? 'd6';
        const total = rollFormula(formula);
        const key = action.saveResultAs ?? 'lastRoll';
        ctx.values[key] = total;
        ctx.values['lastDamage'] = total;
        ctx.values['lastRoll'] = total;
        const typeLabel = action.damageType && action.damageType !== 'from_context'
          ? (DAMAGE_TYPE_NAMES[action.damageType] ?? action.damageType)
          : '';
        const msg = `💥 ${action.label || 'Урон'}: ${formula} = ${total}${typeLabel ? ` ${typeLabel}` : ''}`;
        ctx.log.push(msg);
        addCombatLog(ctx.unitName, ctx.weaponName, msg);
        currentIndex++;
        break;
      }

      case 'damage_tiers': {
        const roll = Number(ctx.values['lastRoll'] ?? ctx.hitRoll ?? 0);
        const tier = (action.damageTiers ?? []).find(t => roll >= t.minRoll && roll <= t.maxRoll);
        if (tier) {
          const total = rollFormula(tier.formula);
          const key = action.saveResultAs ?? 'tierDamage';
          ctx.values[key] = total;
          ctx.values['lastDamage'] = total;
          const msg = `🎯 ${action.label || 'Ступень'}: прокидка ${roll} → ${total}`;
          ctx.log.push(msg);
          addCombatLog(ctx.unitName, ctx.weaponName, msg);
        }
        currentIndex++;
        break;
      }

      case 'apply_damage': {
        const total = rollFormula(action.damageFormula ?? '0');
        ctx.values['lastDamage'] = total;
        const msg = `💥 ${action.label || 'Урон'}: ${total} — примените к цели вручную`;
        ctx.log.push(msg);
        addCombatLog(ctx.unitName, ctx.weaponName, msg);
        currentIndex++;
        break;
      }

      case 'modify_resource': {
        const store = useGameStore.getState();
        const unit = ctx.unitId ? store.units.find(u => u.id === ctx.unitId) : undefined;
        if (!unit) { currentIndex++; break; }

        // 🔧 Число / формула («2d6») / переменная контекста («{lastRoll}»)
        const amount = resolveAmountValue(action.resourceAmount, ctx.values);
        const spend = action.resourceOperation !== 'restore';

        try {
          if (action.resourceType === 'mana') {
            if (spend) void store.spendMana(unit.id, amount);
            else void store.setMana(unit.id, unit.mana.current + amount);
          } else if (action.resourceType === 'health') {
            if (spend) void store.takeDamage(unit.id, amount); else void store.heal(unit.id, amount);
          } else if (action.resourceType === 'rage') {
            if (spend) void store.spendRage(unit.id, amount); else void store.addRage(unit.id, amount);
          } else if (action.resourceType === 'resource' && action.resourceId) {
            if (spend) void store.spendResource(unit.id, action.resourceId, amount);
            else {
              const res = unit.resources.find(r => r.id === action.resourceId);
              if (res) void store.setResource(unit.id, action.resourceId, res.current + amount);
            }
          }
          const sign = spend ? '−' : '+';
          const msg = `${spend ? '🔻' : '🔺'} ${action.label || 'Ресурс'}: ${sign}${amount}`;
          ctx.log.push(msg);
          addCombatLog(ctx.unitName, ctx.weaponName, msg);
        } catch {
          // ресурс недоступен — шаг пропускается без падения цепочки
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
