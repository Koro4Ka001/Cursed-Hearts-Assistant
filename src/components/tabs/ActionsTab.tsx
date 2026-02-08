import { useState } from 'react';
import { useGameStore } from '@/stores/useGameStore';
import { Button, Section, Input, Select, NumberStepper, DiceResultDisplay, Modal } from '@/components/ui';
import { rollD20 } from '@/utils/dice';
import type { QuickAction, ActionStep, ActionBonus, ActionOutcome, StatName, ProficiencyType } from '@/types';
import { STAT_NAMES, PROFICIENCY_NAMES } from '@/types';
interface StepResult {
  label: string;
  roll: number;
  bonus: number;
  total: number;
  success?: boolean;
  isCrit?: boolean;
  isCritFail?: boolean;
  details?: string;
}

export function ActionsTab() {
  const unit = useGameStore((s) => s.getSelectedUnit());
  const updateUnit = useGameStore((s) => s.updateUnit);
  const addLog = useGameStore((s) => s.addLog);
  const addNotification = useGameStore((s) => s.addNotification);

  const [actionResults, setActionResults] = useState<StepResult[]>([]);
  const [showCreator, setShowCreator] = useState(false);
  const [editingAction, setEditingAction] = useState<QuickAction | null>(null);

  if (!unit) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <span className="text-4xl mb-3">🎯</span>
        <p className="text-sm text-[#7a6f62]">Выберите или создайте юнита в настройках</p>
      </div>
    );
  }

  const calculateBonus = (bonuses: ActionBonus[]): number => {
    return bonuses.reduce((total, b) => {
      const mult = b.multiplier ?? 1;
      switch (b.type) {
        case 'stat': return total + (unit.stats[b.stat!] || 0) * mult;
        case 'proficiency': return total + (unit.proficiencies[b.proficiency!] || 0) * mult;
        case 'flat': return total + (b.value || 0) * mult;
        default: return total;
      }
    }, 0);
  };

  const executeAction = (action: QuickAction) => {
    if (action.steps.length === 0) return;

    const results: StepResult[] = [];
    let currentStepIndex = 0;

    const processStep = (step: ActionStep, stepNum: number) => {
      const bonus = calculateBonus(step.roll.bonuses);
      const roll = rollD20(bonus);
      const success = roll.isCrit || (!roll.isCritFail && roll.total > step.threshold);

      results.push({
        label: `Шаг ${stepNum}`,
        roll: roll.rolls[0],
        bonus,
        total: roll.total,
        success,
        isCrit: roll.isCrit,
        isCritFail: roll.isCritFail,
        details: `Порог: ${step.threshold}`,
      });

      const outcome = success ? step.onSuccess : step.onFailure;

      if (outcome.message) {
        results.push({
          label: success ? '✓ Результат' : '✕ Результат',
          roll: 0, bonus: 0, total: 0,
          details: outcome.message,
        });
      }

      if (outcome.type === 'next_step' && outcome.nextStepId) {
        const nextStep = action.steps.find((s) => s.id === outcome.nextStepId);
        if (nextStep) processStep(nextStep, stepNum + 1);
      }
    };

    processStep(action.steps[currentStepIndex], 1);
    setActionResults(results);

    addLog({
      unitName: unit.shortName,
      message: `🎯 ${action.icon} ${action.name}`,
      type: 'action',
    });
  };

  const deleteAction = (actionId: string) => {
    updateUnit(unit.id, {
      quickActions: unit.quickActions.filter((a) => a.id !== actionId),
    });
    addNotification({ type: 'info', title: 'Удалено', message: 'Действие удалено' });
  };

  return (
    <div className="space-y-3 animate-[fadeSlideIn_300ms]">
      <Section title="Быстрые действия" icon="🎯">
        {unit.quickActions.length === 0 ? (
          <p className="text-xs text-[#7a6f62] italic">Нет действий. Создайте новое!</p>
        ) : (
          <div className="space-y-1.5">
            {unit.quickActions.map((action) => (
              <div key={action.id} className="flex items-center gap-2">
                <button
                  onClick={() => executeAction(action)}
                  className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-[#161412] rounded-lg border border-[#3a332a] hover:border-[#7a6f62] transition-all text-left cursor-pointer"
                >
                  <span className="text-lg">{action.icon}</span>
                  <div>
                    <div className="text-sm font-medium text-[#d4c8b8]">{action.name}</div>
                    {action.description && <div className="text-[10px] text-[#7a6f62]">{action.description}</div>}
                    <div className="text-[10px] text-[#4a433a]">{action.steps.length} шаг(ов)</div>
                  </div>
                </button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setEditingAction(action); setShowCreator(true); }}
                >✏️</Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteAction(action.id)}
                >🗑️</Button>
              </div>
            ))}
          </div>
        )}

        <Button variant="gold" className="w-full mt-2" onClick={() => { setEditingAction(null); setShowCreator(true); }}>
          + Создать действие
        </Button>
      </Section>

      {actionResults.length > 0 && <DiceResultDisplay title="Результат действия" results={actionResults} />}

      {showCreator && (
        <ActionCreatorModal
          action={editingAction}
          onSave={(action) => {
            if (editingAction) {
              updateUnit(unit.id, {
                quickActions: unit.quickActions.map((a) => (a.id === editingAction.id ? action : a)),
              });
            } else {
              updateUnit(unit.id, {
                quickActions: [...unit.quickActions, action],
              });
            }
            setShowCreator(false);
            addNotification({ type: 'success', title: 'Сохранено', message: `Действие "${action.name}" сохранено` });
          }}
          onClose={() => setShowCreator(false)}
        />
      )}
    </div>
  );
}

