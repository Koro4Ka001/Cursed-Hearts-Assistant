// src/components/tabs/SettingsTab.tsx

import { useState, useEffect } from 'react';
import OBR from '@owlbear-rodeo/sdk';
import { useGameStore } from '../../stores/useGameStore';
import { Button, Section, Select, Input, NumberStepper, Checkbox, Modal, SubTabs } from '../ui';
import { SpellEditorModal } from '../spell-editor';
import { generateId } from '../../constants/spellActions';
import { docsService } from '../../services/docsService';
import { selectToken } from '../../services/hpTrackerService';
import type { 
  Unit, Weapon, Spell, SpellV2, Resource, DamageType, ProficiencyType, WeaponType,
  ElementModifier
} from '../../types';
import { 
  DAMAGE_TYPE_NAMES, PROFICIENCY_NAMES, STAT_NAMES, 
  ALL_DAMAGE_TYPES, MULTIPLIER_OPTIONS,
  ELEMENT_NAMES, isSpellV2, createEmptyElementModifier
} from '../../types';
import { MAGIC_ELEMENTS, SPELL_TYPES, ELEMENT_ICONS } from '../../constants/elements';

// ═══════════════════════════════════════════════════════════════════════════
// КОМПОНЕНТ
// ═══════════════════════════════════════════════════════════════════════════

