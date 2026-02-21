// src/components/spell-editor/SpellEditorModal.tsx

import { useState, useEffect } from 'react';
import { Modal, Button, Input, Select, NumberStepper, Checkbox, SubTabs, Section } from '../ui';
import { SpellChainEditor } from './SpellChainEditor';
import { cn } from '../../utils/cn';
import type { SpellV2, Spell, Resource } from '../../types';
import { isSpellV2, ALL_DAMAGE_TYPES, DAMAGE_TYPE_NAMES } from '../../types';
import { 
  createEmptySpellV2, 
  SPELL_TEMPLATES,
  generateId 
} from '../../constants/spellActions';
import { MAGIC_ELEMENTS, ELEMENT_ICONS, SPELL_TYPES } from '../../constants/elements';

// ═══════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════════════════════════

interface SpellEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  spell: Spell | SpellV2 | null;  // null = создание нового
  resources?: Resource[];          // Для выбора ресурса стоимости
  onSave: (spell: SpellV2) => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// МИГРАЦИЯ СТАРОГО ЗАКЛИНАНИЯ В V2
// ═══════════════════════════════════════════════════════════════════════════

function migrateSpellToV2(spell: Spell): SpellV2 {
  const v2: SpellV2 = {
    id: spell.id,
    name: spell.name,
    version: 2,
    cost: spell.manaCost,
    costResource: spell.costType === 'health' ? 'health' : 'mana',
    spellType: spell.type,
    projectiles: spell.projectiles ?? '1',
    elements: spell.elements ?? [],
    description: spell.description,
    actions: [],
    modifiers: [],
  };
  
  // Если было isMultiStep — конвертируем в цепочку
  if (spell.isMultiStep) {
    // Шаг 1: Каст
    v2.actions.push({
      id: generateId(),
      type: 'roll_check',
      label: 'Каст',
      order: 0,
      diceFormula: 'd20',
      bonuses: spell.equipmentBonus ? [{ type: 'flat', flatValue: spell.equipmentBonus }] : [],
      transitions: [
        { id: generateId(), condition: 'crit_fail', targetStepId: 'stop', priority: 0 },
        { id: generateId(), condition: 'always', targetStepId: 'next', priority: 99 },
      ],
    });
    
    // Шаг 2: Таблица элементов (если есть)
    if (spell.elementTable) {
      const table = Object.entries(spell.elementTable).map(([num, element]) => ({
        id: generateId(),
        min: parseInt(num),
        max: parseInt(num),
        resultValue: element,
        resultLabel: DAMAGE_TYPE_NAMES[element] ?? element,
        resultIcon: ELEMENT_ICONS[element] ?? '✨',
      }));
      
      v2.actions.push({
        id: generateId(),
        type: 'roll_table',
        label: 'Элемент',
        order: 1,
        diceFormula: 'd12',
        resultTable: table,
        saveResultAs: 'element',
      });
    }
    
    // Шаг 3: Damage tiers (если есть)
    if (spell.damageTiers) {
      v2.actions.push({
        id: generateId(),
        type: 'damage_tiers',
        label: 'Сила',
        order: 2,
        diceFormula: 'd20',
        damageTiers: spell.damageTiers.map(t => ({
          id: generateId(),
          minRoll: t.minRoll,
          maxRoll: t.maxRoll,
          formula: t.formula,
          label: t.label,
        })),
        damageType: 'from_context',
        damageTypeContextKey: 'element',
      });
    }
  } else {
    // Простое заклинание — каст + урон
    v2.actions.push({
      id: generateId(),
      type: 'roll_check',
      label: 'Каст',
      order: 0,
      diceFormula: 'd20',
      bonuses: [
        ...(spell.equipmentBonus ? [{ type: 'flat' as const, flatValue: spell.equipmentBonus }] : []),
        { type: 'from_elements' as const, elementBonusType: 'cast' as const },
      ],
      transitions: [
        { id: generateId(), condition: 'crit_fail', targetStepId: 'stop', priority: 0 },
        { id: generateId(), condition: 'always', targetStepId: 'next', priority: 99 },
      ],
    });
    
    if (spell.damageFormula) {
      v2.actions.push({
        id: generateId(),
        type: 'roll_damage',
        label: 'Урон',
        order: 1,
        damageFormula: spell.damageFormula,
        damageType: spell.damageType ?? 'fire',
        critMultiplier: 2,
        addDamageBonus: true,
      });
    }
  }
  
  return v2;
}

// ═══════════════════════════════════════════════════════════════════════════
// КОМПОНЕНТ
// ═══════════════════════════════════════════════════════════════════════════