function ActionCreatorModal({ action, onSave, onClose }: {
  action: QuickAction | null;
  onSave: (action: QuickAction) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(action?.name || '');
  const [icon, setIcon] = useState(action?.icon || '🔍');
  const [description, setDescription] = useState(action?.description || '');
  const [steps, setSteps] = useState<ActionStep[]>(action?.steps || []);

  const addStep = () => {
    const newStep: ActionStep = {
      id: crypto.randomUUID(),
      order: steps.length + 1,
      roll: { dice: 'd20', bonuses: [{ type: 'stat', stat: 'intelligence', multiplier: 1 }] },
      threshold: 11,
      onSuccess: { type: 'success', message: 'Успех!' },
      onFailure: { type: 'failure', message: 'Провал!' },
    };
    setSteps([...steps, newStep]);
  };

  const updateStep = (stepId: string, updates: Partial<ActionStep>) => {
    setSteps(steps.map((s) => (s.id === stepId ? { ...s, ...updates } : s)));
  };

  const removeStep = (stepId: string) => {
    setSteps(steps.filter((s) => s.id !== stepId));
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: action?.id || crypto.randomUUID(),
      name: name.trim(),
      icon,
      description: description.trim() || undefined,
      steps,
    });
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={action ? 'Редактировать действие' : 'Создать действие'} maxWidth="max-w-lg">
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="w-16">
            <Input label="Иконка" value={icon} onChange={(e) => setIcon(e.target.value)} />
          </div>
          <div className="flex-1">
            <Input label="Название" value={name} onChange={(e) => setName(e.target.value)} placeholder="Осмотр" />
          </div>
        </div>

        <Input label="Описание" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Необязательно" />

        <div className="space-y-2">
          <h4 className="text-[11px] uppercase tracking-wider text-[#d4a726] font-bold">Шаги</h4>
          {steps.map((step, idx) => (
            <StepEditor
              key={step.id}
              step={step}
              index={idx}
              onUpdate={(u) => updateStep(step.id, u)}
              onRemove={() => removeStep(step.id)}
            />
          ))}
          <Button variant="secondary" size="sm" className="w-full" onClick={addStep}>
            + Добавить шаг
          </Button>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="gold" className="flex-1" onClick={handleSave} disabled={!name.trim()}>
            Сохранить
          </Button>
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
        </div>
      </div>
    </Modal>
  );
}