export function SettingsTab() {
  const { 
    units, selectedUnitId, addUnit, updateUnit, deleteUnit, selectUnit,
    settings, updateSettings, addNotification, setConnection, startAutoSync
  } = useGameStore();
  
  const [subTab, setSubTab] = useState('units');
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  
  useEffect(() => {
    const unsub = OBR.player.onChange((player) => {
      console.log('PLAYER CHANGED:', JSON.stringify(player.metadata, null, 2));
    });
    return () => { unsub(); };
  }, []);
  
  const handleTestDocs = async () => {
    if (!settings.googleDocsUrl) {
      addNotification('Введите URL Google Docs', 'warning');
      return;
    }
    
    setIsTesting(true);
    try {
      docsService.setUrl(settings.googleDocsUrl);
      const result = await docsService.testConnection();
      
      if (result.success) {
        addNotification('Подключение успешно!', 'success');
        setConnection('docs', true);
        startAutoSync();
      } else {
        addNotification(`Ошибка: ${result.error}`, 'error');
        setConnection('docs', false);
      }
    } finally {
      setIsTesting(false);
    }
  };
  
  const handleDebugDice = async () => {
    try {
      const metadata = await OBR.player.getMetadata();
      console.log('PLAYER METADATA:', JSON.stringify(metadata, null, 2));
      addNotification(`Keys: ${JSON.stringify(Object.keys(metadata))}`, 'info');
    } catch (e) {
      addNotification(`Ошибка: ${e}`, 'error');
    }
  };
  
  const editingUnit = editingUnitId ? units.find(u => u.id === editingUnitId) : null;
  
  const subTabs = [
    { id: 'units', label: 'Юниты', icon: '👤' },
    { id: 'docs', label: 'Google Docs', icon: '📄' },
    { id: 'debug', label: 'Debug', icon: '🔧' }
  ];
  
  return (
    <div className="p-3 space-y-3 overflow-y-auto h-full">
      <SubTabs tabs={subTabs} activeTab={subTab} onChange={setSubTab} />
      
      {/* === ЮНИТЫ === */}
      {subTab === 'units' && (
        <div className="space-y-3">
          <Section title="Персонажи" icon="👤">
            {units.length === 0 ? (
              <p className="text-faded text-sm mb-2">Нет персонажей</p>
            ) : (
              <div className="space-y-2 mb-3">
                {units.map(u => (
                  <div 
                    key={u.id}
                    className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-all ${
                      u.id === selectedUnitId 
                        ? 'border-gold bg-gold-dark/20' 
                        : 'border-edge-bone bg-obsidian hover:border-ancient'
                    }`}
                    onClick={() => selectUnit(u.id)}
                  >
                    <div>
                      <div className="text-bone font-garamond">{u.name}</div>
                      <div className="text-xs text-faded">{u.shortName}</div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); setEditingUnitId(u.id); }}
                      >
                        ✏️
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); deleteUnit(u.id); }}
                      >
                        🗑️
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <Button variant="gold" onClick={() => addUnit()} className="w-full">
              + Добавить персонажа
            </Button>
          </Section>
        </div>
      )}
      
      {/* === GOOGLE DOCS === */}
      {subTab === 'docs' && (
        <div className="space-y-3">
          <Section title="Google Docs API" icon="📄">
            <div className="space-y-3">
              <Input
                label="URL Google Apps Script"
                value={settings.googleDocsUrl ?? ''}
                onChange={(e) => updateSettings({ googleDocsUrl: e.target.value })}
                placeholder="https://script.google.com/..."
              />
              
              <Button 
                variant="gold" 
                onClick={handleTestDocs} 
                loading={isTesting}
                className="w-full"
              >
                🔌 Тест подключения
              </Button>
              
              <div className="space-y-2 pt-2 border-t border-edge-bone">
                <Checkbox
                  checked={settings.syncHP ?? true}
                  onChange={(v) => updateSettings({ syncHP: v })}
                  label="Синхронизировать HP"
                />
                <Checkbox
                  checked={settings.syncMana ?? true}
                  onChange={(v) => updateSettings({ syncMana: v })}
                  label="Синхронизировать ману"
                />
                <Checkbox
                  checked={settings.syncResources ?? true}
                  onChange={(v) => updateSettings({ syncResources: v })}
                  label="Синхронизировать ресурсы"
                />
                <Checkbox
                  checked={settings.writeLogs ?? true}
                  onChange={(v) => updateSettings({ writeLogs: v })}
                  label="Логировать действия"
                />
                <Checkbox
                  checked={settings.showTokenBars ?? true}
                  onChange={(v) => updateSettings({ showTokenBars: v })}
                  label="🗺️ HP/Mana бары на токенах"
                />
              </div>
              
              <NumberStepper
                label="Авто-синхронизация (мин)"
                value={settings.autoSyncInterval ?? 5}
                onChange={(v) => updateSettings({ autoSyncInterval: v })}
                min={1}
                max={60}
              />
            </div>
          </Section>
        </div>
      )}
      
      {/* === DEBUG === */}
      {subTab === 'debug' && (
        <div className="space-y-3">
          <Section title="Отладка" icon="🔧">
            <div className="space-y-2">
              <Button variant="secondary" onClick={handleDebugDice} className="w-full">
                🔍 Debug Dice Metadata
              </Button>
              
              <div className="text-xs text-faded p-2 bg-obsidian rounded border border-edge-bone">
                <p>Откройте консоль браузера (F12) для просмотра логов.</p>
              </div>
            </div>
          </Section>
        </div>
      )}
      
      {/* === МОДАЛКА РЕДАКТИРОВАНИЯ ЮНИТА === */}
      <Modal
        isOpen={!!editingUnit}
        onClose={() => setEditingUnitId(null)}
        title={`Редактирование: ${editingUnit?.name ?? ''}`}
        className="max-w-lg max-h-[85vh]"
      >
        {editingUnit && (
          <UnitEditor
            unit={editingUnit}
            onSave={(updated) => {
              updateUnit(editingUnit.id, updated);
              setEditingUnitId(null);
            }}
            onCancel={() => setEditingUnitId(null)}
          />
        )}
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// РЕДАКТОР ЮНИТА
// ═══════════════════════════════════════════════════════════════════════════

interface UnitEditorProps {
  unit: Unit;
  onSave: (updates: Partial<Unit>) => void;
  onCancel: () => void;
}

function UnitEditor({ unit, onSave, onCancel }: UnitEditorProps) {
  const [editorTab, setEditorTab] = useState('basic');
  const [localUnit, setLocalUnit] = useState<Unit>({ 
    ...unit,
    elementModifiers: unit.elementModifiers ?? []
  });
  
  const update = (partial: Partial<Unit>) => {
    setLocalUnit(prev => ({ ...prev, ...partial }));
  };
  
  const editorTabs = [
    { id: 'basic', label: 'Основное' },
    { id: 'stats', label: 'Статы' },
    { id: 'elements', label: '🔮 Элементы' },
    { id: 'armor', label: 'Броня' },
    { id: 'weapons', label: 'Оружие' },
    { id: 'spells', label: '✨ Закл.' },
    { id: 'resources', label: 'Ресурсы' }
  ];
  
  return (
    <div className="space-y-3">
      <SubTabs tabs={editorTabs} activeTab={editorTab} onChange={setEditorTab} />
      
      {/* ОСНОВНОЕ */}
      {editorTab === 'basic' && (
        <BasicEditor localUnit={localUnit} update={update} />
      )}
      
      {/* СТАТЫ */}
      {editorTab === 'stats' && (
        <StatsEditor localUnit={localUnit} update={update} />
      )}
      
      {/* ЭЛЕМЕНТЫ */}
      {editorTab === 'elements' && (
        <ElementModifiersEditor
          modifiers={localUnit.elementModifiers ?? []}
          onChange={(elementModifiers) => update({ elementModifiers })}
        />
      )}
      
      {/* БРОНЯ */}
      {editorTab === 'armor' && (
        <ArmorEditor localUnit={localUnit} update={update} />
      )}
      
      {/* ОРУЖИЕ */}
      {editorTab === 'weapons' && (
        <WeaponsEditor
          weapons={localUnit.weapons ?? []}
          onChange={(weapons) => update({ weapons })}
        />
      )}
      
      {/* ЗАКЛИНАНИЯ */}
      {editorTab === 'spells' && (
        <SpellsEditorV2
          spells={localUnit.spells ?? []}
          resources={localUnit.resources ?? []}
          onChange={(spells) => update({ spells })}
        />
      )}
      
      {/* РЕСУРСЫ */}
      {editorTab === 'resources' && (
        <ResourcesEditor
          resources={localUnit.resources ?? []}
          onChange={(resources) => update({ resources })}
        />
      )}
      
      {/* КНОПКИ СОХРАНЕНИЯ */}
      <div className="flex gap-2 pt-3 border-t border-edge-bone sticky bottom-0 bg-dark">
        <Button variant="secondary" onClick={onCancel} className="flex-1">
          Отмена
        </Button>
        <Button variant="gold" onClick={() => onSave(localUnit)} className="flex-1">
          Сохранить
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BASIC EDITOR
// ═══════════════════════════════════════════════════════════════════════════

function BasicEditor({ localUnit, update }: { localUnit: Unit; update: (p: Partial<Unit>) => void }) {
  return (
    <div className="space-y-3">
      <Input
        label="Имя"
        value={localUnit.name ?? ''}
        onChange={(e) => update({ name: e.target.value })}
      />
      <Input
        label="Короткое имя"
        value={localUnit.shortName ?? ''}
        onChange={(e) => update({ shortName: e.target.value })}
      />
      <Input
        label="Заголовок Google Docs"
        value={localUnit.googleDocsHeader ?? ''}
        onChange={(e) => update({ googleDocsHeader: e.target.value })}
        placeholder="КАССИАН|КАРТОЧНЫЙ ДИЛЕР"
      />
      
      <div className="grid grid-cols-2 gap-2">
        <NumberStepper
          label="Текущее HP"
          value={localUnit.health?.current ?? 0}
          onChange={(v) => update({ health: { ...localUnit.health, current: v } })}
          max={9999}
        />
        <NumberStepper
          label="Макс HP"
          value={localUnit.health?.max ?? 0}
          onChange={(v) => update({ health: { ...localUnit.health, max: v } })}
          max={9999}
        />
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        <NumberStepper
          label="Текущая мана"
          value={localUnit.mana?.current ?? 0}
          onChange={(v) => update({ mana: { ...localUnit.mana, current: v } })}
          max={9999}
        />
        <NumberStepper
          label="Макс мана"
          value={localUnit.mana?.max ?? 0}
          onChange={(v) => update({ mana: { ...localUnit.mana, max: v } })}
          max={9999}
        />
      </div>
      
      <Checkbox
        checked={localUnit.useManaAsHp ?? false}
        onChange={(v) => update({ useManaAsHp: v })}
        label="💠 Мана = Жизнь"
      />
      
      <div className="space-y-2 pt-2 border-t border-edge-bone">
        <Checkbox
          checked={localUnit.hasRokCards ?? false}
          onChange={(v) => update({ hasRokCards: v })}
          label="🃏 Имеет колоду Рока"
        />
        
        {localUnit.hasRokCards && (
          <Select
            label="Ресурс колоды"
            value={localUnit.rokDeckResourceId ?? ''}
            onChange={(e) => update({ rokDeckResourceId: e.target.value })}
            options={[
              { value: '', label: '-- Выберите ресурс --' },
              ...(localUnit.resources ?? []).map(r => ({
                value: r.id,
                label: `${r.icon} ${r.name}`
              }))
            ]}
          />
        )}
        
        <Checkbox
          checked={localUnit.hasDoubleShot ?? false}
          onChange={(v) => update({ hasDoubleShot: v })}
          label="⚡ Способность ДаблШот"
        />
        
        {localUnit.hasDoubleShot && (
          <NumberStepper
            label="Порог ДаблШот"
            value={localUnit.doubleShotThreshold ?? 18}
            onChange={(v) => update({ doubleShotThreshold: v })}
            min={1}
            max={20}
          />
        )}
      </div>
      
      <div className="pt-2 border-t border-edge-bone">
        <div className="text-xs text-faded mb-2">Привязка токена OBR:</div>
        <div className="flex items-center gap-2">
          <Input
            value={localUnit.owlbearTokenId ?? ''}
            onChange={(e) => update({ owlbearTokenId: e.target.value })}
            placeholder="ID токена"
            className="flex-1"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              const tokenId = await selectToken();
              if (tokenId) {
                update({ owlbearTokenId: tokenId });
              }
            }}
          >
            🎯
          </Button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STATS EDITOR
// ═══════════════════════════════════════════════════════════════════════════

function StatsEditor({ localUnit, update }: { localUnit: Unit; update: (p: Partial<Unit>) => void }) {
  return (
    <div className="space-y-3">
      <div className="text-xs text-faded uppercase mb-2">Характеристики</div>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(STAT_NAMES).map(([key, label]) => (
          <NumberStepper
            key={key}
            label={label}
            value={localUnit.stats?.[key as keyof typeof localUnit.stats] ?? 0}
            onChange={(v) => update({ 
              stats: { ...(localUnit.stats ?? {}), [key]: v } 
            })}
            min={-20}
            max={100}
          />
        ))}
      </div>
      
      <div className="text-xs text-faded uppercase mb-2 mt-4">Владение оружием</div>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(PROFICIENCY_NAMES).map(([key, label]) => (
          <NumberStepper
            key={key}
            label={label}
            value={localUnit.proficiencies?.[key as ProficiencyType] ?? 0}
            onChange={(v) => update({ 
              proficiencies: { ...(localUnit.proficiencies ?? {}), [key]: v } 
            })}
            min={-10}
            max={30}
          />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ELEMENT MODIFIERS EDITOR (НОВАЯ ГИБКАЯ СИСТЕМА)
// ═══════════════════════════════════════════════════════════════════════════

function ElementModifiersEditor({
  modifiers,
  onChange
}: {
  modifiers: ElementModifier[];
  onChange: (modifiers: ElementModifier[]) => void;
}) {
  const [newElement, setNewElement] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const addModifier = () => {
    if (!newElement) return;
    if (modifiers.some(m => m.element === newElement)) {
      return; // Уже есть
    }
    
    const newMod: ElementModifier = {
      ...createEmptyElementModifier(newElement),
      id: generateId(),
    };
    onChange([...modifiers, newMod]);
    setNewElement('');
    setEditingId(newMod.id);
  };
  
  const updateModifier = (id: string, updates: Partial<ElementModifier>) => {
    onChange(modifiers.map(m => m.id === id ? { ...m, ...updates } : m));
  };
  
  const deleteModifier = (id: string) => {
    onChange(modifiers.filter(m => m.id !== id));
    if (editingId === id) setEditingId(null);
  };
  
  const editingMod = modifiers.find(m => m.id === editingId);
  const availableElements = MAGIC_ELEMENTS.filter(e => !modifiers.some(m => m.element === e));
  
  return (
    <div className="space-y-3">
      <div className="p-2 bg-obsidian rounded border border-edge-bone">
        <div className="text-xs text-faded">
          🔮 <strong>Модификаторы элементов</strong> влияют на каст заклинаний и получаемый урон.
        </div>
      </div>
      
      {/* Список модификаторов */}
      {modifiers.length === 0 ? (
        <div className="text-center text-faded text-sm py-4">
          Нет модификаторов. Добавьте ниже.
        </div>
      ) : (
        <div className="space-y-2">
          {modifiers.map(mod => (
            <div 
              key={mod.id}
              className={`p-2 rounded border cursor-pointer transition-all ${
                editingId === mod.id 
                  ? 'border-gold bg-gold/10' 
                  : 'border-edge-bone bg-obsidian hover:border-ancient'
              }`}
              onClick={() => setEditingId(editingId === mod.id ? null : mod.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{ELEMENT_ICONS[mod.element] ?? '✨'}</span>
                  <span className="text-bone capitalize">{mod.element}</span>
                  {!mod.isActive && <span className="text-xs text-faded">(выкл)</span>}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {mod.castBonus !== 0 && (
                    <span className="text-gold">каст {mod.castBonus > 0 ? '+' : ''}{mod.castBonus}</span>
                  )}
                  {mod.damageBonus !== 0 && (
                    <span className="text-blood-bright">урон +{mod.damageBonus}</span>
                  )}
                  {mod.manaReduction !== 0 && (
                    <span className="text-mana-bright">мана -{mod.manaReduction}</span>
                  )}
                  {mod.damageMultiplier !== 1 && (
                    <span className={mod.damageMultiplier < 1 ? 'text-green-500' : 'text-blood'}>
                      вход ×{mod.damageMultiplier}
                    </span>
                  )}
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); deleteModifier(mod.id); }}
                  >
                    ×
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Форма добавления */}
      {availableElements.length > 0 && (
        <div className="flex gap-2">
          <Select
            value={newElement}
            onChange={(e) => setNewElement(e.target.value)}
            options={[
              { value: '', label: '+ Добавить элемент' },
              ...availableElements.map(e => ({
                value: e,
                label: `${ELEMENT_ICONS[e] ?? '✨'} ${e}`
              }))
            ]}
            className="flex-1"
          />
          {newElement && (
            <Button variant="gold" onClick={addModifier}>+</Button>
          )}
        </div>
      )}
      
      {/* Редактирование выбранного модификатора */}
      {editingMod && (
        <div className="p-3 bg-panel rounded border border-gold/30 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{ELEMENT_ICONS[editingMod.element] ?? '✨'}</span>
            <span className="text-gold font-cinzel uppercase">{editingMod.element}</span>
          </div>
          
          <Checkbox
            checked={editingMod.isActive}
            onChange={(v) => updateModifier(editingMod.id, { isActive: v })}
            label="Активен"
          />
          
          <div className="text-xs text-faded uppercase border-t border-edge-bone pt-2">Атака</div>
          <div className="grid grid-cols-3 gap-2">
            <NumberStepper
              label="+к касту"
              value={editingMod.castBonus}
              onChange={(v) => updateModifier(editingMod.id, { castBonus: v })}
              min={-20}
              max={50}
            />
            <NumberStepper
              label="+к урону"
              value={editingMod.damageBonus}
              onChange={(v) => updateModifier(editingMod.id, { damageBonus: v })}
              min={-20}
              max={100}
            />
            <NumberStepper
              label="-к мане"
              value={editingMod.manaReduction}
              onChange={(v) => updateModifier(editingMod.id, { manaReduction: v })}
              min={0}
              max={100}
            />
          </div>
          
          <div className="text-xs text-faded uppercase border-t border-edge-bone pt-2">Защита</div>
          <div className="grid grid-cols-2 gap-2">
            <NumberStepper
              label="Сопротивление"
              value={editingMod.resistance}
              onChange={(v) => updateModifier(editingMod.id, { resistance: v })}
              min={0}
              max={999}
            />
            <Select
              label="Множитель урона"
              value={editingMod.damageMultiplier.toString()}
              onChange={(e) => updateModifier(editingMod.id, { damageMultiplier: parseFloat(e.target.value) })}
              options={MULTIPLIER_OPTIONS.map(o => ({ value: o.value.toString(), label: o.label }))}
            />
          </div>
          
          <Input
            label="Заметки"
            value={editingMod.notes ?? ''}
            onChange={(e) => updateModifier(editingMod.id, { notes: e.target.value })}
            placeholder="Кольцо огненной защиты..."
          />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ARMOR EDITOR
// ═══════════════════════════════════════════════════════════════════════════

function ArmorEditor({ localUnit, update }: { localUnit: Unit; update: (p: Partial<Unit>) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-faded uppercase mb-2">Физическая защита</div>
        <div className="grid grid-cols-2 gap-2">
          <NumberStepper
            label="Режущий"
            value={localUnit.armor?.slashing ?? 0}
            onChange={(v) => update({ armor: { ...(localUnit.armor ?? {} as any), slashing: v } })}
          />
          <NumberStepper
            label="Колющий"
            value={localUnit.armor?.piercing ?? 0}
            onChange={(v) => update({ armor: { ...(localUnit.armor ?? {} as any), piercing: v } })}
          />
          <NumberStepper
            label="Дробящий"
            value={localUnit.armor?.bludgeoning ?? 0}
            onChange={(v) => update({ armor: { ...(localUnit.armor ?? {} as any), bludgeoning: v } })}
          />
          <NumberStepper
            label="Рубящий"
            value={localUnit.armor?.chopping ?? 0}
            onChange={(v) => update({ armor: { ...(localUnit.armor ?? {} as any), chopping: v } })}
          />
        </div>
      </div>
      
      <div>
        <div className="text-xs text-faded uppercase mb-2">Магическая защита (базовая)</div>
        <NumberStepper
          label="Базовая магическая"
          value={localUnit.armor?.magicBase ?? 0}
          onChange={(v) => update({ armor: { ...(localUnit.armor ?? {} as any), magicBase: v } })}
        />
        <div className="text-xs text-faded mt-1">
          💡 Защита от конкретных элементов настраивается во вкладке "Элементы"
        </div>
      </div>
      
      <NumberStepper
        label="Защита от нежити"
        value={localUnit.armor?.undead ?? 0}
        onChange={(v) => update({ armor: { ...(localUnit.armor ?? {} as any), undead: v } })}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SPELLS EDITOR V2
// ═══════════════════════════════════════════════════════════════════════════

function SpellsEditorV2({
  spells,
  resources,
  onChange
}: {
  spells: (Spell | SpellV2)[];
  resources: Resource[];
  onChange: (spells: (Spell | SpellV2)[]) => void;
}) {
  const [editingSpell, setEditingSpell] = useState<Spell | SpellV2 | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  const handleSave = (spell: SpellV2) => {
    if (isCreating) {
      onChange([...spells, spell]);
    } else {
      onChange(spells.map(s => s.id === spell.id ? spell : s));
    }
    setEditingSpell(null);
    setIsCreating(false);
  };
  
  const handleDelete = (id: string) => {
    onChange(spells.filter(s => s.id !== id));
  };
  
  return (
    <div className="space-y-2">
      {spells.map(s => (
        <div key={s.id} className="flex items-center justify-between p-2 bg-obsidian rounded border border-edge-bone">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-bone truncate">{s.name}</span>
              {isSpellV2(s) && <span className="text-xs text-purple-400">V2</span>}
            </div>
            <div className="text-xs text-faded">
              {isSpellV2(s) 
                ? `${s.cost} ${s.costResource === 'health' ? 'HP' : 'маны'} • ${s.actions.length} шагов`
                : `${s.manaCost} ${s.costType === 'health' ? 'HP' : 'маны'}`
              }
            </div>
          </div>
          <div className="flex gap-1 ml-2">
            <Button variant="secondary" size="sm" onClick={() => setEditingSpell(s)}>✏️</Button>
            <Button variant="danger" size="sm" onClick={() => handleDelete(s.id)}>🗑️</Button>
          </div>
        </div>
      ))}
      
      <Button 
        variant="gold" 
        size="sm" 
        onClick={() => { setIsCreating(true); setEditingSpell(null); }} 
        className="w-full"
      >
        + Добавить заклинание
      </Button>
      
      <SpellEditorModal
        isOpen={editingSpell !== null || isCreating}
        onClose={() => { setEditingSpell(null); setIsCreating(false); }}
        spell={editingSpell}
        resources={resources}
        onSave={handleSave}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WEAPONS EDITOR
// ═══════════════════════════════════════════════════════════════════════════

function WeaponsEditor({
  weapons,
  onChange
}: {
  weapons: Weapon[];
  onChange: (weapons: Weapon[]) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const addWeapon = () => {
    const newWeapon: Weapon = {
      id: generateId(),
      name: 'Новое оружие',
      type: 'melee',
      damageFormula: 'd6',
      damageType: 'slashing',
      proficiencyType: 'swords',
      statBonus: 'physicalPower',
      hitBonus: 0,
      multishot: 1
    };
    onChange([...weapons, newWeapon]);
    setEditingId(newWeapon.id);
  };
  
  const updateWeapon = (id: string, updates: Partial<Weapon>) => {
    onChange(weapons.map(w => w.id === id ? { ...w, ...updates } : w));
  };
  
  const deleteWeapon = (id: string) => {
    onChange(weapons.filter(w => w.id !== id));
    if (editingId === id) setEditingId(null);
  };
  
  const editingWeapon = weapons.find(w => w.id === editingId);
  
  return (
    <div className="space-y-2">
      {weapons.map(w => (
        <div key={w.id} className="flex items-center justify-between p-2 bg-obsidian rounded border border-edge-bone">
          <div>
            <span className="text-bone">{w.name}</span>
            <span className="text-xs text-faded ml-2">{w.type === 'melee' ? '⚔️' : '🏹'}</span>
          </div>
          <div className="flex gap-1">
            <Button variant="secondary" size="sm" onClick={() => setEditingId(w.id)}>✏️</Button>
            <Button variant="danger" size="sm" onClick={() => deleteWeapon(w.id)}>🗑️</Button>
          </div>
        </div>
      ))}
      
      <Button variant="gold" size="sm" onClick={addWeapon} className="w-full">
        + Добавить оружие
      </Button>
      
      <Modal
        isOpen={!!editingWeapon}
        onClose={() => setEditingId(null)}
        title="Редактировать оружие"
      >
        {editingWeapon && (
          <div className="space-y-3">
            <Input
              label="Название"
              value={editingWeapon.name ?? ''}
              onChange={(e) => updateWeapon(editingWeapon.id, { name: e.target.value })}
            />
            <Select
              label="Тип"
              value={editingWeapon.type ?? 'melee'}
              onChange={(e) => updateWeapon(editingWeapon.id, { type: e.target.value as WeaponType })}
              options={[
                { value: 'melee', label: '⚔️ Ближнее' },
                { value: 'ranged', label: '🏹 Дальнее' }
              ]}
            />
            
            {editingWeapon.type === 'melee' && (
              <Input
                label="Формула урона"
                value={editingWeapon.damageFormula ?? ''}
                onChange={(e) => updateWeapon(editingWeapon.id, { damageFormula: e.target.value })}
                placeholder="5d20"
              />
            )}
            
            {editingWeapon.type === 'ranged' && (
              <>
                <div className="text-xs text-faded p-2 bg-panel rounded">
                  ℹ️ Урон дальнего оружия берётся от боеприпасов
                </div>
                <NumberStepper
                  label="Стрел за выстрел"
                  value={editingWeapon.multishot ?? 1}
                  onChange={(v) => updateWeapon(editingWeapon.id, { multishot: v })}
                  min={1}
                  max={10}
                />
                <NumberStepper
                  label="Боеприпасов за выстрел"
                  value={editingWeapon.ammoPerShot ?? editingWeapon.multishot ?? 1}
                  onChange={(v) => updateWeapon(editingWeapon.id, { ammoPerShot: v })}
                  min={0}
                  max={10}
                />
              </>
            )}
            
            <Select
              label="Тип урона"
              value={editingWeapon.damageType ?? 'slashing'}
              onChange={(e) => updateWeapon(editingWeapon.id, { damageType: e.target.value as DamageType })}
              options={ALL_DAMAGE_TYPES.map(t => ({ value: t, label: DAMAGE_TYPE_NAMES[t] ?? t }))}
            />
            
            <Select
              label="Владение"
              value={editingWeapon.proficiencyType ?? 'swords'}
              onChange={(e) => updateWeapon(editingWeapon.id, { proficiencyType: e.target.value as ProficiencyType })}
              options={Object.entries(PROFICIENCY_NAMES).map(([k, v]) => ({ value: k, label: v }))}
            />
            
            <Select
              label="Бонус от характеристики"
              value={editingWeapon.statBonus ?? 'physicalPower'}
              onChange={(e) => updateWeapon(editingWeapon.id, { statBonus: e.target.value as Weapon['statBonus'] })}
              options={[
                { value: 'physicalPower', label: 'Физ. сила (×5)' },
                { value: 'dexterity', label: 'Ловкость (×3)' },
                { value: 'none', label: 'Нет' }
              ]}
            />
            
            <NumberStepper
              label="Бонус к попаданию"
              value={editingWeapon.hitBonus ?? 0}
              onChange={(v) => updateWeapon(editingWeapon.id, { hitBonus: v })}
              min={-10}
              max={30}
            />
            
            <Input
              label="Заметки"
              value={editingWeapon.notes ?? ''}
              onChange={(e) => updateWeapon(editingWeapon.id, { notes: e.target.value })}
            />
            
            <Button variant="gold" onClick={() => setEditingId(null)} className="w-full">
              Готово
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RESOURCES EDITOR
// ═══════════════════════════════════════════════════════════════════════════

function ResourcesEditor({
  resources,
  onChange
}: {
  resources: Resource[];
  onChange: (resources: Resource[]) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const addResource = () => {
    const newResource: Resource = {
      id: generateId(),
      name: 'Новый ресурс',
      icon: '📦',
      current: 10,
      max: 10,
      resourceType: 'generic',
      syncWithDocs: false
    };
    onChange([...resources, newResource]);
    setEditingId(newResource.id);
  };
  
  const updateResource = (id: string, updates: Partial<Resource>) => {
    onChange(resources.map(r => r.id === id ? { ...r, ...updates } : r));
  };
  
  const deleteResource = (id: string) => {
    onChange(resources.filter(r => r.id !== id));
    if (editingId === id) setEditingId(null);
  };
  
  const editingResource = resources.find(r => r.id === editingId);
  
  return (
    <div className="space-y-2">
      {resources.map(r => (
        <div key={r.id} className="flex items-center justify-between p-2 bg-obsidian rounded border border-edge-bone">
          <div>
            <span className="text-bone">{r.icon} {r.name}</span>
            <span className="text-xs text-faded ml-2">{r.current}/{r.max}</span>
            {r.resourceType === 'ammo' && <span className="text-xs text-ancient ml-2">🏹</span>}
          </div>
          <div className="flex gap-1">
            <Button variant="secondary" size="sm" onClick={() => setEditingId(r.id)}>✏️</Button>
            <Button variant="danger" size="sm" onClick={() => deleteResource(r.id)}>🗑️</Button>
          </div>
        </div>
      ))}
      
      <Button variant="gold" size="sm" onClick={addResource} className="w-full">
        + Добавить ресурс
      </Button>
      
      <Modal
        isOpen={!!editingResource}
        onClose={() => setEditingId(null)}
        title="Редактировать ресурс"
      >
        {editingResource && (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2">
              <div className="col-span-3">
                <Input
                  label="Название"
                  value={editingResource.name ?? ''}
                  onChange={(e) => updateResource(editingResource.id, { name: e.target.value })}
                />
              </div>
              <Input
                label="Иконка"
                value={editingResource.icon ?? '📦'}
                onChange={(e) => updateResource(editingResource.id, { icon: e.target.value })}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <NumberStepper
                label="Текущее"
                value={editingResource.current ?? 0}
                onChange={(v) => updateResource(editingResource.id, { current: v })}
                max={999}
              />
              <NumberStepper
                label="Максимум"
                value={editingResource.max ?? 0}
                onChange={(v) => updateResource(editingResource.id, { max: v })}
                max={999}
              />
            </div>
            
            <Select
              label="Тип ресурса"
              value={editingResource.resourceType ?? 'generic'}
              onChange={(e) => updateResource(editingResource.id, { resourceType: e.target.value as 'generic' | 'ammo' })}
              options={[
                { value: 'generic', label: '📦 Обычный' },
                { value: 'ammo', label: '🏹 Боеприпасы' }
              ]}
            />
            
            {editingResource.resourceType === 'ammo' && (
              <>
                <Input
                  label="Формула урона"
                  value={editingResource.damageFormula ?? ''}
                  onChange={(e) => updateResource(editingResource.id, { damageFormula: e.target.value })}
                  placeholder="6d10"
                />
                <Select
                  label="Тип урона"
                  value={editingResource.damageType ?? 'piercing'}
                  onChange={(e) => updateResource(editingResource.id, { damageType: e.target.value as DamageType })}
                  options={ALL_DAMAGE_TYPES.map(t => ({ value: t, label: DAMAGE_TYPE_NAMES[t] ?? t }))}
                />
                <Input
                  label="Доп. формула урона"
                  value={editingResource.extraDamageFormula ?? ''}
                  onChange={(e) => updateResource(editingResource.id, { extraDamageFormula: e.target.value })}
                  placeholder="2d6 (от рун)"
                />
                {editingResource.extraDamageFormula && (
                  <Select
                    label="Тип доп. урона"
                    value={editingResource.extraDamageType ?? 'void'}
                    onChange={(e) => updateResource(editingResource.id, { extraDamageType: e.target.value as DamageType })}
                    options={ALL_DAMAGE_TYPES.map(t => ({ value: t, label: DAMAGE_TYPE_NAMES[t] ?? t }))}
                  />
                )}
              </>
            )}
            
            <Checkbox
              checked={editingResource.syncWithDocs ?? false}
              onChange={(v) => updateResource(editingResource.id, { syncWithDocs: v })}
              label="📄 Синхронизировать с Google Docs"
            />
            
            <Button variant="gold" onClick={() => setEditingId(null)} className="w-full">
              Готово
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
