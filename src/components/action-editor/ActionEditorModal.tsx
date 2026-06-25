// src/components/action-editor/ActionEditorModal.tsx

import { useState, useEffect } from 'react';
import { Modal, Button, Input, Select, SubTabs } from '../ui';
import { SpellChainEditor } from '../spell-editor/SpellChainEditor';
import { cn } from '../../utils/cn';
import type { 
  CustomActionV2, 
  CustomAction, 
  ActionCost, 
  ActionCategory,
  Resource,
  RollModifier
} from '../../types';
import { 
  isCustomActionV2, 
  createEmptyCustomActionV2,
  ACTION_CATEGORY_NAMES,
  ACTION_CATEGORY_ICONS
} from '../../types';
import { generateId } from '../../constants/spellActions';

// ═══════════════════════════════════════════════════════════════════════════
// МИГРАЦИЯ СТАРОГО ДЕЙСТВИЯ В V2
// ═══════════════════════════════════════════════════════════════════════════

function migrateActionToV2(action: CustomAction): CustomActionV2 {
  const v2: CustomActionV2 = {
    id: action.id,
    name: action.name,
    version: 2,
    icon: action.icon || '⚡',
    category: 'check',
    description: '',
    costs: [],
    defaultRollModifier: 'normal',
    actions: [],
  };
  
  // Конвертируем старые шаги в SpellAction
  for (let i = 0; i < (action.steps?.length ?? 0); i++) {
    const step = action.steps![i]!;
    
    // Собираем бонусы
    const bonuses: any[] = [];
    for (const bonus of (step.roll?.bonuses ?? [])) {
      if (bonus.type === 'stat' && bonus.stat) {
        bonuses.push({ type: 'stat', statKey: bonus.stat, multiplier: 1 });
      } else if (bonus.type === 'proficiency' && bonus.proficiency) {
        bonuses.push({ type: 'proficiency', proficiencyKey: bonus.proficiency });
      } else if (bonus.type === 'flat') {
        bonuses.push({ type: 'flat', flatValue: bonus.flatValue ?? 0 });
      }
    }
    
    v2.actions.push({
      id: step.id || generateId(),
      type: 'roll_check',
      label: step.label || `Шаг ${i + 1}`,
      order: i,
      diceFormula: step.roll?.dice || 'd20',
      bonuses,
      successThreshold: step.threshold ?? 11,
      transitions: [
        { id: generateId(), condition: 'crit_fail', targetStepId: 'stop', priority: 0 },
        { id: generateId(), condition: 'always', targetStepId: 'next', priority: 99 },
      ],
    });
  }
  
  return v2;
}

// ═══════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════════════════════════

interface ActionEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  action: CustomAction | CustomActionV2 | null;
  resources?: Resource[];
  onSave: (action: CustomActionV2) => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// ШАБЛОНЫ ДЕЙСТВИЙ
// ═══════════════════════════════════════════════════════════════════════════

