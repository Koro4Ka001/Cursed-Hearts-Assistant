// src/components/tabs/ActionsTab.tsx

import { useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { 
  Button, Section, Select, Input, NumberStepper, 
  EmptyState, DiceResultDisplay 
} from '../ui';
import { ActionEditorModal } from '../action-editor';
import { spellExecutor } from '../../services/spellExecutor';
import { diceService } from '../../services/diceService';
import { evaluateElementEffects, formatElementEffectLog } from '../../utils/elementEffects';
import type { 
  CustomAction, 
  CustomActionV2, 
  DiceRollResult, 
  CastContext,
  ActionCost
} from '../../types';
import { 
  isCustomActionV2, 
  ACTION_CATEGORY_NAMES, 
  ACTION_CATEGORY_ICONS 
} from '../../types';

// ═══════════════════════════════════════════════════════════════
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: ВЫЧИСЛЕНИЕ СТОИМОСТИ (ПОДДЕРЖКА ФОРМУЛ)
// ═══════════════════════════════════════════════════════════════

function evaluateCost(cost: ActionCost): { value: number; formula?: string; rolled?: boolean } {
  if (typeof cost.amount === 'number') {
    return { value: cost.amount };
  }
  
  // Это формула — бросаем кубы
  try {
    const formula = cost.amount;
    const rolls: number[] = [];
    const tokens = formula.toLowerCase().replace(/\s/g, '').match(/[+-]?(\d*d\d+|\d+)/g) || [];
    let total = 0;
    
    for (const token of tokens) {
      const diceMatch = token.match(/([+-]?)(\d*)d(\d+)/);
      if (diceMatch) {
        const count = parseInt(diceMatch[2] || '1', 10);
        const sides = parseInt(diceMatch[3]!, 10);
        for (let i = 0; i < count; i++) {
          const roll = Math.floor(Math.random() * sides) + 1;
          rolls.push(roll);
          total += roll;
        }
      } else {
        const num = parseInt(token, 10);
        if (!isNaN(num)) total += num;
      }
    }
    
    return { value: total, formula, rolled: true };
  } catch (e) {
    console.error('[ActionsTab] Invalid cost formula:', cost.amount);
    return { value: 0 };
  }
}

// ═══════════════════════════════════════════════════════════════
// КОМПОНЕНТ
// ═══════════════════════════════════════════════════════════════

export function ActionsTab() {
  const { 
    units, selectedUnitId, updateUnit, 
    spendMana, setHP, setMana, spendRage,
    addNotification, triggerEffect 
  } = useGameStore();
  
  const unit = units.find(u => u.id === selectedUnitId);
  
  const [isExecuting, setIsExecuting] = useState(false);
  const [actionResults, setActionResults] = useState<DiceRollResult[]>([]);
  const [actionLog, setActionLog] = useState<string[]>([]);
  const [lastContext, setLastContext] = useState<CastContext | null>(null);
  
  const [showEditor, setShowEditor] = useState(false);
  const [editingAction, setEditingAction] = useState<CustomAction | CustomActionV2 | null>(null);
  
  // Состояние сворачивания категорий
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  
  // Защита
  if (!unit) {
    return (
      <EmptyState
        icon="⚡"
        title="Нет персонажа"
        description="Выберите персонажа"
      />
    );
  }
  
  const customActions = unit.customActions ?? [];
  const resources = unit.resources ?? [];
  
  // ─────────────────────────────────────────────────────────────
  // СВОРАЧИВАНИЕ КАТЕГОРИЙ
  // ─────────────────────────────────────────────────────────────
  
  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };
  
  // ─────────────────────────────────────────────────────────────
  // ВЫПОЛНЕНИЕ ДЕЙСТВИЯ V2
  // ─────────────────────────────────────────────────────────────
  
  const executeActionV2 = async (action: CustomActionV2) => {
    setIsExecuting(true);
    setActionResults([]);
    setActionLog([]);
    setLastContext(null);
    
    // 🔥 ИЗМЕНЕНО: Сначала вычисляем стоимость (бросаем кубы если формула)
    const costResults: Array<{ cost: ActionCost; value: number; formula?: string; rolled?: boolean }> = [];
    
    for (const cost of action.costs) {
      const evaluated = evaluateCost(cost);
      costResults.push({ cost, ...evaluated });
      
      // Проверяем наличие ресурсов
      if (cost.type === 'mana') {
        if (unit.mana.current < evaluated.value) {
          addNotification(`Недостаточно маны! Нужно ${evaluated.value}${evaluated.formula ? ` (${evaluated.formula})` : ''}`, 'warning');
          setIsExecuting(false);
          return;
        }
      } else if (cost.type === 'health') {
        if (unit.health.current < evaluated.value) {
          addNotification(`Недостаточно HP! Нужно ${evaluated.value}${evaluated.formula ? ` (${evaluated.formula})` : ''}`, 'warning');
          setIsExecuting(false);
          return;
        }
      } else if (cost.type === 'rage' && unit.hasRage) {
        if ((unit.rage?.current ?? 0) < evaluated.value) {
          addNotification(`Недостаточно Rage! Нужно ${evaluated.value}${evaluated.formula ? ` (${evaluated.formula})` : ''}`, 'warning');
          setIsExecuting(false);
          return;
        }
      } else if (cost.type === 'resource' && cost.resourceId) {
        const resource = resources.find(r => r.id === cost.resourceId);
        if (!resource || resource.current < evaluated.value) {
          addNotification(`Недостаточно ресурса "${resource?.name ?? 'неизвестно'}"! Нужно ${evaluated.value}`, 'warning');
          setIsExecuting(false);
          return;
        }
      }
    }
    
    // 🔥 ИЗМЕНЕНО: Логируем стоимость с формулами
    const costLog: string[] = [];
    for (const { cost, value, formula, rolled } of costResults) {
      if (rolled) {
        costLog.push(`💠 ${cost.type === 'mana' ? 'Мана' : cost.type === 'health' ? 'HP' : cost.type === 'rage' ? 'Rage' : 'Ресурс'}: ${formula} = ${value}`);
      } else {
        costLog.push(`💠 ${cost.type === 'mana' ? 'Мана' : cost.type === 'health' ? 'HP' : cost.type === 'rage' ? 'Rage' : 'Ресурс'}: ${value}`);
      }
    }
    setActionLog(costLog);
    
    // Тратим ресурсы (уже вычисленные числа)
    for (const { cost, value } of costResults) {
      if (cost.type === 'mana') {
        await spendMana(unit.id, value);
      } else if (cost.type === 'health') {
        const freshUnit = useGameStore.getState().units.find(u => u.id === unit.id);
        if (freshUnit) await setHP(unit.id, freshUnit.health.current - value);
      } else if (cost.type === 'rage' && unit.hasRage) {
        await spendRage(unit.id, value);
      } else if (cost.type === 'resource' && cost.resourceId) {
        const freshUnit = useGameStore.getState().units.find(u => u.id === unit.id);
        const resource = freshUnit?.resources.find(r => r.id === cost.resourceId);
        if (resource) {
          await useGameStore.getState().setResource(unit.id, cost.resourceId, resource.current - value);
        }
      }
    }
    
    // Используем модификатор из самого действия
    const useModifier = action.defaultRollModifier;
    
    try {
      // Создаём фейковый SpellV2 для исполнителя
      const fakeSpell = {
        id: action.id,
        name: action.name,
        version: 2 as const,
        cost: 0,
        costResource: 'mana' as const,
        spellType: 'utility' as const,
        projectiles: '1',
        elements: [],
        description: action.description,
        actions: action.actions,
        modifiers: [],
      };
      
      const result = await spellExecutor.execute({
        spell: fakeSpell,
        caster: unit,
        targetCount: 1,
        rollModifier: useModifier,
        onLog: (msg) => {
          console.log('[Action]', msg);
          setActionLog(prev => [...prev, msg]);
        },
      });
      
      // Применяем ресурсные изменения из modify_resource шагов
      const resourceChanges = result.context.values._resourceChanges as Array<{type: string; amount: number; resourceId?: string}> | undefined;
      if (resourceChanges) {
        for (const change of resourceChanges) {
          if (change.type === 'mana') {
            const currentMana = useGameStore.getState().units.find(u => u.id === unit.id)?.mana.current ?? unit.mana.current;
            await setMana(unit.id, currentMana + change.amount);
          } else if (change.type === 'health') {
            const currentHP = useGameStore.getState().units.find(u => u.id === unit.id)?.health.current ?? unit.health.current;
            await setHP(unit.id, currentHP + change.amount);
          } else if (change.type === 'rage' && unit.hasRage) {
            if (change.amount > 0) {
              await useGameStore.getState().addRage(unit.id, change.amount);
            } else {
              await useGameStore.getState().spendRage(unit.id, Math.abs(change.amount));
            }
          } else if (change.type === 'resource' && change.resourceId) {
            const currentUnit = useGameStore.getState().units.find(u => u.id === unit.id);
            const resource = currentUnit?.resources.find(r => r.id === change.resourceId);
            if (resource) {
              await useGameStore.getState().setResource(unit.id, change.resourceId, resource.current + change.amount);
            }
          }
        }
      }
      
      setLastContext(result.context);
      
      // Конвертируем rolls
      const diceResults: DiceRollResult[] = result.context.rolls.map(r => ({
        formula: r.formula,
        rolls: r.rolls,
        bonus: 0,
        total: r.total,
        rawD20: r.rawD20,
        isCrit: r.isCrit,
        isCritFail: r.isCritFail,
      }));
      setActionResults(diceResults);
      
      // Эффекты
      if (result.context.isCritFail) {
        triggerEffect('crit-fail');
      } else if (result.context.isCrit) {
        triggerEffect('crit-gold');
      }
      
      // Broadcast
      await diceService.broadcastAction(
        action.name,
        unit.shortName ?? unit.name,
        result.success,
        result.context.isCrit
      );
      
    } catch (err) {
      console.error('[ActionsTab] Execute error:', err);
      addNotification(`Ошибка: ${err}`, 'error');
    } finally {
      setIsExecuting(false);
    }
  };
  
  // ─────────────────────────────────────────────────────────────
  // ВЫПОЛНЕНИЕ СТАРОГО ДЕЙСТВИЯ (fallback)
  // ─────────────────────────────────────────────────────────────
  
  const executeLegacyAction = async (action: CustomAction) => {
    setIsExecuting(true);
    setActionResults([]);
    setActionLog([`🎬 ${action.icon} ${action.name} (старый формат)`]);
    
    try {
      const results: DiceRollResult[] = [];
      const log: string[] = [];
      
      for (const step of (action.steps ?? [])) {
        const formula = step.roll?.dice ?? 'd20';
        const result = await diceService.roll(
          formula,
          step.label,
          unit.shortName ?? unit.name,
          step.rollModifier ?? 'normal'
        );
        results.push(result);
        log.push(`${step.label}: [${result.rawD20 ?? result.total}] = ${result.total}`);
      }
      
      setActionResults(results);
      setActionLog(log);
    } finally {
      setIsExecuting(false);
    }
  };
  
  // ─────────────────────────────────────────────────────────────
  // ОБРАБОТЧИКИ
  // ─────────────────────────────────────────────────────────────
  
  const executeAction = async (action: CustomAction | CustomActionV2) => {
    if (isCustomActionV2(action)) {
      await executeActionV2(action);
    } else {
      await executeLegacyAction(action);
    }
  };
  
  const createNewAction = () => {
    setEditingAction(null);
    setShowEditor(true);
  };
  
  const editAction = (action: CustomAction | CustomActionV2) => {
    setEditingAction(action);
    setShowEditor(true);
  };
  
  const saveAction = (action: CustomActionV2) => {
    const existingIndex = customActions.findIndex(a => a.id === action.id);
    const newActions = existingIndex >= 0
      ? customActions.map(a => a.id === action.id ? action : a)
      : [...customActions, action];
    
    updateUnit(unit.id, { customActions: newActions });
    setShowEditor(false);
    setEditingAction(null);
  };
  
  const deleteAction = (actionId: string) => {
    updateUnit(unit.id, {
      customActions: customActions.filter(a => a.id !== actionId)
    });
  };
  
  // Группировка по категориям
  const actionsByCategory = customActions.reduce((acc, action) => {
    const category = isCustomActionV2(action) ? action.category : 'other';
    if (!acc[category]) acc[category] = [];
    acc[category]!.push(action);
    return acc;
  }, {} as Record<string, (CustomAction | CustomActionV2)[]>);
  
  // ─────────────────────────────────────────────────────────────
  // РЕНДЕР
  // ─────────────────────────────────────────────────────────────
  
  return (
    <div className="space-y-3 p-3 overflow-y-auto h-full">
      
      {/* Быстрые броски */}
      <Section title="Быстрые броски" icon="🎲">
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="secondary"
            onClick={async () => {
              setIsExecuting(true);
              const result = await diceService.roll('d20', 'd20', unit.shortName ?? unit.name, 'normal');
              setActionResults([result]);
              setActionLog([`🎲 d20: [${result.rawD20}] = ${result.total}`]);
              setIsExecuting(false);
            }}
            loading={isExecuting}
          >
            d20
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              setIsExecuting(true);
              const result = await diceService.roll('d12', 'd12', unit.shortName ?? unit.name);
              setActionResults([result]);
              setActionLog([`🎲 d12: [${result.rolls.join(', ')}] = ${result.total}`]);
              setIsExecuting(false);
            }}
            loading={isExecuting}
          >
            d12
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              setIsExecuting(true);
              const result = await diceService.roll('d6', 'd6', unit.shortName ?? unit.name);
              setActionResults([result]);
              setActionLog([`🎲 d6: [${result.rolls.join(', ')}] = ${result.total}`]);
              setIsExecuting(false);
            }}
            loading={isExecuting}
          >
            d6
          </Button>
        </div>
      </Section>
      
      {/* Кастомные действия */}
      <Section title="Действия" icon="⚡">
        {customActions.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-faded text-sm mb-3">Нет настроенных действий</p>
          </div>
        ) : (
          <div className="space-y-2">
            {Object.entries(actionsByCategory).map(([category, actions]) => {
              const isCollapsed = collapsedCategories.has(category);
              
              return (
                <div key={category} className="border border-edge-bone rounded overflow-hidden">
                  {/* Заголовок категории (кликабельный) */}
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 bg-obsidian hover:bg-panel transition-colors text-left"
                  >
                    <span className="text-sm">
                      {ACTION_CATEGORY_ICONS[category as keyof typeof ACTION_CATEGORY_ICONS] ?? '✨'}
                    </span>
                    <span className="text-xs text-faded uppercase flex-1">
                      {ACTION_CATEGORY_NAMES[category as keyof typeof ACTION_CATEGORY_NAMES] ?? category}
                    </span>
                    <span className="text-xs text-ancient">
                      {actions.length}
                    </span>
                    <span className={`text-faded text-xs transition-transform ${isCollapsed ? '-rotate-90' : ''}`}>
                      ▾
                    </span>
                  </button>
                  
                  {/* Содержимое категории */}
                  {!isCollapsed && (
                    <div className="p-2 grid grid-cols-2 gap-2 bg-panel/30">
                      {actions.map(action => {
                        const isV2 = isCustomActionV2(action);
                        const hasCost = isV2 && action.costs.length > 0;
                        
                        return (
                          <Button
                            key={action.id}
                            variant="secondary"
                            onClick={() => executeAction(action)}
                            loading={isExecuting}
                            className="text-left flex items-center gap-1"
                          >
                            <span>{action.icon}</span>
                            <span className="truncate flex-1">{action.name}</span>
                            {hasCost && <span className="text-xs text-mana-bright">💰</span>}
                            {isV2 && action.defaultRollModifier === 'advantage' && <span className="text-xs">🎯</span>}
                            {isV2 && action.defaultRollModifier === 'disadvantage' && <span className="text-xs">💨</span>}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        <Button
          variant="gold"
          size="sm"
          onClick={createNewAction}
          className="w-full mt-3"
        >
          + Создать действие
        </Button>
      </Section>
      
      {/* Результаты */}
      {actionLog.length > 0 && (
        <Section title="Результат" icon="📜">
          <div className="p-3 bg-obsidian rounded border border-edge-bone space-y-1 max-h-48 overflow-y-auto">
            {actionLog.map((line, idx) => (
              <div 
                key={idx} 
                className={`text-sm font-garamond ${
                  line.includes('КРИТ ПРОВАЛ') ? 'text-blood-bright' :
                  line.includes('КРИТ') || line.includes('✨') ? 'text-gold' :
                  line.includes('💥') ? 'text-blood-bright' :
                  line.includes('═══') ? 'text-gold font-cinzel' :
                  line.includes('✅') ? 'text-green-500' :
                  line.includes('❌') ? 'text-blood' :
                  'text-bone'
                }`}
              >
                {line}
              </div>
            ))}
          </div>
          
          {actionResults.length > 0 && (
            <div className="mt-2">
              <DiceResultDisplay results={actionResults} />
            </div>
          )}
        </Section>
      )}
      
      {/* Управление */}
      <Section title="Управление" icon="⚙️" collapsible defaultOpen={false}>
        <div className="space-y-2">
          {customActions.map(action => {
            const isV2 = isCustomActionV2(action);
            return (
              <div key={action.id} className="flex items-center justify-between p-2 bg-obsidian rounded border border-edge-bone">
                <div className="flex items-center gap-2">
                  <span>{action.icon}</span>
                  <span className="text-bone">{action.name}</span>
                  {isV2 && <span className="text-xs text-purple-400">V2</span>}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => editAction(action)}
                  >
                    ✏️
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => deleteAction(action.id)}
                  >
                    🗑️
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Section>
      
      {/* Редактор */}
      <ActionEditorModal
        isOpen={showEditor}
        onClose={() => { setShowEditor(false); setEditingAction(null); }}
        action={editingAction}
        resources={resources}
        onSave={saveAction}
      />
    </div>
  );
}
