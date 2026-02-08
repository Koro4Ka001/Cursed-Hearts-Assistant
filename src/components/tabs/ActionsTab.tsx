import { useState } from 'react';
import { useGameStore } from '@/stores/useGameStore';
import { Button, Section, Input, Select, NumberStepper, DiceResultDisplay, Modal } from '@/components/ui';
import { diceService } from '@/services/diceService';
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
  const logToDocs = useGameStore((s) => s.logToDocs);

  const [actionResults, setActionResults] = useState<StepResult[]>([]);
  const [showCreator, setShowCreator] = useState(false);
  const [editingAction, setEditingAction] = useState<QuickAction | null>(null);
  const [isRolling, setIsRolling] = useState(false);

  if (!unit) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <span className="text-3xl mb-2">🎯</span>
        <p className="text-[12px] text-[#7a6f62]">Выберите или создайте юнита в ⚙️</p>
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

  const executeAction = async (action: QuickAction) => {
    if (action.steps.length === 0) return;

    setIsRolling(true);
    const results: StepResult[] = [];

    const processStep = async (step: ActionStep, stepNum: number) => {
      const bonus = calculateBonus(step.roll.bonuses);
      const roll = await diceService.roll(`d20+${bonus}`, `${action.icon} ${action.name} — Шаг ${stepNum}`);
      const rawD20 = roll.rolls[0] || 0;
      const success = roll.isCrit || (!roll.isCritFail && roll.total > step.threshold);

      results.push({
        label: `Шаг ${stepNum}`,
        roll: rawD20, bonus, total: roll.total,
        success, isCrit: roll.isCrit, isCritFail: roll.isCritFail,
        details: `порог ${step.threshold}`,
      });

      const outcome = success ? step.onSuccess : step.onFailure;

      if (outcome.message) {
        results.push({
          label: success ? '✓' : '✕',
          roll: 0, bonus: 0, total: 0,
          details: outcome.message,
        });
      }

      if (outcome.type === 'next_step' && outcome.nextStepId) {
        const nextStep = action.steps.find((s) => s.id === outcome.nextStepId);
        if (nextStep) await processStep(nextStep, stepNum + 1);
      }
    };

    await processStep(action.steps[0], 1);
    setActionResults(results);
    setIsRolling(false);

    const msg = `🎯 ${action.icon} ${action.name}`;
    addLog({ unitName: unit.shortName, message: msg, type: 'action' });
    logToDocs(msg);
  };

  const deleteAction = (actionId: string) => {
    updateUnit(unit.id, {
      quickActions: unit.quickActions.filter((a) => a.id !== actionId),
    });
    addNotification({ type: 'info', title: 'Удалено', message: 'Действие удалено' });
  };

  return (
    <div className="space-y-2 animate-[fadeSlideIn_200ms]">
      <Section title="Быстрые действия" icon="🎯">
        {unit.quickActions.length === 0 ? (
          <p className="text-[11px] text-[#7a6f62] italic">Нет действий. Создайте!</p>
        ) : (
          <div className="space-y-1">
            {unit.quickActions.map((action) => (
              <div key={action.id} className="flex items-center gap-1">
                <button
                  onClick={() => executeAction(action)}
                  disabled={isRolling}
                  className="flex-1 flex items-center gap-2 px-2.5 py-2 bg-[#161412] rounded-lg border border-[#3a332a] hover:border-[#7a6f62] transition-all text-left cursor-pointer disabled:opacity-50"
                >
                  <span className="text-base">{action.icon}</span>
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium text-[#d4c8b8] truncate">{action.name}</div>
                    <div className="text-[9px] text-[#7a6f62]">{action.steps.length} шаг(ов)</div>
                  </div>
                </button>
                <button onClick={() => { setEditingAction(action); setShowCreator(true); }}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#1a1816] text-[#7a6f62] cursor-pointer text-xs">✏️</button>
                <button onClick={() => deleteAction(action.id)}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#1a1816] text-[#7a6f62] cursor-pointer text-xs">🗑️</button>
              </div>
            ))}
          </div>
        )}

        <Button variant="gold" size="sm" className="w-full mt-1.5" onClick={() => { setEditingAction(null); setShowCreator(true); }}>
          + Создать действие
        </Button>
      </Section>

      {actionResults.length > 0 && <DiceResultDisplay title="Результат" results={actionResults} />}

      {showCreator && (
        <ActionCreatorModal
          action={editingAction}
          onSave={(action) => {
            if (editingAction) {
              updateUnit(unit.id, { quickActions: unit.quickActions.map((a) => (a.id === editingAction.id ? action : a)) });
            } else {
              updateUnit(unit.id, { quickActions: [...unit.quickActions, action] });
            }
            setShowCreator(false);
            addNotification({ type: 'success', title: 'Сохранено', message: action.name });
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
    setSteps([...steps, {
      id: crypto.randomUUID(),
      order: steps.length + 1,
      roll: { dice: 'd20', bonuses: [{ type: 'stat', stat: 'intelligence', multiplier: 1 }] },
      threshold: 11,
      onSuccess: { type: 'success', message: 'Успех!' },
      onFailure: { type: 'failure', message: 'Провал!' },
    }]);
  };

  const updateStep = (stepId: string, updates: Partial<ActionStep>) => {
    setSteps(steps.map((s) => (s.id === stepId ? { ...s, ...updates } : s)));
  };

  const removeStep = (stepId: string) => {
    setSteps(steps.filter((s) => s.id !== stepId));
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={action ? 'Редактировать' : 'Создать действие'} maxWidth="max-w-lg">
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="w-14"><Input label="Иконка" value={icon} onChange={(e) => setIcon(e.target.value)} /></div>
          <div className="flex-1"><Input label="Название" value={name} onChange={(e) => setName(e.target.value)} placeholder="Осмотр" /></div>
        </div>
        <Input label="Описание" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Необязательно" />

        <div className="space-y-1.5">
          <h4 className="text-[10px] uppercase tracking-wider text-[#d4a726] font-bold">Шаги</h4>
          {steps.map((step, idx) => (
            <StepEditor key={step.id} step={step} index={idx} allSteps={steps}
              onUpdate={(u) => updateStep(step.id, u)} onRemove={() => removeStep(step.id)} />
          ))}
          <Button variant="secondary" size="sm" className="w-full" onClick={addStep}>+ Шаг</Button>
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="gold" className="flex-1" onClick={() => {
            if (!name.trim()) return;
            onSave({ id: action?.id || crypto.randomUUID(), name: name.trim(), icon, description: description.trim() || undefined, steps });
          }} disabled={!name.trim()}>Сохранить</Button>
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
        </div>
      </div>
    </Modal>
  );
}

function StepEditor({ step, index, allSteps, onUpdate, onRemove }: {
  step: ActionStep; index: number; allSteps: ActionStep[];
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
    { value: 'next_step', label: 'След. шаг' },
    { value: 'damage', label: 'Урон' },
    { value: 'heal', label: 'Лечение' },
  ];

  const bonus = step.roll.bonuses[0] || { type: 'stat' as const, stat: 'intelligence' as StatName, multiplier: 1 };

  const updateBonus = (updates: Partial<ActionBonus>) => {
    const newBonuses = [...step.roll.bonuses];
    newBonuses[0] = { ...newBonuses[0], ...updates };
    onUpdate({ roll: { ...step.roll, bonuses: newBonuses } });
  };

  const nextStepOptions = allSteps.filter(s => s.id !== step.id).map((s, i) => ({ value: s.id, label: `Шаг ${i + 1}` }));

  return (
    <div className="bg-[#161412] rounded-lg p-2 border border-[#3a332a] space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-[#d4c8b8]">Шаг {index + 1}</span>
        <button onClick={onRemove} className="text-[#7a6f62] hover:text-[#d09090] text-xs cursor-pointer">🗑️</button>
      </div>

      <div className="flex gap-1.5 items-end">
        <Select label="Бонус" value={bonus.type}
          onChange={(e) => updateBonus({ type: e.target.value as 'stat' | 'proficiency' | 'flat' })}
          options={bonusTypeOptions} />
        {bonus.type === 'stat' && (
          <Select label="Стат" value={bonus.stat || 'intelligence'}
            onChange={(e) => updateBonus({ stat: e.target.value as StatName })}
            options={statOptions} />
        )}
        {bonus.type === 'proficiency' && (
          <Select label="Влад." value={bonus.proficiency || 'swords'}
            onChange={(e) => updateBonus({ proficiency: e.target.value as ProficiencyType })}
            options={profOptions} />
        )}
        {bonus.type === 'flat' && (
          <NumberStepper label="Знач." value={bonus.value || 0} onChange={(v) => updateBonus({ value: v })} min={-50} max={50} />
        )}
      </div>

      <NumberStepper label="Порог" value={step.threshold} onChange={(v) => onUpdate({ threshold: v })} min={1} max={20} />

      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <Select label="Успех" value={step.onSuccess.type}
            onChange={(e) => onUpdate({ onSuccess: { ...step.onSuccess, type: e.target.value as ActionOutcome['type'] } })}
            options={outcomeTypes} />
          {step.onSuccess.type === 'next_step' && nextStepOptions.length > 0 && (
            <Select value={step.onSuccess.nextStepId || ''} onChange={(e) => onUpdate({ onSuccess: { ...step.onSuccess, nextStepId: e.target.value } })}
              options={[{ value: '', label: '—' }, ...nextStepOptions]} />
          )}
          <input className="w-full h-7 px-2 mt-0.5 bg-[#0c0a09] text-[#b8a892] text-[10px] rounded border border-[#3a332a] focus:outline-none focus:border-[#d4a726]"
            placeholder="Сообщение..." value={step.onSuccess.message || ''}
            onChange={(e) => onUpdate({ onSuccess: { ...step.onSuccess, message: e.target.value } })} />
        </div>
        <div>
          <Select label="Провал" value={step.onFailure.type}
            onChange={(e) => onUpdate({ onFailure: { ...step.onFailure, type: e.target.value as ActionOutcome['type'] } })}
            options={outcomeTypes} />
          {step.onFailure.type === 'next_step' && nextStepOptions.length > 0 && (
            <Select value={step.onFailure.nextStepId || ''} onChange={(e) => onUpdate({ onFailure: { ...step.onFailure, nextStepId: e.target.value } })}
              options={[{ value: '', label: '—' }, ...nextStepOptions]} />
          )}
          <input className="w-full h-7 px-2 mt-0.5 bg-[#0c0a09] text-[#b8a892] text-[10px] rounded border border-[#3a332a] focus:outline-none focus:border-[#d4a726]"
            placeholder="Сообщение..." value={step.onFailure.message || ''}
            onChange={(e) => onUpdate({ onFailure: { ...step.onFailure, message: e.target.value } })} />
        </div>
      </div>
    </div>
  );
}
