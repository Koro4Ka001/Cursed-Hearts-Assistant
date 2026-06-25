// src/components/tabs/RageTab.tsx

import { useState, useEffect } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { Button, Section, NumberStepper, Input, Modal, SubTabs, EmptyState, ProgressBar } from '../ui';
import type { RageEffect, RageEffectEntry } from '../../types';
import { generateId } from '../../utils/dice';
import { STAT_NAMES, DAMAGE_TYPE_NAMES, ALL_DAMAGE_TYPES } from '../../types';

export function RageTab() {
  const { 
    units, selectedUnitId, updateUnit, 
    addRage, spendRage, resetRage,
    activateRageEffect, decrementRageEffects, removeActiveRageEffect,
    addNotification, triggerEffect
  } = useGameStore();
  
  const unit = units.find(u => u.id === selectedUnitId);
  
  const [showEffectEditor, setShowEffectEditor] = useState(false);
  const [editingEffect, setEditingEffect] = useState<RageEffect | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [customRageAmount, setCustomRageAmount] = useState(0);
  
  if (!unit) {
    return (
      <EmptyState
        icon="🔥"
        title="Нет персонажа"
        description="Выберите персонажа"
      />
    );
  }
  
  if (!unit.hasRage) {
    return (
      <EmptyState
        icon="🔥"
        title="Rage не доступен"
        description="Включите Rage в настройках персонажа"
        action={
          <Button variant="gold" onClick={() => updateUnit(unit.id, { hasRage: true })}>
            🔥 Включить Rage
          </Button>
        }
      />
    );
  }
  
  const rageConfig = unit.rageConfig ?? { onTakeDamage: 5, onArmorBlock: 2, onDealDamage: 4, max: 100 };
  const rageEffects = unit.rageEffects ?? [];
  const activeEffects = unit.activeRageEffects ?? [];
  const currentRage = unit.rage?.current ?? 0;
  const maxRage = unit.rage?.max ?? rageConfig.max ?? 100;
  
  const handleSaveEffect = (effect: RageEffect) => {
    console.log('[RageTab] Saving effect:', JSON.stringify(effect));
    if (isCreating) {
      updateUnit(unit.id, { rageEffects: [...rageEffects, { ...effect, id: generateId() }] });
    } else {
      updateUnit(unit.id, { 
        rageEffects: rageEffects.map(e => e.id === effect.id ? effect : e) 
      });
    }
    setShowEffectEditor(false);
    setEditingEffect(null);
    setIsCreating(false);
  };
  
  const handleDeleteEffect = (effectId: string) => {
    updateUnit(unit.id, { rageEffects: rageEffects.filter(e => e.id !== effectId) });
  };
  
  const handleActivateEffect = async (effect: RageEffect) => {
    triggerEffect('rage');
    await activateRageEffect(unit.id, effect);
  };
  
  const handleEndRound = async () => {
    await decrementRageEffects(unit.id);
    addNotification('⏳ Раунд завершён', 'info');
  };
  
  const handleCustomRage = async () => {
    if (customRageAmount > 0) {
      await addRage(unit.id, customRageAmount);
    } else if (customRageAmount < 0) {
      await spendRage(unit.id, Math.abs(customRageAmount));
    }
    setCustomRageAmount(0);
  };
  
  return (
    <div className="space-y-3 p-3 overflow-y-auto h-full">
      <Section title="🔥 Ярость" icon="🔥">
        <div className="space-y-3">
          <ProgressBar type="rage" value={currentRage} max={maxRage} />
          
          <div className="grid grid-cols-2 gap-2">
            <NumberStepper 
              label="Быстрое изменение" 
              value={customRageAmount} 
              onChange={setCustomRageAmount}
              min={-100} 
              max={100}
              step={10}
            />
            <div className="flex items-end">
              <Button variant="gold" onClick={handleCustomRage} className="w-full">
                Применить
              </Button>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => addRage(unit.id, 10)} className="flex-1">
              +10
            </Button>
            <Button variant="secondary" onClick={() => spendRage(unit.id, 10)} className="flex-1">
              −10
            </Button>
            <Button variant="danger" onClick={() => resetRage(unit.id)} className="flex-1">
              Сброс
            </Button>
          </div>
          
          <div className="text-xs text-faded p-2 bg-obsidian rounded border border-edge-bone">
            <div className="font-cinzel text-gold mb-1">⚙️ Конфигурация:</div>
            <div>Получение урона: <span className="text-bone">+{rageConfig.onTakeDamage}</span></div>
            <div>Броня заблокировала: <span className="text-bone">+{rageConfig.onArmorBlock}</span></div>
            <div>Нанесение урона: <span className="text-bone">+{rageConfig.onDealDamage}</span></div>
            <div>Максимум: <span className="text-bone">{rageConfig.max}</span></div>
          </div>
        </div>
      </Section>
      
      <Section title="⚡ Активные эффекты" icon="⚡">
        {activeEffects.length === 0 ? (
          <p className="text-faded text-sm text-center py-4">Нет активных эффектов</p>
        ) : (
          <div className="space-y-2">
            {activeEffects.map(effect => (
              <div 
                key={effect.id} 
                className="p-3 bg-obsidian rounded border border-gold/30 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{effect.icon}</span>
                    <div>
                      <div className="font-cinzel text-gold text-sm">{effect.name}</div>
                      <div className="text-xs text-faded">
                        {effect.effects.map(e => e.description).join(', ')}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-ancient">
                      {effect.currentRounds} / {effect.durationRounds} раундов
                    </div>
                    <Button 
                      variant="danger" 
                      size="sm" 
                      onClick={() => removeActiveRageEffect(unit.id, effect.id)}
                      className="mt-1"
                    >
                      ×
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            
            <Button variant="secondary" onClick={handleEndRound} className="w-full">
              ⏳ Завершить раунд
            </Button>
          </div>
        )}
      </Section>
      
      <Section title="🔥 Способности" icon="🔥">
        {rageEffects.length === 0 ? (
          <p className="text-faded text-sm text-center py-4">Нет способностей</p>
        ) : (
          <div className="space-y-2">
            {rageEffects.map(effect => (
              <div 
                key={effect.id} 
                className="p-3 bg-obsidian rounded border border-edge-bone space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{effect.icon}</span>
                    <div>
                      <div className="font-cinzel text-bone text-sm">{effect.name}</div>
                      <div className="text-xs text-faded">
                        💠 {effect.cost} Rage • ⏳ {effect.durationRounds} раундов
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      variant="gold" 
                      size="sm" 
                      onClick={() => handleActivateEffect(effect)}
                      disabled={currentRage < effect.cost}
                    >
                      ⚡
                    </Button>
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      onClick={() => {
                        setEditingEffect(effect);
                        setIsCreating(false);
                        setShowEffectEditor(true);
                      }}
                    >
                      ✏️
                    </Button>
                    <Button 
                      variant="danger" 
                      size="sm" 
                      onClick={() => handleDeleteEffect(effect.id)}
                    >
                      🗑️
                    </Button>
                  </div>
                </div>
                {effect.description && (
                  <div className="text-xs text-ancient italic">
                    {effect.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        <Button 
          variant="gold" 
          onClick={() => {
            setIsCreating(true);
            setEditingEffect(null);
            setShowEffectEditor(true);
          }} 
          className="w-full mt-3"
        >
          + Добавить способность
        </Button>
      </Section>
      
      <Section title="⚙️ Настройки Rage" icon="⚙️" collapsible defaultOpen={false}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <NumberStepper 
              label="За получение урона" 
              value={rageConfig.onTakeDamage} 
              onChange={(v) => updateUnit(unit.id, { 
                rageConfig: { ...rageConfig, onTakeDamage: v } 
              })}
              min={0} 
              max={50} 
            />
            <NumberStepper 
              label="За блокировку бронёй" 
              value={rageConfig.onArmorBlock} 
              onChange={(v) => updateUnit(unit.id, { 
                rageConfig: { ...rageConfig, onArmorBlock: v } 
              })}
              min={0} 
              max={50} 
            />
            <NumberStepper 
              label="За нанесение урона" 
              value={rageConfig.onDealDamage} 
              onChange={(v) => updateUnit(unit.id, { 
                rageConfig: { ...rageConfig, onDealDamage: v } 
              })}
              min={0} 
              max={50} 
            />
            <NumberStepper 
              label="Максимум Rage" 
              value={rageConfig.max} 
              onChange={(v) => updateUnit(unit.id, { 
                rageConfig: { ...rageConfig, max: v },
                rage: { current: unit.rage?.current ?? 0, max: v }
              })}
              min={10} 
              max={1000} 
            />
          </div>
        </div>
      </Section>
      
      <RageEffectEditorModal
        isOpen={showEffectEditor}
        onClose={() => {
          setShowEffectEditor(false);
          setEditingEffect(null);
          setIsCreating(false);
        }}
        effect={editingEffect}
        onSave={handleSaveEffect}
      />
    </div>
  );
}

interface RageEffectEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  effect: RageEffect | null;
  onSave: (effect: RageEffect) => void;
}

function RageEffectEditorModal({ isOpen, onClose, effect, onSave }: RageEffectEditorModalProps) {
  const [localEffect, setLocalEffect] = useState<RageEffect>(
    effect ?? {
      id: '',
      name: 'Новая способность',
      icon: '⚡',
      cost: 50,
      durationRounds: 3,
      currentRounds: 0,
      effects: [],
      description: ''
    }
  );

  useEffect(() => {
    if (isOpen) {
      setLocalEffect(effect ?? {
        id: '',
        name: 'Новая способность',
        icon: '⚡',
        cost: 50,
        durationRounds: 3,
        currentRounds: 0,
        effects: [],
        description: ''
      });
    }
  }, [isOpen, effect]);
  
  const [activeTab, setActiveTab] = useState('basic');
  
  const iconOptions = ['⚡', '🔥', '💀', '🐉', '', '⚔️', '🛡️', '💪', '👁️', '🌟', '💥', '', '', '☠️', '👻'];
  
  const tabs = [
    { id: 'basic', label: 'Основное', icon: '📋' },
    { id: 'effects', label: 'Эффекты', icon: '⚡' },
  ];
  
  const handleSave = () => {
    onSave(localEffect);
    onClose();
  };
  
  const addEffectEntry = () => {
    setLocalEffect(prev => ({
      ...prev,
      effects: [...prev.effects, { type: 'modify_stat', statKey: 'physicalPower', statValue: 1, description: '+1 Физ. сила' }]
    }));
  };
  
  const updateEffectEntry = (index: number, updates: Partial<RageEffectEntry>) => {
    setLocalEffect(prev => ({
      ...prev,
      effects: prev.effects.map((e, i) => i === index ? { ...e, ...updates } : e)
    }));
  };
  
  const deleteEffectEntry = (index: number) => {
    setLocalEffect(prev => ({
      ...prev,
      effects: prev.effects.filter((_, i) => i !== index)
    }));
  };
  
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={effect ? 'Редактирование способности' : 'Новая способность'}
      className="max-w-lg max-h-[85vh]"
    >
      <div className="space-y-4">
        <SubTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        
        {activeTab === 'basic' && (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2">
              <div className="col-span-3">
                <Input
                  label="Название"
                  value={localEffect.name}
                  onChange={(e) => setLocalEffect(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Облик дракона"
                />
              </div>
              <select
                value={localEffect.icon}
                onChange={(e) => setLocalEffect(prev => ({ ...prev, icon: e.target.value }))}
                className="bg-obsidian border border-edge-bone text-bone rounded px-2 py-1.5"
              >
                {iconOptions.map(icon => (
                  <option key={icon} value={icon}>{icon}</option>
                ))}
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <NumberStepper
                label="Стоимость (Rage)"
                value={localEffect.cost}
                onChange={(v) => setLocalEffect(prev => ({ ...prev, cost: v }))}
                min={0}
                max={1000}
                step={10}
              />
              <NumberStepper
                label="Длительность (раунды)"
                value={localEffect.durationRounds}
                onChange={(v) => setLocalEffect(prev => ({ ...prev, durationRounds: v }))}
                min={1}
                max={100}
              />
            </div>
            
            <div>
              <label className="font-cinzel text-[10px] text-faded uppercase tracking-widest">
                Описание
              </label>
              <textarea
                value={localEffect.description ?? ''}
                onChange={(e) => setLocalEffect(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Описание способности..."
                className="w-full mt-1 bg-obsidian border border-edge-bone text-bone rounded px-2.5 py-2 font-garamond text-sm placeholder:text-dim resize-none h-20 focus:outline-none focus:border-gold transition-all"
              />
            </div>
          </div>
        )}
        
        {activeTab === 'effects' && (
          <div className="space-y-3">
            {localEffect.effects.length === 0 && (
              <div className="text-center text-faded text-sm py-4">
                Нет эффектов. Добавьте ниже.
              </div>
            )}
            
            {localEffect.effects.map((entry, index) => (
              <div key={index} className="p-2 bg-obsidian rounded border border-edge-bone space-y-2">
                <div className="flex items-center justify-between">
                  <select
                    value={entry.type}
                    onChange={(e) => updateEffectEntry(index, { 
                      type: e.target.value as RageEffectEntry['type'],
                      description: e.target.value === 'modify_stat' ? '+1 Физ. сила' :
                                   e.target.value === 'add_damage' ? '+15 урон огнём' :
                                   e.target.value === 'transform' ? 'Трансформация' :
                                   'Кастомный эффект'
                    })}
                    className="bg-panel border border-edge-bone text-bone rounded px-2 py-1 text-xs"
                  >
                    <option value="modify_stat">Изменить характеристику</option>
                    <option value="add_damage">Добавить урон</option>
                    <option value="transform">Трансформация</option>
                    <option value="custom">Кастомный эффект</option>
                  </select>
                  <Button variant="danger" size="sm" onClick={() => deleteEffectEntry(index)}>×</Button>
                </div>
                
                {entry.type === 'modify_stat' && (
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={entry.statKey ?? 'physicalPower'}
                      onChange={(e) => updateEffectEntry(index, { 
                        statKey: e.target.value as any,
                        description: `+${entry.statValue ?? 1} ${STAT_NAMES[e.target.value]}`
                      })}
                      className="bg-panel border border-edge-bone text-bone rounded px-2 py-1 text-xs"
                    >
                      {Object.entries(STAT_NAMES).map(([key, name]) => (
                        <option key={key} value={key}>{name}</option>
                      ))}
                    </select>
                    <NumberStepper
                      value={entry.statValue ?? 1}
                      onChange={(v) => updateEffectEntry(index, { 
                        statValue: v,
                        description: `+${v} ${STAT_NAMES[entry.statKey ?? 'physicalPower']}`
                      })}
                      min={-20}
                      max={50}
                    />
                  </div>
                )}
                
                {entry.type === 'add_damage' && (
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={entry.damageType ?? 'огонь'}
                      onChange={(e) => updateEffectEntry(index, { 
                        damageType: e.target.value as any,
                        description: `+${entry.damageValue ?? 15} урон ${DAMAGE_TYPE_NAMES[e.target.value] ?? e.target.value}`
                      })}
                      className="bg-panel border border-edge-bone text-bone rounded px-2 py-1 text-xs"
                    >
                      {ALL_DAMAGE_TYPES.map(type => (
                        <option key={type} value={type}>{DAMAGE_TYPE_NAMES[type] ?? type}</option>
                      ))}
                    </select>
                    <NumberStepper
                      value={entry.damageValue ?? 15}
                      onChange={(v) => updateEffectEntry(index, { 
                        damageValue: v,
                        description: `+${v} урон ${DAMAGE_TYPE_NAMES[entry.damageType ?? 'огонь'] ?? entry.damageType}`
                      })}
                      min={0}
                      max={100}
                    />
                  </div>
                )}
                
                {entry.type === 'custom' && (
                  <Input
                    value={entry.description ?? ''}
                    onChange={(e) => updateEffectEntry(index, { description: e.target.value })}
                    placeholder="Описание эффекта..."
                  />
                )}
              </div>
            ))}
            
            <Button variant="secondary" onClick={addEffectEntry} className="w-full">
              + Добавить эффект
            </Button>
          </div>
        )}
        
        <div className="flex gap-2 pt-3 border-t border-edge-bone">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Отмена
          </Button>
          <Button variant="gold" onClick={handleSave} className="flex-1">
            Сохранить
          </Button>
        </div>
      </div>
    </Modal>
  );
}