const ACTION_TEMPLATES: {
  id: string;
  name: string;
  description: string;
  icon: string;
  create: () => CustomActionV2;
}[] = [
  {
    id: 'empty',
    name: 'Пустое',
    description: 'Чистый лист для создания с нуля',
    icon: '📄',
    create: () => ({
      ...createEmptyCustomActionV2(),
      id: generateId(),
    }),
  },
  {
    id: 'skill_check',
    name: 'Проверка навыка',
    description: 'd20 + характеристика vs порог',
    icon: '🎲',
    create: () => ({
      id: generateId(),
      name: 'Проверка',
      version: 2,
      icon: '🎲',
      category: 'check',
      description: 'Проверка навыка',
      costs: [],
      defaultRollModifier: 'normal',
      actions: [
        {
          id: generateId(),
          type: 'roll_check',
          label: 'Проверка',
          order: 0,
          diceFormula: 'd20',
          bonuses: [{ type: 'stat', statKey: 'dexterity', multiplier: 1 }],
          successThreshold: 15,
          transitions: [
            { id: generateId(), condition: 'crit_fail', targetStepId: 'stop', priority: 0 },
            { id: generateId(), condition: 'fail', targetStepId: 'stop', priority: 1 },
            { id: generateId(), condition: 'always', targetStepId: 'next', priority: 99 },
          ],
        },
        {
          id: generateId(),
          type: 'message',
          label: 'Успех',
          order: 1,
          messageTemplate: '✅ Проверка пройдена!',
          messageType: 'success',
        },
      ],
    }),
  },
  {
    id: 'use_potion',
    name: 'Зелье исцеления',
    description: 'Бросок на исцеление + восстановление HP',
    icon: '🧪',
    create: () => ({
      id: generateId(),
      name: 'Зелье исцеления',
      version: 2,
      icon: '🧪',
      category: 'item',
      description: 'Выпить зелье и восстановить HP',
      costs: [],
      defaultRollModifier: 'normal',
      actions: [
        {
          id: generateId(),
          type: 'roll_dice',
          label: 'Исцеление',
          order: 0,
          diceFormula: '2d4+2',
          saveResultAs: 'healAmount',
        },
        {
          id: generateId(),
          type: 'modify_resource',
          label: 'Восстановление HP',
          order: 1,
          resourceType: 'health',
          resourceOperation: 'restore',
          resourceAmount: 0,
        },
        {
          id: generateId(),
          type: 'message',
          label: 'Результат',
          order: 2,
          messageTemplate: '💚 Восстановлено {healAmount} HP!',
          messageType: 'success',
        },
      ],
    }),
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// КОМПОНЕНТ
// ═══════════════════════════════════════════════════════════════════════════

export function ActionEditorModal({
  isOpen,
  onClose,
  action,
  resources = [],
  onSave
}: ActionEditorModalProps) {
  const [activeTab, setActiveTab] = useState('basic');
  const [localAction, setLocalAction] = useState<CustomActionV2>(createEmptyCustomActionV2());
  const [showTemplates, setShowTemplates] = useState(false);
  
  // Инициализация при открытии
  useEffect(() => {
    if (isOpen) {
      if (action) {
        if (isCustomActionV2(action)) {
          setLocalAction({ ...action });
        } else {
          setLocalAction(migrateActionToV2(action));
        }
        setShowTemplates(false);
      } else {
        setLocalAction({ ...createEmptyCustomActionV2(), id: generateId() });
        setShowTemplates(true);
      }
      setActiveTab('basic');
    }
  }, [isOpen, action]);
  
  const update = (updates: Partial<CustomActionV2>) => {
    setLocalAction(prev => ({ ...prev, ...updates }));
  };
  
  const handleSave = () => {
    onSave(localAction);
    onClose();
  };
  
  const handleSelectTemplate = (templateId: string) => {
    const template = ACTION_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setLocalAction(template.create());
      setShowTemplates(false);
    }
  };
  
  const tabs = [
    { id: 'basic', label: 'Основное', icon: '📋' },
    { id: 'costs', label: 'Стоимость', icon: '💰' },
    { id: 'chain', label: 'Цепочка', icon: '⛓️' },
  ];
  
  const iconOptions = ['⚡', '🎲', '🔍', '💪', '🤫', '🗣️', '⚔️', '🛡️', '🏃', '👁️', '🎭', '✨', '🔮', '🧪', '📜', '🎯', '💀', '❤️', '🌟'];
  
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={action ? `Редактирование: ${localAction.name}` : 'Новое действие'}
      className="max-w-2xl max-h-[90vh]"
    >
      {/* Выбор шаблона */}
      {showTemplates && (
        <div className="p-4 space-y-4">
          <div className="text-center">
            <div className="text-lg font-cinzel text-gold mb-2">Выберите шаблон</div>
            <p className="text-sm text-faded">Или начните с чистого листа</p>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            {ACTION_TEMPLATES.map(template => (
              <button
                key={template.id}
                onClick={() => handleSelectTemplate(template.id)}
                className={cn(
                  'p-4 rounded-lg border text-left transition-all',
                  'border-edge-bone bg-obsidian',
                  'hover:border-gold hover:bg-gold/5'
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{template.icon}</span>
                  <div>
                    <div className="font-cinzel text-gold">{template.name}</div>
                    <p className="text-xs text-faded">{template.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          
          <Button variant="secondary" onClick={() => setShowTemplates(false)} className="w-full">
            ← Назад к редактору
          </Button>
        </div>
      )}
      
      {/* Основной редактор */}
      {!showTemplates && (
        <div className="space-y-4">
          <SubTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
          
          {/* ОСНОВНОЕ */}
          {activeTab === 'basic' && (
            <div className="space-y-4 p-1">
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-3">
                  <Input
                    label="Название"
                    value={localAction.name}
                    onChange={(e) => update({ name: e.target.value })}
                    placeholder="Проверка ловкости"
                  />
                </div>
                <Select
                  label="Иконка"
                  value={localAction.icon}
                  onChange={(e) => update({ icon: e.target.value })}
                  options={iconOptions.map(i => ({ value: i, label: i }))}
                />
              </div>
              
              <Select
                label="Категория"
                value={localAction.category}
                onChange={(e) => update({ category: e.target.value as ActionCategory })}
                options={Object.entries(ACTION_CATEGORY_NAMES).map(([k, v]) => ({
                  value: k,
                  label: `${ACTION_CATEGORY_ICONS[k as ActionCategory]} ${v}`
                }))}
              />
              
              <Select
                label="Модификатор броска по умолчанию"
                value={localAction.defaultRollModifier}
                onChange={(e) => update({ defaultRollModifier: e.target.value as RollModifier })}
                options={[
                  { value: 'normal', label: '🎲 Обычный' },
                  { value: 'advantage', label: '🎯 Преимущество' },
                  { value: 'disadvantage', label: '💨 Помеха' },
                ]}
              />
              
              <div>
                <label className="font-cinzel text-[10px] text-faded uppercase tracking-widest">
                  Описание
                </label>
                <textarea
                  value={localAction.description ?? ''}
                  onChange={(e) => update({ description: e.target.value })}
                  placeholder="Описание действия..."
                  className={cn(
                    'w-full mt-1 bg-obsidian border border-edge-bone text-bone rounded px-2.5 py-2',
                    'font-garamond text-sm placeholder:text-dim resize-none h-20',
                    'focus:outline-none focus:border-gold transition-all'
                  )}
                />
              </div>
            </div>
          )}
          
          {/* СТОИМОСТЬ */}
          {activeTab === 'costs' && (
            <div className="space-y-4 p-1">
              <div className="text-xs text-faded mb-2">
                Добавьте ресурсы, которые тратятся при использовании действия.
                <br/>
                <span className="text-gold">💡 Совет:</span> Можно писать формулы, например <code>2d6</code> или <code>1d10+5</code>.
              </div>
              
              <CostsEditor
                costs={localAction.costs}
                resources={resources}
                onChange={(costs) => update({ costs })}
              />
            </div>
          )}
          
          {/* ЦЕПОЧКА ДЕЙСТВИЙ */}
          {activeTab === 'chain' && (
            <div className="p-1 max-h-[50vh] overflow-y-auto">
              <SpellChainEditor
                actions={localAction.actions}
                onChange={(actions) => update({ actions })}
              />
            </div>
          )}
          
          {/* КНОПКИ */}
          <div className="flex gap-2 pt-3 border-t border-edge-bone">
            <Button variant="secondary" onClick={onClose} className="flex-1">
              Отмена
            </Button>
            {!action && (
              <Button variant="secondary" onClick={() => setShowTemplates(true)}>
                📋 Шаблоны
              </Button>
            )}
            <Button variant="gold" onClick={handleSave} className="flex-1">
              💾 Сохранить
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// РЕДАКТОР СТОИМОСТИ
// ═══════════════════════════════════════════════════════════════════════════

function CostsEditor({
  costs,
  resources,
  onChange
}: {
  costs: ActionCost[];
  resources: Resource[];
  onChange: (costs: ActionCost[]) => void;
}) {
  const addCost = () => {
    onChange([...costs, {
      id: generateId(),
      type: 'mana',
      amount: 0
    }]);
  };
  
  const updateCost = (id: string, updates: Partial<ActionCost>) => {
    onChange(costs.map(c => c.id === id ? { ...c, ...updates } : c));
  };
  
  const deleteCost = (id: string) => {
    onChange(costs.filter(c => c.id !== id));
  };
  
  return (
    <div className="space-y-2">
      {costs.length === 0 && (
        <div className="text-center text-faded text-sm py-4">
          Нет стоимости. Действие бесплатное.
        </div>
      )}
      
      {costs.map(cost => (
        <div key={cost.id} className="flex items-center gap-2 p-2 bg-obsidian rounded border border-edge-bone">
          <Select
            value={cost.type}
            onChange={(e) => updateCost(cost.id, { type: e.target.value as any })}
            options={[
              { value: 'mana', label: '💠 Мана' },
              { value: 'health', label: '❤️ HP' },
              { value: 'resource', label: '📦 Ресурс' },
            ]}
            className="w-32"
          />
          
          {cost.type === 'resource' && (
            <Select
              value={cost.resourceId ?? ''}
              onChange={(e) => updateCost(cost.id, { resourceId: e.target.value })}
              options={[
                { value: '', label: '-- Выбрать --' },
                ...resources.map(r => ({ value: r.id, label: `${r.icon} ${r.name}` }))
              ]}
              className="flex-1"
            />
          )}
          
          {/* 🔥 ИЗМЕНЕНО: Input вместо NumberStepper для поддержки формул */}
          <Input
            value={String(cost.amount)}
            onChange={(e) => {
              const val = e.target.value;
              // Разрешаем только цифры, d, +, -
              if (/^[\d+d+\-\s]*$/.test(val)) {
                updateCost(cost.id, { amount: val as any });
              }
            }}
            placeholder="10 или 2d6"
            className="w-24 font-mono text-sm"
          />
          
          <Button variant="danger" size="sm" onClick={() => deleteCost(cost.id)}>
            ×
          </Button>
        </div>
      ))}
      
      <Button variant="secondary" onClick={addCost} className="w-full">
        + Добавить стоимость
      </Button>
    </div>
  );
}
