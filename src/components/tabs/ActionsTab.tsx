import { useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { Button, Section, Select, Input, NumberStepper, Modal, EmptyState, DiceResultDisplay } from '../ui';
import { generateId } from '../../utils/dice';
import { diceService } from '../../services/diceService';
import type { CustomAction, ActionStep, ActionBonus, DiceRollResult, StatKey, ProficiencyType } from '../../types';
import { STAT_NAMES, PROFICIENCY_NAMES } from '../../types';

export function ActionsTab() {
  const { units, selectedUnitId, updateUnit, spendMana, takeDamage, heal } = useGameStore();
  const unit = units.find(u => u.id === selectedUnitId);
  
  const [isExecuting, setIsExecuting] = useState(false);
  const [actionResults, setActionResults] = useState<DiceRollResult[]>([]);
  const [actionLog, setActionLog] = useState<string[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editingAction, setEditingAction] = useState<CustomAction | null>(null);
  
  // Защита от отсутствия юнита
  if (!unit) {
    return (
      <EmptyState
        icon="⚡"
        title="Нет персонажа"
        description="Выберите персонажа"
      />
    );
  }
  
  // Безопасные данные
  const customActions = unit.customActions ?? [];
  const stats = unit.stats ?? {};
  const proficiencies = unit.proficiencies ?? {};
  
  // Выполнение действия
  const executeAction = async (action: CustomAction) => {
    setIsExecuting(true);
    setActionResults([]);
    setActionLog([]);
    
    const results: DiceRollResult[] = [];
    const log: string[] = [];
    
    try {
      log.push(`🎬 Выполняется: ${action.icon} ${action.name}`);
      
      const steps = action.steps ?? [];
      let currentStepIndex = 0;
      
      while (currentStepIndex < steps.length) {
        const step = steps[currentStepIndex];
        if (!step) break;
        
        log.push(`\n--- ${step.label} ---`);
        
        // Вычисляем бонусы
        let totalBonus = 0;
        const bonusBreakdown: string[] = [];
        const bonuses = step.roll?.bonuses ?? [];
        
        for (const bonus of bonuses) {
          let value = 0;
          let label = '';
          
          switch (bonus.type) {
            case 'stat':
              if (bonus.stat && stats[bonus.stat] !== undefined) {
                value = stats[bonus.stat] ?? 0;
                label = STAT_NAMES[bonus.stat] ?? bonus.stat;
              }
              break;
            case 'proficiency':
              if (bonus.proficiency && proficiencies[bonus.proficiency] !== undefined) {
                value = proficiencies[bonus.proficiency] ?? 0;
                label = PROFICIENCY_NAMES[bonus.proficiency] ?? bonus.proficiency;
              }
              break;
            case 'flat':
              value = bonus.flatValue ?? 0;
              label = bonus.label ?? 'Бонус';
              break;
          }
          
          if (value !== 0) {
            totalBonus += value;
            bonusBreakdown.push(`${label}: +${value}`);
          }
        }
        
        // Бросаем кубики
        const diceFormula = step.roll?.dice ?? 'd20';
        const formula = totalBonus !== 0
          ? `${diceFormula}+${totalBonus}`
          : diceFormula;
        
        const result = await diceService.roll(formula, step.label);
        results.push(result);
        
        if (bonusBreakdown.length > 0) {
          log.push(`Бонусы: ${bonusBreakdown.join(', ')}`);
        }
        log.push(`🎲 [${(result.rolls ?? []).join(', ')}] + ${result.bonus ?? 0} = ${result.total}`);
        
        await diceService.showNotification(
          `🎲 ${unit.shortName}: ${step.label} — [${result.rawD20 ?? result.rolls?.[0] ?? 0}] + ${result.bonus ?? 0} = ${result.total}`
        );
        
        // Проверяем порог
        const threshold = step.threshold ?? 11;
        const success = result.total >= threshold;
        
        if (step.threshold) {
          log.push(success 
            ? `✅ Успех! (>= ${threshold})` 
            : `❌ Провал! (< ${threshold})`
          );
        }
        
        // Обрабатываем outcome
        const outcome = success ? step.onSuccess : step.onFailure;
        
        if (outcome) {
          switch (outcome.type) {
            case 'message':
              if (outcome.message) {
                log.push(`📝 ${outcome.message}`);
              }
              break;
              
            case 'next_step':
              if (outcome.nextStepId) {
                const nextIndex = steps.findIndex(s => s.id === outcome.nextStepId);
                if (nextIndex >= 0) {
                  currentStepIndex = nextIndex;
                  continue;
                }
              }
              break;
              
            case 'damage':
              if (outcome.damageFormula) {
                const dmgResult = await diceService.roll(outcome.damageFormula, 'Урон');
                results.push(dmgResult);
                log.push(`💥 Урон: [${(dmgResult.rolls ?? []).join(', ')}] = ${dmgResult.total}`);
              }
              break;
              
            case 'heal':
              if (outcome.healFormula) {
                const healResult = await diceService.roll(outcome.healFormula, 'Исцеление');
                results.push(healResult);
                await heal(unit.id, healResult.total);
                log.push(`💚 Исцеление: [${(healResult.rolls ?? []).join(', ')}] = ${healResult.total}`);
              }
              break;
              
            case 'mana_cost':
              if (outcome.amount) {
                await spendMana(unit.id, outcome.amount);
                log.push(`💠 Потрачено ${outcome.amount} маны`);
              }
              break;
              
            case 'health_cost':
              if (outcome.amount) {
                await takeDamage(unit.id, outcome.amount);
                log.push(`🩸 Потрачено ${outcome.amount} HP`);
              }
              break;
          }
        }
        
        currentStepIndex++;
      }
      
      log.push(`\n✨ Действие завершено`);
      
    } finally {
      setActionResults(results);
      setActionLog(log);
      setIsExecuting(false);
    }
  };
  
  // Создание нового действия
  const createNewAction = () => {
    const newAction: CustomAction = {
      id: generateId(),
      name: 'Новое действие',
      icon: '⚡',
      steps: [{
        id: generateId(),
        label: 'Шаг 1',
        roll: { dice: 'd20', bonuses: [] },
        threshold: 11
      }]
    };
    setEditingAction(newAction);
    setShowEditor(true);
  };
  
  // Сохранение действия
  const saveAction = (action: CustomAction) => {
    const existingIndex = customActions.findIndex(a => a.id === action.id);
    const newActions = existingIndex >= 0
      ? customActions.map(a => a.id === action.id ? action : a)
      : [...customActions, action];
    
    updateUnit(unit.id, { customActions: newActions });
    setShowEditor(false);
    setEditingAction(null);
  };
  
  // Удаление действия
  const deleteAction = (actionId: string) => {
    updateUnit(unit.id, {
      customActions: customActions.filter(a => a.id !== actionId)
    });
  };
  
  const iconOptions = ['⚡', '🔍', '💪', '🤫', '🗣', '⚔️', '🛡️', '🏃', '👁', '🎭', '✨', '🔮'];
  
  return (
    <div className="space-y-3 p-3 overflow-y-auto h-full">
      {/* Бросок с преимуществом / помехой */}
      <Section title="Бросок d20" icon="🎲">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="gold"
              onClick={async () => {
                setIsExecuting(true);
                setActionResults([]);
                setActionLog([]);
                
                const roll1 = await diceService.roll('d20', 'Кубик 1');
                const roll2 = await diceService.roll('d20', 'Кубик 2');
                const val1 = roll1.rawD20 ?? roll1.total;
                const val2 = roll2.rawD20 ?? roll2.total;
                const best = Math.max(val1, val2);
                
                const log = [
                  '🎲 Бросок с ПРЕИМУЩЕСТВОМ',
                  `  Кубик 1: [${val1}]${val1 >= val2 ? ' ✅' : ''}`,
                  `  Кубик 2: [${val2}]${val2 > val1 ? ' ✅' : ''}`,
                  `  Результат: ${best}`
                ];
                
                await diceService.showNotification(
                  `🎲 ${unit.shortName}: Преимущество — [${val1}] / [${val2}] → ✅ ${best}`
                );
                
                setActionLog(log);
                setActionResults([
                  { ...roll1, label: 'Кубик 1' },
                  { ...roll2, label: 'Кубик 2' }
                ]);
                setIsExecuting(false);
              }}
              loading={isExecuting}
            >
              ⬆️ Преимущество
            </Button>
            
            <Button
              variant="secondary"
              onClick={async () => {
                setIsExecuting(true);
                setActionResults([]);
                setActionLog([]);
                
                const roll1 = await diceService.roll('d20', 'Кубик 1');
                const roll2 = await diceService.roll('d20', 'Кубик 2');
                const val1 = roll1.rawD20 ?? roll1.total;
                const val2 = roll2.rawD20 ?? roll2.total;
                const worst = Math.min(val1, val2);
                
                const log = [
                  '🎲 Бросок с ПОМЕХОЙ',
                  `  Кубик 1: [${val1}]${val1 <= val2 ? ' ❌' : ''}`,
                  `  Кубик 2: [${val2}]${val2 < val1 ? ' ❌' : ''}`,
                  `  Результат: ${worst}`
                ];
                
                await diceService.showNotification(
                  `🎲 ${unit.shortName}: Помеха — [${val1}] / [${val2}] → ❌ ${worst}`
                );
                
                setActionLog(log);
                setActionResults([
                  { ...roll1, label: 'Кубик 1' },
                  { ...roll2, label: 'Кубик 2' }
                ]);
                setIsExecuting(false);
              }}
              loading={isExecuting}
            >
              ⬇️ Помеха
            </Button>
          </div>
        </div>
      </Section>
      
      {/* Быстрые действия */}
      <Section title="Быстрые действия" icon="⚡">
        {customActions.length === 0 ? (
          <p className="text-faded text-sm mb-2">Нет настроенных действий</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 mb-3">
            {customActions.map(action => (
              <Button
                key={action.id}
                variant="secondary"
                onClick={() => executeAction(action)}
                loading={isExecuting}
                className="text-left"
              >
                {action.icon} {action.name}
              </Button>
            ))}
          </div>
        )}
        
        <Button
          variant="gold"
          size="sm"
          onClick={createNewAction}
          className="w-full"
        >
          + Создать действие
        </Button>
      </Section>
      
      {/* Результаты */}
      {actionLog.length > 0 && (
        <Section title="Результат" icon="📜">
          <div className="p-2 bg-obsidian rounded border border-edge-bone space-y-1 max-h-48 overflow-y-auto">
            {actionLog.map((line, idx) => (
              <div key={idx} className="text-sm font-garamond whitespace-pre-wrap">{line}</div>
            ))}
          </div>
          
          {actionResults.length > 0 && (
            <div className="mt-2">
              <DiceResultDisplay results={actionResults} />
            </div>
          )}
        </Section>
      )}
      
      {/* Управление действиями */}
      <Section title="Управление" icon="⚙️" collapsible defaultOpen={false}>
        <div className="space-y-2">
          {customActions.map(action => (
            <div key={action.id} className="flex items-center justify-between p-2 bg-obsidian rounded border border-edge-bone">
              <span className="text-bone">{action.icon} {action.name}</span>
              <div className="flex gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => { setEditingAction(action); setShowEditor(true); }}
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
          ))}
        </div>
      </Section>
      
      {/* Редактор действия */}
      <Modal
        isOpen={showEditor}
        onClose={() => { setShowEditor(false); setEditingAction(null); }}
        title="Редактор действия"
        className="max-w-lg"
      >
        {editingAction && (
          <ActionEditor
            action={editingAction}
            onSave={saveAction}
            onCancel={() => { setShowEditor(false); setEditingAction(null); }}
            iconOptions={iconOptions}
          />
        )}
      </Modal>
    </div>
  );
}

// Компонент редактора действия
interface ActionEditorProps {
  action: CustomAction;
  onSave: (action: CustomAction) => void;
  onCancel: () => void;
  iconOptions: string[];
}

function ActionEditor({ action, onSave, onCancel, iconOptions }: ActionEditorProps) {
  const [name, setName] = useState(action.name ?? 'Новое действие');
  const [icon, setIcon] = useState(action.icon ?? '⚡');
  const [steps, setSteps] = useState<ActionStep[]>(action.steps ?? []);
  
  const addStep = () => {
    setSteps([...steps, {
      id: generateId(),
      label: `Шаг ${steps.length + 1}`,
      roll: { dice: 'd20', bonuses: [] },
      threshold: 11
    }]);
  };
  
  const updateStep = (stepId: string, updates: Partial<ActionStep>) => {
    setSteps(steps.map(s => s.id === stepId ? { ...s, ...updates } : s));
  };
  
  const removeStep = (stepId: string) => {
    setSteps(steps.filter(s => s.id !== stepId));
  };
  
  const addBonus = (stepId: string) => {
    setSteps(steps.map(s => {
      if (s.id !== stepId) return s;
      const roll = s.roll ?? { dice: 'd20', bonuses: [] };
      return {
        ...s,
        roll: {
          ...roll,
          bonuses: [...(roll.bonuses ?? []), { type: 'flat' as const, flatValue: 0 }]
        }
      };
    }));
  };
  
  const updateBonus = (stepId: string, bonusIndex: number, updates: Partial<ActionBonus>) => {
    setSteps(steps.map(s => {
      if (s.id !== stepId) return s;
      const roll = s.roll ?? { dice: 'd20', bonuses: [] };
      const newBonuses = [...(roll.bonuses ?? [])];
      if (newBonuses[bonusIndex]) {
        newBonuses[bonusIndex] = { ...newBonuses[bonusIndex]!, ...updates };
      }
      return { ...s, roll: { ...roll, bonuses: newBonuses } };
    }));
  };
  
  const handleSave = () => {
    onSave({ ...action, name, icon, steps });
  };
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        <div className="col-span-3">
          <Input
            label="Название"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <Select
          label="Иконка"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          options={iconOptions.map(i => ({ value: i, label: i }))}
        />
      </div>
      
      {steps.map((step, idx) => (
        <div key={step.id} className="p-3 bg-obsidian rounded border border-edge-bone space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-gold font-cinzel text-sm">Шаг {idx + 1}</span>
            {steps.length > 1 && (
              <Button variant="danger" size="sm" onClick={() => removeStep(step.id)}>×</Button>
            )}
          </div>
          
          <Input
            label="Название шага"
            value={step.label ?? ''}
            onChange={(e) => updateStep(step.id, { label: e.target.value })}
          />
          
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Кубики"
              value={step.roll?.dice ?? 'd20'}
              onChange={(e) => updateStep(step.id, { roll: { ...(step.roll ?? { dice: 'd20', bonuses: [] }), dice: e.target.value } })}
              placeholder="d20"
            />
            <NumberStepper
              label="Порог успеха"
              value={step.threshold ?? 11}
              onChange={(v) => updateStep(step.id, { threshold: v })}
              min={1}
              max={30}
            />
          </div>
          
          <div className="space-y-1">
            <div className="text-xs text-faded">Бонусы:</div>
            {(step.roll?.bonuses ?? []).map((bonus, bIdx) => (
              <div key={bIdx} className="flex gap-1 items-center flex-wrap">
                <Select
                  value={bonus.type ?? 'flat'}
                  onChange={(e) => updateBonus(step.id, bIdx, { type: e.target.value as ActionBonus['type'] })}
                  options={[
                    { value: 'stat', label: 'Характеристика' },
                    { value: 'proficiency', label: 'Владение' },
                    { value: 'flat', label: 'Число' }
                  ]}
                  className="flex-1 min-w-[100px]"
                />
                {bonus.type === 'stat' && (
                  <Select
                    value={bonus.stat ?? 'physicalPower'}
                    onChange={(e) => updateBonus(step.id, bIdx, { stat: e.target.value as StatKey })}
                    options={Object.entries(STAT_NAMES).map(([k, v]) => ({ value: k, label: v }))}
                    className="flex-1 min-w-[100px]"
                  />
                )}
                {bonus.type === 'proficiency' && (
                  <Select
                    value={bonus.proficiency ?? 'swords'}
                    onChange={(e) => updateBonus(step.id, bIdx, { proficiency: e.target.value as ProficiencyType })}
                    options={Object.entries(PROFICIENCY_NAMES).map(([k, v]) => ({ value: k, label: v }))}
                    className="flex-1 min-w-[100px]"
                  />
                )}
                {bonus.type === 'flat' && (
                  <input
                    type="number"
                    value={bonus.flatValue ?? 0}
                    onChange={(e) => updateBonus(step.id, bIdx, { flatValue: parseInt(e.target.value) || 0 })}
                    className="w-16 bg-dark border border-edge-bone text-bone rounded px-2 py-1"
                  />
                )}
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={() => addBonus(step.id)}>
              + Бонус
            </Button>
          </div>
        </div>
      ))}
      
      <Button variant="secondary" onClick={addStep} className="w-full">
        + Добавить шаг
      </Button>
      
      <div className="flex gap-2 pt-2 border-t border-edge-bone">
        <Button variant="secondary" onClick={onCancel} className="flex-1">
          Отмена
        </Button>
        <Button variant="gold" onClick={handleSave} className="flex-1">
          Сохранить
        </Button>
      </div>
    </div>
  );
}