function StepEditor({ step, index, onUpdate, onRemove }: {
  step: ActionStep; index: number;
  onUpdate: (u: Partial<ActionStep>) => void; onRemove: () => void;
}) {
  const bonusTypeOptions = [
    { value: 'stat', label: 'Характеристика' },
    { value: 'proficiency', label: 'Владение' },
    { value: 'flat', label: 'Число' },
  ];

  const statOptions = Object.entries(STAT_NAMES).map(([k, v]) => ({ value: k, label: v }));
  const profOptions = Object.entries(PROFICIENCY_NAMES).map(([k, v]) => ({ value: k, label: v }));

  const outcomeTypes = [
    { value: 'success', label: 'Успех' },
    { value: 'failure', label: 'Провал' },
    { value: 'next_step', label: 'Следующий шаг' },
    { value: 'damage', label: 'Урон' },
    { value: 'heal', label: 'Лечение' },
  ];

  const updateBonus = (idx: number, updates: Partial<ActionBonus>) => {
    const newBonuses = [...step.roll.bonuses];
    newBonuses[idx] = { ...newBonuses[idx], ...updates };
    onUpdate({ roll: { ...step.roll, bonuses: newBonuses } });
  };

  const bonus = step.roll.bonuses[0] || { type: 'stat' as const, stat: 'intelligence' as StatName, multiplier: 1 };

  return (
    <div className="bg-[#161412] rounded-lg p-3 border border-[#3a332a] space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[#d4c8b8]">Шаг {index + 1}</span>
        <button onClick={onRemove} className="text-[#7a6f62] hover:text-[#d09090] text-sm cursor-pointer">🗑️</button>
      </div>

      <div className="flex gap-2 items-end">
        <Select
          label="Бонус"
          value={bonus.type}
          onChange={(e) => updateBonus(0, { type: e.target.value as 'stat' | 'proficiency' | 'flat' })}
          options={bonusTypeOptions}
        />
        {bonus.type === 'stat' && (
          <Select
            label="Стат"
            value={bonus.stat || 'intelligence'}
            onChange={(e) => updateBonus(0, { stat: e.target.value as StatName })}
            options={statOptions}
          />
        )}
        {bonus.type === 'proficiency' && (
          <Select
            label="Владение"
            value={bonus.proficiency || 'swords'}
            onChange={(e) => updateBonus(0, { proficiency: e.target.value as ProficiencyType })}
            options={profOptions}
          />
        )}
        {bonus.type === 'flat' && (
          <NumberStepper label="Значение" value={bonus.value || 0} onChange={(v) => updateBonus(0, { value: v })} min={-50} max={50} />
        )}
      </div>

      <NumberStepper label="Порог успеха" value={step.threshold} onChange={(v) => onUpdate({ threshold: v })} min={1} max={20} />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Select
            label="При успехе"
            value={step.onSuccess.type}
            onChange={(e) => onUpdate({ onSuccess: { ...step.onSuccess, type: e.target.value as ActionOutcome['type'] } })}
            options={outcomeTypes}
          />
          <input
            className="w-full h-8 px-2 mt-1 bg-[#0c0a09] text-[#b8a892] text-[11px] rounded border border-[#3a332a] focus:outline-none focus:border-[#d4a726]"
            placeholder="Сообщение..."
            value={step.onSuccess.message || ''}
            onChange={(e) => onUpdate({ onSuccess: { ...step.onSuccess, message: e.target.value } })}
          />
        </div>
        <div>
          <Select
            label="При провале"
            value={step.onFailure.type}
            onChange={(e) => onUpdate({ onFailure: { ...step.onFailure, type: e.target.value as ActionOutcome['type'] } })}
            options={outcomeTypes}
          />
          <input
            className="w-full h-8 px-2 mt-1 bg-[#0c0a09] text-[#b8a892] text-[11px] rounded border border-[#3a332a] focus:outline-none focus:border-[#d4a726]"
            placeholder="Сообщение..."
            value={step.onFailure.message || ''}
            onChange={(e) => onUpdate({ onFailure: { ...step.onFailure, message: e.target.value } })}
          />
        </div>
      </div>
    </div>
  );
}
