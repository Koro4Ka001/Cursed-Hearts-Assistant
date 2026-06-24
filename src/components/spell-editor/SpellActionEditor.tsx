// src/components/spell-editor/SpellActionEditor.tsx

import { useState } from 'react';
import { 
  Button, Input, Select, NumberStepper, Checkbox, Section 
} from '../ui';
import { cn } from '../../utils/cn';
import type { 
  SpellAction, 
  SpellActionType, 
  StepTransition,
  TableResultEntry,
  DamageTierEntry,
  RollBonus,
  DamageType
} from '../../types';
import { 
  SPELL_ACTION_TYPE_META, 
  ALL_DAMAGE_TYPES, 
  DAMAGE_TYPE_NAMES,
  STAT_NAMES
} from '../../types';
import { 
  SPELL_ACTION_TYPES,
  TRANSITION_CONDITIONS,
  STAT_BONUS_OPTIONS,
  COMMON_DICE_FORMULAS,
  generateId,
  createEmptyTableEntry,
  createEmptyDamageTier,
  createEmptyTransition
} from '../../constants/spellActions';
import { GAME_ELEMENTS } from '../../constants/elements';

// ═══════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════════════════════════

interface SpellActionEditorProps {
  action: SpellAction;
  allActions: SpellAction[];
  onChange: (action: SpellAction) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// КОМПОНЕНТ
// ═══════════════════════════════════════════════════════════════════════════

export function SpellActionEditor({
  action,
  allActions,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast
}: SpellActionEditorProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  const meta = SPELL_ACTION_TYPE_META[action.type];
  
  const update = (updates: Partial<SpellAction>) => {
    onChange({ ...action, ...updates });
  };
  
  const targetOptions = [
    { value: 'next', label: '→ Следующий шаг' },
    { value: 'stop', label: '🛑 Остановить' },
    ...allActions
      .filter(a => a.id !== action.id)
      .map(a => ({ value: a.id, label: `↪ ${a.label}` }))
  ];
  
  return (
    <div className={cn(
      'border rounded-lg overflow-hidden transition-all',
      'border-edge-bone bg-obsidian/50',
      isExpanded ? 'shadow-lg' : ''
    )}>
      {/* Заголовок */}
      <div 
        className={cn(
          'flex items-center gap-2 p-2 cursor-pointer',
          'bg-gradient-to-r from-obsidian to-transparent',
          'hover:from-gold/10'
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="text-lg">{meta.icon}</span>
        <span className={cn('font-cinzel text-sm', meta.color)}>
          {action.order + 1}. {action.label}
        </span>
        <span className="text-xs text-faded ml-auto">{meta.name}</span>
        <span className={cn(
          'text-faded transition-transform',
          isExpanded ? 'rotate-180' : ''
        )}>
          ▾
        </span>
      </div>
      
      {/* Содержимое */}
      {isExpanded && (
        <div className="p-3 space-y-3 border-t border-edge-bone">
          {/* Базовые поля */}
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Название шага"
              value={action.label}
              onChange={(e) => update({ label: e.target.value })}
              placeholder="Каст"
            />
            <Select
              label="Тип"
              value={action.type}
              onChange={(e) => {
                const newType = e.target.value as SpellActionType;
                const newAction: SpellAction = {
                  id: action.id,
                  type: newType,
                  label: action.label,
                  order: action.order,
                };
                onChange(newAction);
              }}
              options={SPELL_ACTION_TYPES.map(t => ({
                value: t.value,
                label: `${t.icon} ${t.label}`
              }))}
            />
          </div>
          
          {/* Специфичные поля в зависимости от типа */}
          {renderTypeSpecificFields(action, update, allActions)}
          
          {/* Переходы (для типов с бросками) */}
          {['roll_check', 'roll_attack', 'roll_cast', 'roll_dice', 'roll_table', 'roll_damage', 'damage_tiers'].includes(action.type) && (
            <TransitionsEditor
              transitions={action.transitions ?? []}
              onChange={(transitions) => update({ transitions })}
              targetOptions={targetOptions}
            />
          )}
          
          {/* Кнопки управления */}
          <div className="flex items-center gap-2 pt-2 border-t border-edge-bone">
            <Button
              variant="secondary"
              size="sm"
              onClick={onMoveUp}
              disabled={isFirst}
              title="Вверх"
            >
              ↑
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onMoveDown}
              disabled={isLast}
              title="Вниз"
            >
              ↓
            </Button>
            <div className="flex-1" />
            <Button
              variant="danger"
              size="sm"
              onClick={onDelete}
            >
              🗑️ Удалить
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// РЕНДЕР ПОЛЕЙ ПО ТИПУ
// ═══════════════════════════════════════════════════════════════════════════

function renderTypeSpecificFields(
  action: SpellAction, 
  update: (u: Partial<SpellAction>) => void,
  allActions: SpellAction[]
) {
  switch (action.type) {
    case 'roll_attack': // Новое
    case 'roll_cast':   // Новое
    case 'roll_check':
      return <RollCheckFields action={action} update={update} />;
    case 'roll_dice':
      return <RollDiceFields action={action} update={update} />;
    case 'roll_table':
      return <RollTableFields action={action} update={update} />;
    case 'roll_damage':
      return <RollDamageFields action={action} update={update} />;
    case 'damage_tiers':
      return <DamageTiersFields action={action} update={update} />;
    case 'set_value':
      return <SetValueFields action={action} update={update} />;
    case 'message':
      return <MessageFields action={action} update={update} />;
    case 'branch':
      return <BranchFields action={action} update={update} allActions={allActions} />;
    case 'goto':
      return <GotoFields action={action} update={update} allActions={allActions} />;
    case 'modify_resource':
      return <ModifyResourceFields action={action} update={update} />;
    default:
      return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ПОЛЯ: roll_check
// ═══════════════════════════════════════════════════════════════════════════

function RollCheckFields({ action, update }: { action: SpellAction; update: (u: Partial<SpellAction>) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Select
          label="Кубик"
          value={action.diceFormula ?? 'd20'}
          onChange={(e) => update({ diceFormula: e.target.value })}
          options={[
            { value: 'd20', label: 'd20' },
            { value: 'd12', label: 'd12' },
            { value: 'd10', label: 'd10' },
          ]}
        />
        <NumberStepper
          label="Порог успеха"
          value={action.successThreshold ?? 10}
          onChange={(v) => update({ successThreshold: v })}
          min={1}
          max={30}
        />
      </div>
      
      <BonusesEditor
        bonuses={action.bonuses ?? []}
        onChange={(bonuses) => update({ bonuses })}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ПОЛЯ: roll_dice
// ═══════════════════════════════════════════════════════════════════════════

function RollDiceFields({ action, update }: { action: SpellAction; update: (u: Partial<SpellAction>) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="font-cinzel text-[10px] text-faded uppercase tracking-widest">
          Формула
        </label>
        <div className="flex gap-1 mt-1">
          <Input
            value={action.diceFormula ?? 'd12'}
            onChange={(e) => update({ diceFormula: e.target.value })}
            placeholder="d12"
            className="flex-1"
          />
          <Select
            value=""
            onChange={(e) => {
              if (e.target.value) update({ diceFormula: e.target.value });
            }}
            options={[
              { value: '', label: '...' },
              ...COMMON_DICE_FORMULAS.map(f => ({ value: f, label: f }))
            ]}
            className="w-20"
          />
        </div>
      </div>
      <Input
        label="Сохранить как"
        value={action.saveResultAs ?? ''}
        onChange={(e) => update({ saveResultAs: e.target.value })}
        placeholder="lastRoll"
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ПОЛЯ: roll_table
// ═══════════════════════════════════════════════════════════════════════════

function RollTableFields({ action, update }: { action: SpellAction; update: (u: Partial<SpellAction>) => void }) {
  const table = action.resultTable ?? [];
  
  const addEntry = () => {
    const lastMax = table.length > 0 ? (table[table.length - 1]?.max ?? 0) : 0;
    update({
      resultTable: [...table, createEmptyTableEntry(lastMax + 1, lastMax + 2)]
    });
  };
  
  const updateEntry = (index: number, updates: Partial<TableResultEntry>) => {
    const newTable = [...table];
    newTable[index] = { ...newTable[index]!, ...updates };
    update({ resultTable: newTable });
  };
  
  const deleteEntry = (index: number) => {
    update({ resultTable: table.filter((_, i) => i !== index) });
  };
  
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Select
          label="Кубик"
          value={action.diceFormula ?? 'd12'}
          onChange={(e) => update({ diceFormula: e.target.value })}
          options={COMMON_DICE_FORMULAS.slice(0, 6).map(f => ({ value: f, label: f }))}
        />
        <Input
          label="Сохранить как"
          value={action.saveResultAs ?? ''}
          onChange={(e) => update({ saveResultAs: e.target.value })}
          placeholder="element"
        />
      </div>
      
      <div className="space-y-1">
        <div className="text-xs text-faded uppercase">Таблица результатов:</div>
        {table.map((entry, idx) => (
          <div key={entry.id} className="flex items-center gap-1 flex-wrap">
            <input
              type="number"
              value={entry.min}
              onChange={(e) => updateEntry(idx, { min: parseInt(e.target.value) || 1 })}
              className="w-10 bg-dark border border-edge-bone text-bone rounded px-1 py-0.5 text-xs text-center"
            />
            <span className="text-faded">—</span>
            <input
              type="number"
              value={entry.max}
              onChange={(e) => updateEntry(idx, { max: parseInt(e.target.value) || 1 })}
              className="w-10 bg-dark border border-edge-bone text-bone rounded px-1 py-0.5 text-xs text-center"
            />
            <span className="text-faded">→</span>
            <input
              type="text"
              value={entry.resultValue}
              onChange={(e) => updateEntry(idx, { resultValue: e.target.value })}
              className="w-20 bg-dark border border-edge-bone text-bone rounded px-1 py-0.5 text-xs"
              placeholder="fire"
            />
            <input
              type="text"
              value={entry.resultLabel ?? ''}
              onChange={(e) => updateEntry(idx, { resultLabel: e.target.value })}
              className="flex-1 min-w-[60px] bg-dark border border-edge-bone text-bone rounded px-1 py-0.5 text-xs"
              placeholder="Огонь"
            />
            <Button variant="danger" size="sm" onClick={() => deleteEntry(idx)}>×</Button>
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={addEntry} className="w-full">
          + Добавить строку
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ПОЛЯ: roll_damage
// ═══════════════════════════════════════════════════════════════════════════

function RollDamageFields({ action, update }: { action: SpellAction; update: (u: Partial<SpellAction>) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="font-cinzel text-[10px] text-faded uppercase tracking-widest">
            Формула урона
          </label>
          <div className="flex gap-1 mt-1">
            <Input
              value={action.damageFormula ?? '2d6'}
              onChange={(e) => update({ damageFormula: e.target.value })}
              className="flex-1"
            />
            <Select
              value=""
              onChange={(e) => {
                if (e.target.value) update({ damageFormula: e.target.value });
              }}
              options={[
                { value: '', label: '...' },
                ...COMMON_DICE_FORMULAS.map(f => ({ value: f, label: f }))
              ]}
              className="w-20"
            />
          </div>
        </div>
        <Select
          label="Тип урона"
          value={action.damageType === 'from_context' ? 'from_context' : (action.damageType ?? 'fire')}
          onChange={(e) => update({ 
            damageType: e.target.value as DamageType | 'from_context' 
          })}
          options={[
            { value: 'from_context', label: '📋 Из контекста' },
            // 🔥 ЕДИНЫЙ СПИСОК ЭЛЕМЕНТОВ
            ...GAME_ELEMENTS.map(e => ({ value: e.id, label: `${e.icon} ${e.name}` }))
          ]}
        />
      </div>
      
      {action.damageType === 'from_context' && (
        <Input
          label="Ключ контекста для типа"
          value={action.damageTypeContextKey ?? ''}
          onChange={(e) => update({ damageTypeContextKey: e.target.value })}
          placeholder="element"
        />
      )}
      
      <div className="grid grid-cols-2 gap-2">
        <NumberStepper
          label="Множитель крита"
          value={action.critMultiplier ?? 2}
          onChange={(v) => update({ critMultiplier: v })}
          min={1}
          max={5}
        />
        <div className="flex flex-col gap-1 pb-1">
          <Checkbox
            checked={action.addDamageBonus ?? false}
            onChange={(v) => update({ addDamageBonus: v })}
            label="+ бонус от элементов"
          />
          {/* 🔥 ГАЛОЧКА ЧИСТОГО УРОНА */}
          <Checkbox
            checked={action.forcePureOnCrit ?? false}
            onChange={(v) => update({ forcePureOnCrit: v })}
            label="✨ Чистый при Крите"
          />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ПОЛЯ: damage_tiers
// ═══════════════════════════════════════════════════════════════════════════

function DamageTiersFields({ action, update }: { action: SpellAction; update: (u: Partial<SpellAction>) => void }) {
  const tiers = action.damageTiers ?? [];
  
  const addTier = () => {
    const lastMax = tiers.length > 0 ? (tiers[tiers.length - 1]?.maxRoll ?? 0) : 0;
    update({
      damageTiers: [...tiers, createEmptyDamageTier(lastMax + 1, lastMax + 5)]
    });
  };
  
  const updateTier = (index: number, updates: Partial<DamageTierEntry>) => {
    const newTiers = [...tiers];
    newTiers[index] = { ...newTiers[index]!, ...updates };
    update({ damageTiers: newTiers });
  };
  
  const deleteTier = (index: number) => {
    update({ damageTiers: tiers.filter((_, i) => i !== index) });
  };
  
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Select
          label="Кубик для tier"
          value={action.diceFormula ?? 'd20'}
          onChange={(e) => update({ diceFormula: e.target.value })}
          options={[
            { value: 'd20', label: 'd20' },
            { value: 'd12', label: 'd12' },
            { value: 'd10', label: 'd10' },
          ]}
        />
        <Select
          label="Тип урона"
          value={action.damageType === 'from_context' ? 'from_context' : (action.damageType ?? 'fire')}
          onChange={(e) => update({ 
            damageType: e.target.value as DamageType | 'from_context' 
          })}
          options={[
            { value: 'from_context', label: '📋 Из контекста' },
            // 🔥 ЕДИНЫЙ СПИСОК ЭЛЕМЕНТОВ
            ...GAME_ELEMENTS.map(e => ({ value: e.id, label: `${e.icon} ${e.name}` }))
          ]}
        />
      </div>
      
      {action.damageType === 'from_context' && (
        <Input
          label="Ключ контекста для типа"
          value={action.damageTypeContextKey ?? ''}
          onChange={(e) => update({ damageTypeContextKey: e.target.value })}
          placeholder="element"
        />
      )}
      
      {/* 🔥 ГАЛОЧКА ЧИСТОГО УРОНА */}
      <div className="flex justify-end">
         <Checkbox
            checked={action.forcePureOnCrit ?? false}
            onChange={(v) => update({ forcePureOnCrit: v })}
            label="✨ Чистый урон при Крите (игнор брони)"
          />
      </div>
      
      <div className="space-y-1">
        <div className="text-xs text-faded uppercase">Tier'ы урона:</div>
        {tiers.map((tier, idx) => (
          <div key={tier.id} className="flex items-center gap-1 flex-wrap">
            <input
              type="number"
              value={tier.minRoll}
              onChange={(e) => updateTier(idx, { minRoll: parseInt(e.target.value) || 1 })}
              className="w-10 bg-dark border border-edge-bone text-bone rounded px-1 py-0.5 text-xs text-center"
            />
            <span className="text-faded">—</span>
            <input
              type="number"
              value={tier.maxRoll}
              onChange={(e) => updateTier(idx, { maxRoll: parseInt(e.target.value) || 20 })}
              className="w-10 bg-dark border border-edge-bone text-bone rounded px-1 py-0.5 text-xs text-center"
            />
            <span className="text-faded">→</span>
            <input
              type="text"
              value={tier.formula}
              onChange={(e) => updateTier(idx, { formula: e.target.value })}
              className="w-24 bg-dark border border-edge-bone text-bone rounded px-1 py-0.5 text-xs"
              placeholder="2d6"
            />
            <input
              type="text"
              value={tier.label ?? ''}
              onChange={(e) => updateTier(idx, { label: e.target.value })}
              className="flex-1 min-w-[60px] bg-dark border border-edge-bone text-bone rounded px-1 py-0.5 text-xs"
              placeholder="Средний"
            />
            <Button variant="danger" size="sm" onClick={() => deleteTier(idx)}>×</Button>
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={addTier} className="w-full">
          + Добавить tier
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ПОЛЯ: set_value
// ═══════════════════════════════════════════════════════════════════════════

function SetValueFields({ action, update }: { action: SpellAction; update: (u: Partial<SpellAction>) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Input
        label="Ключ"
        value={action.setKey ?? ''}
        onChange={(e) => update({ setKey: e.target.value })}
        placeholder="myVar"
      />
      <Input
        label="Значение"
        value={String(action.setValue ?? '')}
        onChange={(e) => update({ setValue: e.target.value })}
        placeholder="100"
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ПОЛЯ: message
// ═══════════════════════════════════════════════════════════════════════════

function MessageFields({ action, update }: { action: SpellAction; update: (u: Partial<SpellAction>) => void }) {
  return (
    <div className="space-y-2">
      <Input
        label="Шаблон сообщения"
        value={action.messageTemplate ?? ''}
        onChange={(e) => update({ messageTemplate: e.target.value })}
        placeholder="Элемент: {element}, урон: {damage}"
      />
      <div className="text-xs text-faded">
        Используйте {'{ключ}'} для подстановки значений из контекста
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ПОЛЯ: branch
// ═══════════════════════════════════════════════════════════════════════════

function BranchFields({ 
  action, 
  update, 
  allActions 
}: { 
  action: SpellAction; 
  update: (u: Partial<SpellAction>) => void;
  allActions: SpellAction[];
}) {
  const condition = action.branchCondition ?? { type: 'value_equals', key: '', value: '' };
  
  const targetOptions = [
    { value: 'next', label: '→ Следующий' },
    { value: 'stop', label: '🛑 Стоп' },
    ...allActions
      .filter(a => a.id !== action.id)
      .map(a => ({ value: a.id, label: `↪ ${a.label}` }))
  ];
  
  return (
    <div className="space-y-3">
      <div className="text-xs text-faded uppercase">Условие:</div>
      <div className="grid grid-cols-3 gap-2">
        <Input
          label="Ключ"
          value={condition.key ?? ''}
          onChange={(e) => update({ 
            branchCondition: { ...condition, key: e.target.value } 
          })}
          placeholder="element"
        />
        <Select
          label="Условие"
          value={condition.type}
          onChange={(e) => update({ 
            branchCondition: { ...condition, type: e.target.value as any } 
          })}
          options={[
            { value: 'value_equals', label: '=' },
            { value: 'value_gte', label: '≥' },
            { value: 'value_lte', label: '≤' },
            { value: 'value_exists', label: 'существует' },
          ]}
        />
        <Input
          label="Значение"
          value={String(condition.value ?? '')}
          onChange={(e) => update({ 
            branchCondition: { ...condition, value: e.target.value } 
          })}
          placeholder="fire"
        />
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        <Select
          label="Если ДА →"
          value={action.branchTrueStepId ?? 'next'}
          onChange={(e) => update({ branchTrueStepId: e.target.value })}
          options={targetOptions}
        />
        <Select
          label="Если НЕТ →"
          value={action.branchFalseStepId ?? 'stop'}
          onChange={(e) => update({ branchFalseStepId: e.target.value })}
          options={targetOptions}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ПОЛЯ: goto
// ═══════════════════════════════════════════════════════════════════════════

function GotoFields({ 
  action, 
  update, 
  allActions 
}: { 
  action: SpellAction; 
  update: (u: Partial<SpellAction>) => void;
  allActions: SpellAction[];
}) {
  const targetOptions = [
    { value: 'next', label: '→ Следующий' },
    { value: 'stop', label: '🛑 Стоп' },
    ...allActions
      .filter(a => a.id !== action.id)
      .map(a => ({ value: a.id, label: `↪ ${a.label}` }))
  ];
  
  return (
    <Select
      label="Перейти к"
      value={action.gotoStepId ?? 'next'}
      onChange={(e) => update({ gotoStepId: e.target.value })}
      options={targetOptions}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ПОЛЯ: modify_resource
// ═══════════════════════════════════════════════════════════════════════════

function ModifyResourceFields({ action, update }: { action: SpellAction; update: (u: Partial<SpellAction>) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Select
        label="Ресурс"
        value={action.resourceType ?? 'mana'}
        onChange={(e) => update({ resourceType: e.target.value as any })}
        options={[
          { value: 'mana', label: '💠 Мана' },
          { value: 'health', label: '❤️ HP' },
        ]}
      />
      <Select
        label="Операция"
        value={action.resourceOperation ?? 'spend'}
        onChange={(e) => update({ resourceOperation: e.target.value as any })}
        options={[
          { value: 'spend', label: '− Потратить' },
          { value: 'restore', label: '+ Восстановить' },
        ]}
      />
      <NumberStepper
        label="Количество"
        value={Number(action.resourceAmount) || 0}
        onChange={(v) => update({ resourceAmount: v })}
        min={0}
        max={999}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// РЕДАКТОР БОНУСОВ
// ═══════════════════════════════════════════════════════════════════════════

function BonusesEditor({
  bonuses,
  onChange
}: {
  bonuses: RollBonus[];
  onChange: (bonuses: RollBonus[]) => void;
}) {
  const addBonus = (type: RollBonus['type']) => {
    const newBonus: RollBonus = { type };
    if (type === 'stat') newBonus.statKey = 'intelligence';
    if (type === 'flat') newBonus.flatValue = 0;
    if (type === 'from_elements') newBonus.elementBonusType = 'cast';
    onChange([...bonuses, newBonus]);
  };
  
  const updateBonus = (index: number, updates: Partial<RollBonus>) => {
    const newBonuses = [...bonuses];
    newBonuses[index] = { ...newBonuses[index]!, ...updates };
    onChange(newBonuses);
  };
  
  const deleteBonus = (index: number) => {
    onChange(bonuses.filter((_, i) => i !== index));
  };
  
  return (
    <div className="space-y-2">
      <div className="text-xs text-faded uppercase">Бонусы к броску:</div>
      
      {bonuses.map((bonus, idx) => (
        <div key={idx} className="flex items-center gap-2 p-2 bg-dark/30 rounded">
          <Select
            value={bonus.type}
            onChange={(e) => updateBonus(idx, { type: e.target.value as RollBonus['type'] })}
            options={[
              { value: 'flat', label: 'Фиксированный' },
              { value: 'stat', label: 'От характеристики' },
              { value: 'from_elements', label: 'От элементов' },
            ]}
            className="w-36"
          />
          
          {bonus.type === 'flat' && (
            <NumberStepper
              value={bonus.flatValue ?? 0}
              onChange={(v) => updateBonus(idx, { flatValue: v })}
              min={-20}
              max={50}
            />
          )}
          
          {bonus.type === 'stat' && (
            <>
              <Select
                value={bonus.statKey ?? 'intelligence'}
                onChange={(e) => updateBonus(idx, { statKey: e.target.value })}
                options={STAT_BONUS_OPTIONS.map(s => ({ value: s.value, label: s.label }))}
                className="flex-1"
              />
              <span className="text-xs text-faded">
                ×{STAT_BONUS_OPTIONS.find(s => s.value === bonus.statKey)?.multiplier ?? 1}
              </span>
            </>
          )}
          
          {bonus.type === 'from_elements' && (
            <span className="text-xs text-ancient">+бонус от предрасп.</span>
          )}
          
          <Button variant="danger" size="sm" onClick={() => deleteBonus(idx)}>×</Button>
        </div>
      ))}
      
      <div className="flex gap-1">
        <Button variant="secondary" size="sm" onClick={() => addBonus('flat')}>
          + Число
        </Button>
        <Button variant="secondary" size="sm" onClick={() => addBonus('stat')}>
          + Стат
        </Button>
        <Button variant="secondary" size="sm" onClick={() => addBonus('from_elements')}>
          + Элементы
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// РЕДАКТОР ПЕРЕХОДОВ (ИСПРАВЛЕННЫЙ UI)
// ═══════════════════════════════════════════════════════════════════════════

function TransitionsEditor({
  transitions,
  onChange,
  targetOptions
}: {
  transitions: StepTransition[];
  onChange: (transitions: StepTransition[]) => void;
  targetOptions: { value: string; label: string }[];
}) {
  const addTransition = () => {
    onChange([...transitions, createEmptyTransition()]);
  };
  
  const updateTransition = (index: number, updates: Partial<StepTransition>) => {
    const newTransitions = [...transitions];
    newTransitions[index] = { ...newTransitions[index]!, ...updates };
    onChange(newTransitions);
  };
  
  const deleteTransition = (index: number) => {
    onChange(transitions.filter((_, i) => i !== index));
  };
  
  const condMeta = TRANSITION_CONDITIONS;
  
  // Сортируем локально для отображения
  const sortedTransitions = transitions.map((t, i) => ({ t, i })).sort((a, b) => a.t.priority - b.t.priority);
  
  return (
    <div className="space-y-3 border-t border-edge-bone pt-3 mt-2">
      <div className="flex justify-between items-center">
        <div className="text-xs text-faded uppercase font-bold tracking-wider">Логика переходов:</div>
        <div className="text-[10px] text-dim italic">0 = высший приоритет</div>
      </div>
      
      {sortedTransitions.map(({ t: trans, i: originalIndex }) => {
        const condInfo = condMeta.find(c => c.value === trans.condition);
        
        return (
          <div key={trans.id} className="p-2 bg-black/20 rounded border border-edge-bone/50 space-y-2">
            
            {/* Первая строка: Приоритет + Условие */}
            <div className="flex items-center gap-2">
              <div className="flex flex-col w-16 shrink-0">
                <span className="text-[9px] text-faded uppercase">Приор.</span>
                <input
                  type="number"
                  value={trans.priority}
                  onChange={(e) => updateTransition(originalIndex, { priority: parseInt(e.target.value) || 0 })}
                  className="bg-obsidian border border-edge-bone text-bone rounded px-2 py-1 text-xs text-center focus:border-gold outline-none w-full"
                />
              </div>
              
              <div className="flex-1">
                <span className="text-[9px] text-faded uppercase block mb-0.5">Если...</span>
                <Select
                  value={trans.condition}
                  onChange={(e) => updateTransition(originalIndex, { condition: e.target.value as any })}
                  options={condMeta.map(c => ({ value: c.value, label: `${c.icon} ${c.label}` }))}
                  className="w-full"
                />
              </div>
            </div>

            {/* Вторая строка: Параметры условия (если нужны) */}
            {(condInfo?.needsKey || condInfo?.needsValue) && (
              <div className="flex items-center gap-2 bg-black/20 p-1.5 rounded">
                {condInfo?.needsKey && (
                  <Input
                    value={trans.conditionKey ?? ''}
                    onChange={(e) => updateTransition(originalIndex, { conditionKey: e.target.value })}
                    placeholder="ключ"
                    className="flex-1"
                  />
                )}
                {condInfo?.needsKey && condInfo?.needsValue && <span className="text-faded">=</span>}
                {condInfo?.needsValue && (
                  <Input
                    value={String(trans.conditionValue ?? '')}
                    onChange={(e) => updateTransition(originalIndex, { conditionValue: e.target.value })}
                    placeholder="значение"
                    className="flex-1"
                  />
                )}
              </div>
            )}

            {/* Третья строка: Цель перехода */}
            <div className="flex items-center gap-2 pt-1 border-t border-edge-bone/30">
              <span className="text-xs text-gold font-bold">→</span>
              <Select
                value={trans.targetStepId}
                onChange={(e) => updateTransition(originalIndex, { targetStepId: e.target.value })}
                options={targetOptions}
                className="flex-1"
              />
              <Button variant="danger" size="sm" onClick={() => deleteTransition(originalIndex)} className="h-8 w-8 p-0 flex items-center justify-center">
                ×
              </Button>
            </div>
          </div>
        );
      })}
      
      <Button variant="secondary" size="sm" onClick={addTransition} className="w-full border-dashed border-edge-bone text-faded hover:text-gold hover:border-gold">
        + Добавить условие
      </Button>
    </div>
  );
}
