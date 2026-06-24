// src/components/spell-editor/SpellChainEditor.tsx

import { useState } from 'react';
import { Button, Select } from '../ui';
import { cn } from '../../utils/cn';
import { SpellActionEditor } from './SpellActionEditor';
import type { SpellAction, SpellActionType } from '../../types';
import { SPELL_ACTION_TYPE_META } from '../../types';
import { 
  SPELL_ACTION_TYPES, 
  createEmptyAction,
  generateId 
} from '../../constants/spellActions';

// ═══════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════════════════════════

interface SpellChainEditorProps {
  actions: SpellAction[];
  onChange: (actions: SpellAction[]) => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// КОМПОНЕНТ
// ═══════════════════════════════════════════════════════════════════════════

export function SpellChainEditor({ actions, onChange }: SpellChainEditorProps) {
  const [newActionType, setNewActionType] = useState<SpellActionType>('roll_check');
  
  // Сортируем по order
  const sortedActions = [...actions].sort((a, b) => a.order - b.order);
  
  // Добавить шаг
  const addAction = () => {
    const maxOrder = actions.length > 0 
      ? Math.max(...actions.map(a => a.order)) 
      : -1;
    const newAction = createEmptyAction(newActionType, maxOrder + 1);
    onChange([...actions, newAction]);
  };
  
  // Обновить шаг
  const updateAction = (id: string, updated: SpellAction) => {
    onChange(actions.map(a => a.id === id ? updated : a));
  };
  
  // Удалить шаг
  const deleteAction = (id: string) => {
    const filtered = actions.filter(a => a.id !== id);
    // Пересчитываем order
    const reordered = filtered
      .sort((a, b) => a.order - b.order)
      .map((a, idx) => ({ ...a, order: idx }));
    onChange(reordered);
  };
  
  // Переместить вверх
  const moveUp = (id: string) => {
    const idx = sortedActions.findIndex(a => a.id === id);
    if (idx <= 0) return;
    
    const newActions = [...sortedActions];
    const temp = newActions[idx - 1]!.order;
    newActions[idx - 1]!.order = newActions[idx]!.order;
    newActions[idx]!.order = temp;
    
    onChange(newActions);
  };
  
  // Переместить вниз
  const moveDown = (id: string) => {
    const idx = sortedActions.findIndex(a => a.id === id);
    if (idx < 0 || idx >= sortedActions.length - 1) return;
    
    const newActions = [...sortedActions];
    const temp = newActions[idx + 1]!.order;
    newActions[idx + 1]!.order = newActions[idx]!.order;
    newActions[idx]!.order = temp;
    
    onChange(newActions);
  };
  
  // Группируем типы по категориям для красивого отображения
  const actionTypesByCategory = {
    roll: SPELL_ACTION_TYPES.filter(t => t.category === 'roll'),
    effect: SPELL_ACTION_TYPES.filter(t => t.category === 'effect'),
    flow: SPELL_ACTION_TYPES.filter(t => t.category === 'flow'),
    utility: SPELL_ACTION_TYPES.filter(t => t.category === 'utility'),
  };
  
  return (
    <div className="space-y-3">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-faded uppercase tracking-widest font-cinzel">
          Цепочка действий ({actions.length})
        </div>
      </div>
      
      {/* Визуализация цепочки */}
      {sortedActions.length === 0 ? (
        <div className="text-center py-8 text-faded">
          <div className="text-4xl mb-2">📜</div>
          <p className="text-sm">Добавьте первый шаг заклинания</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedActions.map((action, idx) => (
            <div key={action.id} className="relative">
              {/* Линия связи */}
              {idx > 0 && (
                <div className="absolute left-6 -top-2 w-0.5 h-2 bg-gold/30" />
              )}
              
              <SpellActionEditor
                action={action}
                allActions={sortedActions}
                onChange={(updated) => updateAction(action.id, updated)}
                onDelete={() => deleteAction(action.id)}
                onMoveUp={() => moveUp(action.id)}
                onMoveDown={() => moveDown(action.id)}
                isFirst={idx === 0}
                isLast={idx === sortedActions.length - 1}
              />
              
              {/* Стрелка вниз */}
              {idx < sortedActions.length - 1 && (
                <div className="flex justify-center py-1">
                  <div className="text-gold/50 text-lg">↓</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Добавление нового шага */}
      <div className="border-t border-edge-bone pt-3 mt-3">
        <div className="text-xs text-faded uppercase mb-2">Добавить шаг:</div>
        
        <div className="flex gap-2">
          <Select
            value={newActionType}
            onChange={(e) => setNewActionType(e.target.value as SpellActionType)}
            options={[
              { value: '', label: '── Броски ──', disabled: true },
              ...actionTypesByCategory.roll.map(t => ({ 
                value: t.value, 
                label: `${t.icon} ${t.label}` 
              })),
              { value: '', label: '── Эффекты ──', disabled: true },
              ...actionTypesByCategory.effect.map(t => ({ 
                value: t.value, 
                label: `${t.icon} ${t.label}` 
              })),
              { value: '', label: '── Поток ──', disabled: true },
              ...actionTypesByCategory.flow.map(t => ({ 
                value: t.value, 
                label: `${t.icon} ${t.label}` 
              })),
              { value: '', label: '── Утилиты ──', disabled: true },
              ...actionTypesByCategory.utility.map(t => ({ 
                value: t.value, 
                label: `${t.icon} ${t.label}` 
              })),
            ].filter(o => o.value !== '' || o.disabled)}
            className="flex-1"
          />
          <Button variant="gold" onClick={addAction}>
            + Добавить
          </Button>
        </div>
        
        {/* Подсказка о выбранном типе */}
        <div className="mt-2 p-2 bg-obsidian rounded border border-edge-bone">
          <div className="flex items-center gap-2">
            <span className="text-lg">
              {SPELL_ACTION_TYPE_META[newActionType]?.icon}
            </span>
            <div>
              <div className={cn('text-sm font-cinzel', SPELL_ACTION_TYPE_META[newActionType]?.color)}>
                {SPELL_ACTION_TYPE_META[newActionType]?.name}
              </div>
              <div className="text-xs text-faded">
                {SPELL_ACTION_TYPE_META[newActionType]?.description}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Быстрые шаблоны */}
      <div className="border-t border-edge-bone pt-3">
        <div className="text-xs text-faded uppercase mb-2">Быстрые шаблоны:</div>
        <div className="flex flex-wrap gap-1">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const castAction = createEmptyAction('roll_check', actions.length);
              castAction.label = 'Каст';
              onChange([...actions, castAction]);
            }}
          >
            🎯 +Каст
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const dmgAction = createEmptyAction('roll_damage', actions.length);
              dmgAction.label = 'Урон';
              onChange([...actions, dmgAction]);
            }}
          >
            💥 +Урон
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const tableAction = createEmptyAction('roll_table', actions.length);
              tableAction.label = 'Элемент';
              tableAction.saveResultAs = 'element';
              onChange([...actions, tableAction]);
            }}
          >
            📋 +Таблица
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const tierAction = createEmptyAction('damage_tiers', actions.length);
              tierAction.label = 'Сила';
              onChange([...actions, tierAction]);
            }}
          >
            ⚔️ +Tier
          </Button>
        </div>
      </div>
    </div>
  );
}
