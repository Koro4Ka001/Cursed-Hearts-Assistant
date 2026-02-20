// src/components/tabs/SettingsTab.tsx
import { useState, useEffect } from 'react';
import OBR from '@owlbear-rodeo/sdk';
import { useGameStore } from '../../stores/useGameStore';
import { Button, Section, Select, Input, NumberStepper, Checkbox, Modal, SubTabs } from '../ui';
import { generateId } from '../../utils/dice';
import { docsService } from '../../services/docsService';
import { selectToken } from '../../services/hpTrackerService';
import type { 
  Unit, Weapon, Spell, Resource, DamageType, ProficiencyType, WeaponType,
  ElementModifier
} from '../../types';
import { 
  DAMAGE_TYPE_NAMES, PROFICIENCY_NAMES, STAT_NAMES, 
  ALL_DAMAGE_TYPES, MULTIPLIER_OPTIONS, PHYSICAL_DAMAGE_TYPES,
  ELEMENT_NAMES, createEmptyElementModifier
} from '../../types';
import { MAGIC_ELEMENTS, SPELL_TYPES, ELEMENT_ICONS, DEFAULT_ELEMENT_TABLE, DEFAULT_DAMAGE_TIERS } from '../../constants/elements';

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
                  label="🗺️ HP/Mana бары на токенах (видны всем)"
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
    { id: 'elements', label: '🔮 Элементы' },  // НОВАЯ ВКЛАДКА
    { id: 'armor', label: 'Броня' },
    { id: 'weapons', label: 'Оружие' },
    { id: 'spells', label: 'Заклинания' },
    { id: 'resources', label: 'Ресурсы' }
  ];
  
  return (
    <div className="space-y-3">
      <SubTabs tabs={editorTabs} activeTab={editorTab} onChange={setEditorTab} />
      
      {/* ОСНОВНОЕ */}
      {editorTab === 'basic' && (
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
            label="💠 Мана = Жизнь (урон снимает ману, HP скрыто)"
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
      )}
      
      {/* СТАТЫ */}
      {editorTab === 'stats' && (
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
      )}
      
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* НОВАЯ ВКЛАДКА: МОДИФИКАТОРЫ ЭЛЕМЕНТОВ */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {editorTab === 'elements' && (
        <ElementModifiersEditor
          modifiers={localUnit.elementModifiers ?? []}
          onChange={(elementModifiers) => update({ elementModifiers })}
        />
      )}
      
      {/* БРОНЯ */}
      {editorTab === 'armor' && (
        <div className="space-y-4">
          <div>
            <div className="text-xs text-faded uppercase mb-2">Физическая защита</div>
            <div className="grid grid-cols-2 gap-2">
              <NumberStepper
                label="Режущий"
                value={localUnit.armor?.slashing ?? 0}
                onChange={(v) => update({ armor: { ...(localUnit.armor ?? {}), slashing: v } })}
              />
              <NumberStepper
                label="Колющий"
                value={localUnit.armor?.piercing ?? 0}
                onChange={(v) => update({ armor: { ...(localUnit.armor ?? {}), piercing: v } })}
              />
              <NumberStepper
                label="Дробящий"
                value={localUnit.armor?.bludgeoning ?? 0}
                onChange={(v) => update({ armor: { ...(localUnit.armor ?? {}), bludgeoning: v } })}
              />
              <NumberStepper
                label="Рубящий"
                value={localUnit.armor?.chopping ?? 0}
                onChange={(v) => update({ armor: { ...(localUnit.armor ?? {}), chopping: v } })}
              />
            </div>
          </div>
          
          <div>
            <div className="text-xs text-faded uppercase mb-2">Магическая защита (базовая)</div>
            <NumberStepper
              label="Все магические элементы"
              value={localUnit.armor?.magicBase ?? 0}
              onChange={(v) => update({ armor: { ...(localUnit.armor ?? {}), magicBase: v } })}
            />
            <p className="text-xs text-faded mt-1">
              💡 Точечная настройка защиты по элементам — во вкладке "🔮 Элементы"
            </p>
          </div>
          
          <NumberStepper
            label="Защита от нежити"
            value={localUnit.armor?.undead ?? 0}
            onChange={(v) => update({ armor: { ...(localUnit.armor ?? {}), undead: v } })}
          />
          
          <div>
            <div className="text-xs text-faded uppercase mb-2">Физические уязвимости/резисты</div>
            <PhysicalMultipliersEditor
              multipliers={localUnit.physicalMultipliers ?? {}}
              onChange={(physicalMultipliers) => update({ physicalMultipliers })}
            />
          </div>
        </div>
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
        <SpellsEditor
          spells={localUnit.spells ?? []}
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
// НОВЫЙ КОМПОНЕНТ: РЕДАКТОР МОДИФИКАТОРОВ ЭЛЕМЕНТОВ
// ═══════════════════════════════════════════════════════════════════════════

function ElementModifiersEditor({
  modifiers,
  onChange
}: {
  modifiers: ElementModifier[];
  onChange: (modifiers: ElementModifier[]) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const addModifier = (element: string) => {
    const newMod: ElementModifier = {
      ...createEmptyElementModifier(element),
      id: generateId()
    };
    onChange([...modifiers, newMod]);
    setExpandedId(newMod.id);
  };
  
  const updateModifier = (id: string, updates: Partial<ElementModifier>) => {
    onChange(modifiers.map(m => m.id === id ? { ...m, ...updates } : m));
  };
  
  const deleteModifier = (id: string) => {
    onChange(modifiers.filter(m => m.id !== id));
    if (expandedId === id) setExpandedId(null);
  };
  
  const toggleActive = (id: string) => {
    const mod = modifiers.find(m => m.id === id);
    if (mod) {
      updateModifier(id, { isActive: !mod.isActive });
    }
  };
  
  // Элементы, которые ещё не добавлены
  const usedElements = new Set(modifiers.map(m => m.element));
  const availableElements = MAGIC_ELEMENTS.filter(e => !usedElements.has(e));
  
  // Хелпер для отображения бонусов
  const getBonusSummary = (mod: ElementModifier): string => {
    const parts: string[] = [];
    
    if (mod.castBonus !== 0) parts.push(`🎯${mod.castBonus > 0 ? '+' : ''}${mod.castBonus}`);
    if (mod.damageBonus !== 0) parts.push(`💥${mod.damageBonus > 0 ? '+' : ''}${mod.damageBonus}`);
    if (mod.damageBonusPercent !== 0) parts.push(`💥${mod.damageBonusPercent > 0 ? '+' : ''}${mod.damageBonusPercent}%`);
    if (mod.manaReduction !== 0) parts.push(`💠−${mod.manaReduction}`);
    if (mod.manaReductionPercent !== 0) parts.push(`💠−${mod.manaReductionPercent}%`);
    if (mod.resistance !== 0) parts.push(`🛡️${mod.resistance}`);
    if (mod.damageMultiplier !== 1) parts.push(`×${mod.damageMultiplier}`);
    
    return parts.length > 0 ? parts.join(' ') : 'Нет эффектов';
  };
  
  const getMultiplierColor = (mult: number): string => {
    if (mult === 0) return 'text-green-400';  // Иммунитет
    if (mult < 1) return 'text-green-500';    // Резист
    if (mult > 1) return 'text-blood-bright'; // Уязвимость
    return 'text-faded';
  };
  
  return (
    <div className="space-y-3">
      {/* Инструкция */}
      <div className="p-2 bg-obsidian rounded border border-edge-bone">
        <div className="text-xs text-faded space-y-1">
          <p>🔮 <strong>Модификаторы элементов</strong> — всё в одном месте:</p>
          <ul className="ml-4 space-y-0.5">
            <li>• <span className="text-gold">Атака</span>: бонусы при касте заклинаний с этим элементом</li>
            <li>• <span className="text-mana-bright">Защита</span>: сопротивление/уязвимость к урону этого элемента</li>
          </ul>
        </div>
      </div>
      
      {/* Список модификаторов */}
      {modifiers.length === 0 ? (
        <div className="text-center text-faded text-sm py-6">
          <div className="text-3xl mb-2">✨</div>
          <p>Нет модификаторов элементов</p>
          <p className="text-xs mt-1">Добавьте элемент ниже</p>
        </div>
      ) : (
        <div className="space-y-2">
          {modifiers.map(mod => {
            const isExpanded = expandedId === mod.id;
            const icon = ELEMENT_ICONS[mod.element] ?? '✨';
            const name = ELEMENT_NAMES[mod.element] ?? mod.element;
            
            return (
              <div
                key={mod.id}
                className={`rounded border transition-all ${
                  mod.isActive 
                    ? 'border-gold/50 bg-panel' 
                    : 'border-edge-bone bg-obsidian opacity-60'
                }`}
              >
                {/* Заголовок карточки */}
                <div 
                  className="flex items-center gap-2 p-2 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : mod.id)}
                >
                  <span className="text-xl">{icon}</span>
                  <span className="font-cinzel text-bone flex-1">{name}</span>
                  
                  {/* Краткая сводка */}
                  {!isExpanded && (
                    <span className="text-xs text-ancient">
                      {getBonusSummary(mod)}
                    </span>
                  )}
                  
                  {/* Кнопки */}
                  <button
                    className={`px-2 py-0.5 rounded text-xs transition-colors ${
                      mod.isActive 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-red-500/20 text-red-400'
                    }`}
                    onClick={(e) => { e.stopPropagation(); toggleActive(mod.id); }}
                  >
                    {mod.isActive ? '✓' : '✗'}
                  </button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); deleteModifier(mod.id); }}
                  >
                    🗑️
                  </Button>
                  <span className="text-faded">{isExpanded ? '▲' : '▼'}</span>
                </div>
                
                {/* Развёрнутое содержимое */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-4 border-t border-edge-bone pt-3">
                    
                    {/* ═══ АТАКА ═══ */}
                    <div>
                      <div className="text-xs text-gold uppercase mb-2 flex items-center gap-1">
                        ⚔️ АТАКА
                        <span className="text-faded font-normal normal-case">(при касте заклинаний {name})</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <NumberStepper
                          label="🎯 К касту/попаданию"
                          value={mod.castBonus}
                          onChange={(v) => updateModifier(mod.id, { castBonus: v })}
                          min={-30}
                          max={30}
                        />
                        <NumberStepper
                          label="💥 К урону (фикс)"
                          value={mod.damageBonus}
                          onChange={(v) => updateModifier(mod.id, { damageBonus: v })}
                          min={-100}
                          max={100}
                        />
                        <NumberStepper
                          label="💥 К урону (%)"
                          value={mod.damageBonusPercent}
                          onChange={(v) => updateModifier(mod.id, { damageBonusPercent: v })}
                          min={-100}
                          max={500}
                        />
                        <NumberStepper
                          label="💠 −Мана (фикс)"
                          value={mod.manaReduction}
                          onChange={(v) => updateModifier(mod.id, { manaReduction: v })}
                          min={0}
                          max={100}
                        />
                        <NumberStepper
                          label="💠 −Мана (%)"
                          value={mod.manaReductionPercent}
                          onChange={(v) => updateModifier(mod.id, { manaReductionPercent: v })}
                          min={0}
                          max={100}
                        />
                      </div>
                    </div>
                    
                    {/* ═══ ЗАЩИТА ═══ */}
                    <div>
                      <div className="text-xs text-mana-bright uppercase mb-2 flex items-center gap-1">
                        🛡️ ЗАЩИТА
                        <span className="text-faded font-normal normal-case">(при получении урона {name})</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <NumberStepper
                          label="🛡️ Сопротивление (фикс)"
                          value={mod.resistance}
                          onChange={(v) => updateModifier(mod.id, { resistance: v })}
                          min={0}
                          max={999}
                        />
                        
                        <div>
                          <div className="text-xs text-faded mb-1">⚡ Множитель урона</div>
                          <Select
                            value={mod.damageMultiplier.toString()}
                            onChange={(e) => updateModifier(mod.id, { 
                              damageMultiplier: parseFloat(e.target.value) 
                            })}
                            options={MULTIPLIER_OPTIONS.map(o => ({ 
                              value: o.value.toString(), 
                              label: o.label 
                            }))}
                            className={getMultiplierColor(mod.damageMultiplier)}
                          />
                        </div>
                      </div>
                      
                      {/* Подсказка по множителю */}
                      <div className="mt-2 text-xs text-faded">
                        {mod.damageMultiplier === 0 && '🟢 Полный иммунитет к урону этого элемента'}
                        {mod.damageMultiplier > 0 && mod.damageMultiplier < 1 && '🟢 Сопротивление: урон снижен'}
                        {mod.damageMultiplier === 1 && '⚪ Нормальный урон'}
                        {mod.damageMultiplier > 1 && '🔴 Уязвимость: урон увеличен'}
                      </div>
                    </div>
                    
                    {/* ═══ ЗАМЕТКИ ═══ */}
                    <div>
                      <Input
                        label="📝 Заметки"
                        value={mod.notes ?? ''}
                        onChange={(e) => updateModifier(mod.id, { notes: e.target.value })}
                        placeholder="Откуда этот бонус (предмет, талант, и т.д.)"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      {/* Добавление нового элемента */}
      {availableElements.length > 0 && (
        <div className="pt-2 border-t border-edge-bone">
          <div className="text-xs text-faded uppercase mb-2">+ Добавить элемент</div>
          <div className="flex flex-wrap gap-1">
            {availableElements.map(element => (
              <button
                key={element}
                onClick={() => addModifier(element)}
                className="px-2 py-1 rounded text-xs border border-edge-bone bg-obsidian 
                           text-faded hover:border-gold hover:text-gold transition-colors"
                title={ELEMENT_NAMES[element] ?? element}
              >
                {ELEMENT_ICONS[element] ?? '✨'} {ELEMENT_NAMES[element] ?? element}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ФИЗИЧЕСКИЕ МНОЖИТЕЛИ
// ═══════════════════════════════════════════════════════════════════════════

function PhysicalMultipliersEditor({
  multipliers,
  onChange
}: {
  multipliers: Record<string, number>;
  onChange: (multipliers: Record<string, number>) => void;
}) {
  const [newType, setNewType] = useState('');
  const availableTypes = PHYSICAL_DAMAGE_TYPES.filter(t => multipliers[t] === undefined);
  
  const addMultiplier = () => {
    if (newType && multipliers[newType] === undefined) {
      onChange({ ...multipliers, [newType]: 1 });
      setNewType('');
    }
  };
  
  const getMultiplierColor = (value: number): string => {
    if (value < 1) return 'text-green-500';
    if (value > 1) return 'text-blood-bright';
    return 'text-faded';
  };
  
  return (
    <div className="space-y-2">
      {Object.entries(multipliers).map(([type, value]) => (
        <div key={type} className="flex items-center gap-2">
          <span className={`flex-1 ${getMultiplierColor(value)}`}>
            {DAMAGE_TYPE_NAMES[type as DamageType] ?? type}
          </span>
          <Select
            value={value.toString()}
            onChange={(e) => onChange({ ...multipliers, [type]: parseFloat(e.target.value) })}
            options={MULTIPLIER_OPTIONS.map(o => ({ value: o.value.toString(), label: o.label }))}
            className="w-40"
          />
          <Button variant="danger" size="sm" onClick={() => {
            const { [type]: _, ...rest } = multipliers;
            onChange(rest);
          }}>×</Button>
        </div>
      ))}
      
      {availableTypes.length > 0 && (
        <div className="flex gap-2">
          <Select
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            options={[
              { value: '', label: '+ Добавить тип' },
              ...availableTypes.map(t => ({ value: t, label: DAMAGE_TYPE_NAMES[t] ?? t }))
            ]}
            className="flex-1"
          />
          {newType && (
            <Button variant="gold" size="sm" onClick={addMultiplier}>+</Button>
          )}
        </div>
      )}
      
      {Object.keys(multipliers).length === 0 && availableTypes.length === PHYSICAL_DAMAGE_TYPES.length && (
        <div className="text-xs text-faded">
          Нет физических уязвимостей/резистов. Выберите тип выше.
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ВЫБОР ЭЛЕМЕНТОВ ЗАКЛИНАНИЯ
// ═══════════════════════════════════════════════════════════════════════════

function ElementsPicker({
  selected,
  onChange
}: {
  selected: string[];
  onChange: (elements: string[]) => void;
}) {
  const toggle = (element: string) => {
    if (selected.includes(element)) {
      onChange(selected.filter(e => e !== element));
    } else {
      onChange([...selected, element]);
    }
  };

  return (
    <div>
      <div className="text-xs text-faded mb-1">Элементы</div>
      <div className="flex flex-wrap gap-1">
        {MAGIC_ELEMENTS.map(element => {
          const isSelected = selected.includes(element);
          const icon = ELEMENT_ICONS[element] ?? '✨';
          return (
            <button
              key={element}
              type="button"
              onClick={() => toggle(element)}
              className={`px-2 py-1 rounded text-xs border transition-all ${
                isSelected
                  ? 'border-gold bg-gold-dark/30 text-gold'
                  : 'border-edge-bone bg-obsidian text-faded hover:border-ancient hover:text-bone'
              }`}
              title={ELEMENT_NAMES[element] ?? element}
            >
              {icon}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <div className="text-xs text-ancient mt-1">
          Выбрано: {selected.map(e => `${ELEMENT_ICONS[e] ?? '✨'} ${ELEMENT_NAMES[e] ?? e}`).join(', ')}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// РЕДАКТОР ОРУЖИЯ
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
                  label="Стрел летит за выстрел"
                  value={editingWeapon.multishot ?? 1}
                  onChange={(v) => updateWeapon(editingWeapon.id, { multishot: v })}
                  min={1}
                  max={10}
                />
                <NumberStepper
                  label="Боеприпасов тратится за выстрел"
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
// РЕДАКТОР ЗАКЛИНАНИЙ
// ═══════════════════════════════════════════════════════════════════════════

function SpellsEditor({
  spells,
  onChange
}: {
  spells: Spell[];
  onChange: (spells: Spell[]) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const addSpell = () => {
    const newSpell: Spell = {
      id: generateId(),
      name: 'Новое заклинание',
      manaCost: 10,
      costType: 'mana',
      elements: [],
      type: 'targeted',
      projectiles: '1'
    };
    onChange([...spells, newSpell]);
    setEditingId(newSpell.id);
  };
  
  const updateSpell = (id: string, updates: Partial<Spell>) => {
    onChange(spells.map(s => s.id === id ? { ...s, ...updates } : s));
  };
  
  const deleteSpell = (id: string) => {
    onChange(spells.filter(s => s.id !== id));
    if (editingId === id) setEditingId(null);
  };
  
  const editingSpell = spells.find(s => s.id === editingId);
  
  return (
    <div className="space-y-2">
      {spells.map(s => (
        <div key={s.id} className="flex items-center justify-between p-2 bg-obsidian rounded border border-edge-bone">
          <div>
            <span className="text-bone">{s.name}</span>
            <span className="text-xs text-mana-bright ml-2">{s.manaCost} {s.costType === 'health' ? 'HP' : 'маны'}</span>
          </div>
          <div className="flex gap-1">
            <Button variant="secondary" size="sm" onClick={() => setEditingId(s.id)}>✏️</Button>
            <Button variant="danger" size="sm" onClick={() => deleteSpell(s.id)}>🗑️</Button>
          </div>
        </div>
      ))}
      
      <Button variant="gold" size="sm" onClick={addSpell} className="w-full">
        + Добавить заклинание
      </Button>
      
      <Modal
        isOpen={!!editingSpell}
        onClose={() => setEditingId(null)}
        title="Редактировать заклинание"
      >
        {editingSpell && (
          <div className="space-y-3">
            <Input
              label="Название"
              value={editingSpell.name ?? ''}
              onChange={(e) => updateSpell(editingSpell.id, { name: e.target.value })}
            />
            
            <div className="grid grid-cols-2 gap-2">
              <NumberStepper
                label="Стоимость"
                value={editingSpell.manaCost ?? 0}
                onChange={(v) => updateSpell(editingSpell.id, { manaCost: v })}
              />
              <Select
                label="Тип стоимости"
                value={editingSpell.costType ?? 'mana'}
                onChange={(e) => updateSpell(editingSpell.id, { costType: e.target.value as 'mana' | 'health' })}
                options={[
                  { value: 'mana', label: '💠 Мана' },
                  { value: 'health', label: '🩸 HP' }
                ]}
              />
            </div>
            
            <Select
              label="Тип заклинания"
              value={editingSpell.type ?? 'targeted'}
              onChange={(e) => updateSpell(editingSpell.id, { type: e.target.value as Spell['type'] })}
              options={Object.entries(SPELL_TYPES).map(([k, v]) => ({ value: k, label: v }))}
            />
            
            <Input
              label="Снаряды (число или формула)"
              value={editingSpell.projectiles ?? '1'}
              onChange={(e) => updateSpell(editingSpell.id, { projectiles: e.target.value })}
              placeholder="3 или d4 или 2d6+1"
            />
            
            <ElementsPicker
              selected={editingSpell.elements ?? []}
              onChange={(elements) => updateSpell(editingSpell.id, { elements })}
            />
            
            <Input
              label="Формула урона"
              value={editingSpell.damageFormula ?? ''}
              onChange={(e) => updateSpell(editingSpell.id, { damageFormula: e.target.value })}
              placeholder="d20+d4"
            />
            
            <Select
              label="Тип урона"
              value={editingSpell.damageType ?? ''}
              onChange={(e) => updateSpell(editingSpell.id, { damageType: e.target.value as DamageType })}
              options={[
                { value: '', label: '-- Нет урона --' },
                ...ALL_DAMAGE_TYPES.map(t => ({ value: t, label: DAMAGE_TYPE_NAMES[t] ?? t }))
              ]}
            />
            
            <Input
              label="Описание"
              value={editingSpell.description ?? ''}
              onChange={(e) => updateSpell(editingSpell.id, { description: e.target.value })}
            />
            
            <NumberStepper
              label="Бонус от экипировки"
              value={editingSpell.equipmentBonus ?? 0}
              onChange={(v) => updateSpell(editingSpell.id, { equipmentBonus: v })}
            />
            
            <div className="border-t border-edge-bone pt-3 mt-3">
              <Checkbox
                checked={editingSpell.isMultiStep ?? false}
                onChange={(v) => {
                  const updates: Partial<Spell> = { isMultiStep: v };
                  if (v && !editingSpell.elementTable) {
                    updates.elementTable = { ...DEFAULT_ELEMENT_TABLE };
                  }
                  if (v && !editingSpell.damageTiers) {
                    updates.damageTiers = [...DEFAULT_DAMAGE_TIERS];
                  }
                  updateSpell(editingSpell.id, updates);
                }}
                label="⚡ Многошаговый режим (d20 → d12 элемент → d20 сила → урон)"
              />
              
              {editingSpell.isMultiStep && (
                <div className="mt-3 space-y-3">
                  <div>
                    <div className="text-xs text-faded uppercase mb-2">Таблица d12 → Элемент</div>
                    <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto">
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(num => (
                        <div key={num} className="flex items-center gap-1">
                          <span className="text-gold text-xs w-6 text-right">{num}:</span>
                          <Select
                            value={(editingSpell.elementTable ?? DEFAULT_ELEMENT_TABLE)[num] ?? 'fire'}
                            onChange={(e) => {
                              const table = { ...(editingSpell.elementTable ?? DEFAULT_ELEMENT_TABLE) };
                              table[num] = e.target.value as DamageType;
                              updateSpell(editingSpell.id, { elementTable: table });
                            }}
                            options={ALL_DAMAGE_TYPES.filter(t => t !== 'pure').map(t => ({ 
                              value: t, 
                              label: DAMAGE_TYPE_NAMES[t] ?? t 
                            }))}
                            className="flex-1"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-xs text-faded uppercase mb-2">Tier'ы урона (по d20)</div>
                    <div className="space-y-2">
                      {(editingSpell.damageTiers ?? DEFAULT_DAMAGE_TIERS).map((tier, idx) => (
                        <div key={idx} className="flex items-center gap-1 flex-wrap">
                          <input
                            type="number"
                            value={tier.minRoll}
                            onChange={(e) => {
                              const tiers = [...(editingSpell.damageTiers ?? DEFAULT_DAMAGE_TIERS)];
                              tiers[idx] = { ...tiers[idx]!, minRoll: parseInt(e.target.value) || 1 };
                              updateSpell(editingSpell.id, { damageTiers: tiers });
                            }}
                            className="w-10 bg-dark border border-edge-bone text-bone rounded px-1 py-0.5 text-xs text-center"
                          />
                          <span className="text-faded text-xs">—</span>
                          <input
                            type="number"
                            value={tier.maxRoll}
                            onChange={(e) => {
                              const tiers = [...(editingSpell.damageTiers ?? DEFAULT_DAMAGE_TIERS)];
                              tiers[idx] = { ...tiers[idx]!, maxRoll: parseInt(e.target.value) || 20 };
                              updateSpell(editingSpell.id, { damageTiers: tiers });
                            }}
                            className="w-10 bg-dark border border-edge-bone text-bone rounded px-1 py-0.5 text-xs text-center"
                          />
                          <span className="text-faded text-xs">→</span>
                          <input
                            type="text"
                            value={tier.formula}
                            onChange={(e) => {
                              const tiers = [...(editingSpell.damageTiers ?? DEFAULT_DAMAGE_TIERS)];
                              tiers[idx] = { ...tiers[idx]!, formula: e.target.value };
                              updateSpell(editingSpell.id, { damageTiers: tiers });
                            }}
                            className="w-24 bg-dark border border-edge-bone text-bone rounded px-1 py-0.5 text-xs"
                            placeholder="4d12+2d10"
                          />
                          <input
                            type="text"
                            value={tier.label ?? ''}
                            onChange={(e) => {
                              const tiers = [...(editingSpell.damageTiers ?? DEFAULT_DAMAGE_TIERS)];
                              tiers[idx] = { ...tiers[idx]!, label: e.target.value };
                              updateSpell(editingSpell.id, { damageTiers: tiers });
                            }}
                            className="flex-1 bg-dark border border-edge-bone text-bone rounded px-1 py-0.5 text-xs min-w-[60px]"
                            placeholder="Название"
                          />
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              const tiers = (editingSpell.damageTiers ?? DEFAULT_DAMAGE_TIERS).filter((_, i) => i !== idx);
                              updateSpell(editingSpell.id, { damageTiers: tiers });
                            }}
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          const tiers = [...(editingSpell.damageTiers ?? DEFAULT_DAMAGE_TIERS)];
                          const lastMax = tiers.length > 0 ? (tiers[tiers.length - 1]?.maxRoll ?? 0) + 1 : 1;
                          tiers.push({ minRoll: lastMax, maxRoll: lastMax + 3, formula: 'd6', label: 'Новый' });
                          updateSpell(editingSpell.id, { damageTiers: tiers });
                        }}
                        className="w-full"
                      >
                        + Добавить tier
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
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
// РЕДАКТОР РЕСУРСОВ
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