export function SpellEditorModal({
  isOpen,
  onClose,
  spell,
  resources = [],
  onSave
}: SpellEditorModalProps) {
  const [activeTab, setActiveTab] = useState('basic');
  const [localSpell, setLocalSpell] = useState<SpellV2>(createEmptySpellV2());
  const [showTemplates, setShowTemplates] = useState(false);
  
  // Инициализация при открытии
  useEffect(() => {
    if (isOpen) {
      if (spell) {
        if (isSpellV2(spell)) {
          setLocalSpell({ ...spell });
        } else {
          // Миграция старого формата
          setLocalSpell(migrateSpellToV2(spell));
        }
        setShowTemplates(false);
      } else {
        // Новое заклинание — показываем шаблоны
        setLocalSpell(createEmptySpellV2());
        setShowTemplates(true);
      }
      setActiveTab('basic');
    }
  }, [isOpen, spell]);
  
  const update = (updates: Partial<SpellV2>) => {
    setLocalSpell(prev => ({ ...prev, ...updates }));
  };
  
  const handleSave = () => {
    onSave(localSpell);
    onClose();
  };
  
  const handleSelectTemplate = (templateId: string) => {
    const template = SPELL_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      const newSpell = template.create();
      setLocalSpell(newSpell);
      setShowTemplates(false);
    }
  };
  
  const tabs = [
    { id: 'basic', label: 'Основное', icon: '📜' },
    { id: 'elements', label: 'Элементы', icon: '✨' },
    { id: 'chain', label: 'Цепочка', icon: '⛓️' },
  ];
  
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={spell ? `Редактирование: ${localSpell.name}` : 'Новое заклинание'}
      className="max-w-2xl max-h-[90vh]"
    >
      {/* Выбор шаблона для нового заклинания */}
      {showTemplates && (
        <div className="p-4 space-y-4">
          <div className="text-center">
            <div className="text-lg font-cinzel text-gold mb-2">Выберите шаблон</div>
            <p className="text-sm text-faded">Или начните с чистого листа</p>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {SPELL_TEMPLATES.map(template => (
              <button
                key={template.id}
                onClick={() => handleSelectTemplate(template.id)}
                className={cn(
                  'p-4 rounded-lg border text-left transition-all',
                  'border-edge-bone bg-obsidian',
                  'hover:border-gold hover:bg-gold/5'
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{template.icon}</span>
                  <span className="font-cinzel text-gold">{template.name}</span>
                </div>
                <p className="text-xs text-faded">{template.description}</p>
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
              <Input
                label="Название заклинания"
                value={localSpell.name}
                onChange={(e) => update({ name: e.target.value })}
                placeholder="Огненный шар"
              />
              
              <div className="grid grid-cols-3 gap-3">
                <NumberStepper
                  label="Стоимость"
                  value={localSpell.cost}
                  onChange={(v) => update({ cost: v })}
                  min={0}
                  max={999}
                />
                <Select
                  label="Ресурс"
                  value={localSpell.costResource}
                  onChange={(e) => update({ costResource: e.target.value as any })}
                  options={[
                    { value: 'mana', label: '💠 Мана' },
                    { value: 'health', label: '❤️ HP' },
                    { value: 'resource', label: '📦 Другой' },
                  ]}
                />
                {localSpell.costResource === 'resource' && (
                  <Select
                    label="Какой ресурс"
                    value={localSpell.costResourceId ?? ''}
                    onChange={(e) => update({ costResourceId: e.target.value })}
                    options={[
                      { value: '', label: '-- Выбрать --' },
                      ...resources.map(r => ({ value: r.id, label: `${r.icon} ${r.name}` }))
                    ]}
                  />
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Тип заклинания"
                  value={localSpell.spellType}
                  onChange={(e) => update({ spellType: e.target.value as any })}
                  options={Object.entries(SPELL_TYPES).map(([k, v]) => ({ value: k, label: v }))}
                />
                <Input
                  label="Снаряды"
                  value={localSpell.projectiles}
                  onChange={(e) => update({ projectiles: e.target.value })}
                  placeholder="1, d4, 2d6"
                />
              </div>
              
              <div>
                <label className="font-cinzel text-[10px] text-faded uppercase tracking-widest">
                  Описание
                </label>
                <textarea
                  value={localSpell.description ?? ''}
                  onChange={(e) => update({ description: e.target.value })}
                  placeholder="Описание заклинания..."
                  className={cn(
                    'w-full mt-1 bg-obsidian border border-edge-bone text-bone rounded px-2.5 py-2',
                    'font-garamond text-sm placeholder:text-dim resize-none h-20',
                    'focus:outline-none focus:border-gold transition-all'
                  )}
                />
              </div>
            </div>
          )}
          
          {/* ЭЛЕМЕНТЫ */}
          {activeTab === 'elements' && (
            <div className="space-y-4 p-1">
              <div className="text-xs text-faded mb-2">
                Выберите элементы заклинания. Они влияют на бонусы от предрасположенностей персонажа.
              </div>
              
              <div className="flex flex-wrap gap-2">
                {MAGIC_ELEMENTS.map(element => {
                  const isSelected = localSpell.elements.includes(element);
                  const icon = ELEMENT_ICONS[element] ?? '✨';
                  
                  return (
                    <button
                      key={element}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          update({ elements: localSpell.elements.filter(e => e !== element) });
                        } else {
                          update({ elements: [...localSpell.elements, element] });
                        }
                      }}
                      className={cn(
                        'px-3 py-2 rounded-lg border transition-all',
                        isSelected
                          ? 'border-gold bg-gold/20 text-gold'
                          : 'border-edge-bone bg-obsidian text-faded hover:border-ancient hover:text-bone'
                      )}
                    >
                      <span className="text-lg mr-1">{icon}</span>
                      <span className="text-sm capitalize">{element}</span>
                    </button>
                  );
                })}
              </div>
              
              {localSpell.elements.length > 0 && (
                <div className="p-3 bg-obsidian rounded border border-edge-bone">
                  <div className="text-xs text-faded uppercase mb-2">Выбранные элементы:</div>
                  <div className="flex flex-wrap gap-2">
                    {localSpell.elements.map(el => (
                      <span key={el} className="px-2 py-1 bg-gold/10 rounded text-gold text-sm">
                        {ELEMENT_ICONS[el] ?? '✨'} {el}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* ЦЕПОЧКА ДЕЙСТВИЙ */}
          {activeTab === 'chain' && (
            <div className="p-1 max-h-[50vh] overflow-y-auto">
              <SpellChainEditor
                actions={localSpell.actions}
                onChange={(actions) => update({ actions })}
              />
            </div>
          )}
          
          {/* КНОПКИ */}
          <div className="flex gap-2 pt-3 border-t border-edge-bone">
            <Button variant="secondary" onClick={onClose} className="flex-1">
              Отмена
            </Button>
            {!spell && (
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
