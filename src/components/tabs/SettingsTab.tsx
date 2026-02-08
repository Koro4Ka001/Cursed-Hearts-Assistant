import { useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { Button, Section, Input, Select, Checkbox, NumberStepper, Modal, SubTabs } from '../ui';
import { docsService } from '../../services/docsService';
import { selectToken } from '../../services/obrService';
import { generateId } from '../../utils/dice';
import type { Unit, Weapon, Spell, Resource, DamageType, ProficiencyType, WeaponType, SpellCostType, ResourceType } from '../../types';
import { DAMAGE_TYPE_NAMES, PROFICIENCY_NAMES, STAT_NAMES, MULTIPLIER_OPTIONS, ALL_DAMAGE_TYPES } from '../../types';
import { MAGIC_ELEMENTS } from '../../constants/elements';

export function SettingsTab() {
  const [activeSubTab, setActiveSubTab] = useState('units');
  
  const subTabs = [
    { id: 'units', label: 'Юниты', icon: '👤' },
    { id: 'google', label: 'Google', icon: '📄' },
    { id: 'tokens', label: 'Токены', icon: '🎯' },
    { id: 'export', label: 'Экспорт', icon: '💾' }
  ];
  
  return (
    <div className="h-full flex flex-col">
      <SubTabs
        tabs={subTabs}
        activeTab={activeSubTab}
        onChange={setActiveSubTab}
        className="px-3 pt-2"
      />
      
      <div className="flex-1 overflow-y-auto p-3">
        {activeSubTab === 'units' && <UnitsSettings />}
        {activeSubTab === 'google' && <GoogleDocsSettings />}
        {activeSubTab === 'tokens' && <TokenSettings />}
        {activeSubTab === 'export' && <ExportSettings />}
      </div>
    </div>
  );
}

// ========== UNITS SETTINGS ==========

function UnitsSettings() {
  const { units, addUnit, deleteUnit, selectedUnitId, selectUnit, updateUnit } = useGameStore();
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  
  const editingUnit = units.find(u => u.id === editingUnitId);
  
  const handleAddUnit = () => {
    addUnit();
  };
  
  return (
    <div className="space-y-3">
      <Section title="Персонажи" icon="👤">
        <div className="space-y-2 mb-3">
          {units.length === 0 ? (
            <p className="text-faded text-sm">Нет персонажей</p>
          ) : (
            units.map(unit => (
              <div
                key={unit.id}
                className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-colors ${
                  unit.id === selectedUnitId 
                    ? 'border-gold bg-gold-dark/20' 
                    : 'border-edge-bone bg-obsidian hover:border-ancient'
                }`}
                onClick={() => selectUnit(unit.id)}
              >
                <div>
                  <div className="text-bone font-garamond">{unit.name}</div>
                  <div className="text-xs text-faded">{unit.shortName}</div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); setEditingUnitId(unit.id); }}
                  >
                    ✏️
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); deleteUnit(unit.id); }}
                  >
                    🗑️
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
        
        <Button variant="gold" onClick={handleAddUnit} className="w-full">
          + Добавить персонажа
        </Button>
      </Section>
      
      {/* Модалка редактирования */}
      {editingUnit && (
        <Modal
          isOpen={!!editingUnitId}
          onClose={() => setEditingUnitId(null)}
          title={`Редактирование: ${editingUnit.name}`}
          className="max-w-md max-h-[80vh]"
        >
          <UnitEditor
            unit={editingUnit}
            onSave={(updated) => { updateUnit(updated.id, updated); setEditingUnitId(null); }}
            onClose={() => setEditingUnitId(null)}
          />
        </Modal>
      )}
    </div>
  );
}

// ========== UNIT EDITOR ==========

interface UnitEditorProps {
  unit: Unit;
  onSave: (unit: Unit) => void;
  onClose: () => void;
}

function UnitEditor({ unit, onSave, onClose }: UnitEditorProps) {
  const [editedUnit, setEditedUnit] = useState<Unit>({ ...unit });
  const [editorTab, setEditorTab] = useState('basic');
  
  const update = <K extends keyof Unit>(key: K, value: Unit[K]) => {
    setEditedUnit(prev => ({ ...prev, [key]: value }));
  };
  
  const handleSave = () => {
    onSave(editedUnit);
  };
  
  const editorTabs = [
    { id: 'basic', label: 'Основное' },
    { id: 'stats', label: 'Статы' },
    { id: 'combat', label: 'Бой' },
    { id: 'magic', label: 'Магия' },
    { id: 'armor', label: 'Броня' },
    { id: 'resources', label: 'Ресурсы' }
  ];
  
  return (
    <div className="space-y-4">
      <SubTabs
        tabs={editorTabs}
        activeTab={editorTab}
        onChange={setEditorTab}
      />
      
      <div className="max-h-96 overflow-y-auto space-y-3 pr-1">
        {editorTab === 'basic' && (
          <>
            <Input
              label="Имя"
              value={editedUnit.name}
              onChange={(e) => update('name', e.target.value)}
            />
            <Input
              label="Короткое имя"
              value={editedUnit.shortName}
              onChange={(e) => update('shortName', e.target.value)}
            />
            <Input
              label="Заголовок Google Docs"
              value={editedUnit.googleDocsHeader}
              onChange={(e) => update('googleDocsHeader', e.target.value)}
              placeholder="КАССИАН|КАРТОЧНЫЙ ДИЛЕР"
            />
            <div className="grid grid-cols-2 gap-2">
              <NumberStepper
                label="HP"
                value={editedUnit.health.current}
                onChange={(v) => update('health', { ...editedUnit.health, current: v })}
                min={-999}
                max={9999}
              />
              <NumberStepper
                label="Макс HP"
                value={editedUnit.health.max}
                onChange={(v) => update('health', { ...editedUnit.health, max: v })}
                min={1}
                max={9999}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <NumberStepper
                label="Мана"
                value={editedUnit.mana.current}
                onChange={(v) => update('mana', { ...editedUnit.mana, current: v })}
                min={0}
                max={9999}
              />
              <NumberStepper
                label="Макс мана"
                value={editedUnit.mana.max}
                onChange={(v) => update('mana', { ...editedUnit.mana, max: v })}
                min={0}
                max={9999}
              />
            </div>
            <Checkbox
              checked={editedUnit.hasRokCards}
              onChange={(v) => update('hasRokCards', v)}
              label="🃏 Имеет карты Рока"
            />
            {editedUnit.hasRokCards && (
              <Select
                label="Ресурс колоды Рока"
                value={editedUnit.rokDeckResourceId ?? ''}
                onChange={(e) => update('rokDeckResourceId', e.target.value || undefined)}
                options={[
                  { value: '', label: '— Выберите ресурс —' },
                  ...editedUnit.resources.map(r => ({
                    value: r.id,
                    label: `${r.icon} ${r.name} (${r.current}/${r.max})`
                  }))
                ]}
              />
            )}
            <Checkbox
              checked={editedUnit.hasDoubleShot}
              onChange={(v) => update('hasDoubleShot', v)}
              label="⚡ Имеет ДаблШот"
            />
            {editedUnit.hasDoubleShot && (
              <NumberStepper
                label="Порог ДаблШота"
                value={editedUnit.doubleShotThreshold}
                onChange={(v) => update('doubleShotThreshold', v)}
                min={1}
                max={20}
              />
            )}
          </>
        )}
        
        {editorTab === 'stats' && (
          <div className="space-y-2">
            {(Object.keys(editedUnit.stats) as (keyof Unit['stats'])[]).map(statKey => (
              <NumberStepper
                key={statKey}
                label={STAT_NAMES[statKey]}
                value={editedUnit.stats[statKey]}
                onChange={(v) => update('stats', { ...editedUnit.stats, [statKey]: v })}
                min={-20}
                max={50}
              />
            ))}
          </div>
        )}
        
        {editorTab === 'combat' && (
          <div className="space-y-4">
            <div>
              <h4 className="text-gold text-sm font-cinzel mb-2">ВЛАДЕНИЕ ОРУЖИЕМ</h4>
              <div className="space-y-2">
                {(Object.keys(editedUnit.proficiencies) as ProficiencyType[]).map(profKey => (
                  <NumberStepper
                    key={profKey}
                    label={PROFICIENCY_NAMES[profKey]}
                    value={editedUnit.proficiencies[profKey]}
                    onChange={(v) => update('proficiencies', { ...editedUnit.proficiencies, [profKey]: v })}
                    min={-10}
                    max={20}
                  />
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="text-gold text-sm font-cinzel mb-2">ОРУЖИЕ</h4>
              <WeaponEditor
                weapons={editedUnit.weapons}
                onChange={(weapons) => update('weapons', weapons)}
              />
            </div>
          </div>
        )}
        
        {editorTab === 'magic' && (
          <div className="space-y-4">
            <div>
              <h4 className="text-gold text-sm font-cinzel mb-2">БОНУСЫ К МАГИИ</h4>
              <MagicBonusEditor
                bonuses={editedUnit.magicBonuses}
                onChange={(bonuses) => update('magicBonuses', bonuses)}
              />
            </div>
            
            <div>
              <h4 className="text-gold text-sm font-cinzel mb-2">ЗАКЛИНАНИЯ</h4>
              <SpellEditor
                spells={editedUnit.spells}
                onChange={(spells) => update('spells', spells)}
              />
            </div>
          </div>
        )}
        
        {editorTab === 'armor' && (
          <div className="space-y-4">
            <div>
              <h4 className="text-gold text-sm font-cinzel mb-2">ФИЗИЧЕСКАЯ ЗАЩИТА</h4>
              <div className="space-y-2">
                {(['slashing', 'piercing', 'bludgeoning', 'chopping'] as const).map(type => (
                  <NumberStepper
                    key={type}
                    label={DAMAGE_TYPE_NAMES[type]}
                    value={editedUnit.armor[type]}
                    onChange={(v) => update('armor', { ...editedUnit.armor, [type]: v })}
                    min={0}
                    max={100}
                  />
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="text-gold text-sm font-cinzel mb-2">МАГИЧЕСКАЯ ЗАЩИТА</h4>
              <NumberStepper
                label="Базовая"
                value={editedUnit.armor.magicBase}
                onChange={(v) => update('armor', { ...editedUnit.armor, magicBase: v })}
                min={0}
                max={200}
              />
              <div className="mt-2">
                <MagicArmorEditor
                  overrides={editedUnit.armor.magicOverrides}
                  onChange={(overrides) => update('armor', { ...editedUnit.armor, magicOverrides: overrides })}
                />
              </div>
              <NumberStepper
                label="От нежити"
                value={editedUnit.armor.undead}
                onChange={(v) => update('armor', { ...editedUnit.armor, undead: v })}
                min={0}
                max={100}
              />
            </div>
            
            <div>
              <h4 className="text-gold text-sm font-cinzel mb-2">МНОЖИТЕЛИ УРОНА</h4>
              <p className="text-xs text-faded mb-2">Резистансы (зелёные) и уязвимости (красные)</p>
              <MultiplierEditor
                multipliers={editedUnit.damageMultipliers}
                onChange={(m) => update('damageMultipliers', m)}
              />
            </div>
          </div>
        )}
        
        {editorTab === 'resources' && (
          <ResourceEditor
            resources={editedUnit.resources}
            onChange={(resources) => update('resources', resources)}
          />
        )}
      </div>
      
      <div className="flex gap-2 pt-2 border-t border-edge-bone">
        <Button variant="secondary" onClick={onClose} className="flex-1">
          Отмена
        </Button>
        <Button variant="gold" onClick={handleSave} className="flex-1">
          Сохранить
        </Button>
      </div>
    </div>
  );
}

// ========== SUB-EDITORS ==========

function WeaponEditor({ weapons, onChange }: { weapons: Weapon[]; onChange: (w: Weapon[]) => void }) {
  const addWeapon = () => {
    onChange([...weapons, {
      id: generateId(),
      name: 'Новое оружие',
      type: 'melee',
      damageFormula: 'd20',
      damageType: 'slashing',
      proficiencyType: 'swords',
      statBonus: 'physicalPower',
      hitBonus: 0,
      multishot: 1
    }]);
  };
  
  const updateWeapon = (id: string, updates: Partial<Weapon>) => {
    onChange(weapons.map(w => w.id === id ? { ...w, ...updates } : w));
  };
  
  const removeWeapon = (id: string) => {
    onChange(weapons.filter(w => w.id !== id));
  };
  
  const physicalDamageTypes: DamageType[] = ['slashing', 'piercing', 'bludgeoning', 'chopping'];
  const damageTypeOptions = physicalDamageTypes.map(k => ({ value: k, label: DAMAGE_TYPE_NAMES[k] }));
  const profOptions = Object.entries(PROFICIENCY_NAMES).map(([k, v]) => ({ value: k, label: v }));
  
  return (
    <div className="space-y-2">
      {weapons.map(weapon => (
        <div key={weapon.id} className="p-2 bg-obsidian rounded border border-edge-bone space-y-2">
          <div className="flex justify-between items-center gap-2">
            <Input
              value={weapon.name}
              onChange={(e) => updateWeapon(weapon.id, { name: e.target.value })}
              className="flex-1"
            />
            <Button variant="danger" size="sm" onClick={() => removeWeapon(weapon.id)}>×</Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select
              label="Тип"
              value={weapon.type}
              onChange={(e) => updateWeapon(weapon.id, { 
                type: e.target.value as WeaponType,
                // Очищаем формулу урона для дальнего оружия
                damageFormula: e.target.value === 'ranged' ? '' : weapon.damageFormula
              })}
              options={[
                { value: 'melee', label: 'Ближний бой' },
                { value: 'ranged', label: 'Дальний бой' }
              ]}
            />
            <Select
              label="Владение"
              value={weapon.proficiencyType}
              onChange={(e) => updateWeapon(weapon.id, { proficiencyType: e.target.value as ProficiencyType })}
              options={profOptions}
            />
          </div>
          
          {weapon.type === 'melee' ? (
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Формула урона"
                value={weapon.damageFormula}
                onChange={(e) => updateWeapon(weapon.id, { damageFormula: e.target.value })}
                placeholder="5d20"
              />
              <Select
                label="Тип урона"
                value={weapon.damageType}
                onChange={(e) => updateWeapon(weapon.id, { damageType: e.target.value as DamageType })}
                options={damageTypeOptions}
              />
            </div>
          ) : (
            <>
              <div className="text-xs text-faded p-2 bg-dark rounded">
                ℹ️ Урон дальнего оружия зависит от боеприпасов
              </div>
              <NumberStepper
                label="Стрел за выстрел"
                value={weapon.multishot}
                onChange={(v) => updateWeapon(weapon.id, { multishot: v })}
                min={1}
                max={10}
              />
            </>
          )}
          
          <NumberStepper
            label="Бонус попадания"
            value={weapon.hitBonus}
            onChange={(v) => updateWeapon(weapon.id, { hitBonus: v })}
            min={-10}
            max={20}
          />
        </div>
      ))}
      <Button variant="secondary" onClick={addWeapon} className="w-full">+ Добавить оружие</Button>
    </div>
  );
}

function SpellEditor({ spells, onChange }: { spells: Spell[]; onChange: (s: Spell[]) => void }) {
  const addSpell = () => {
    onChange([...spells, {
      id: generateId(),
      name: 'Новое заклинание',
      manaCost: 10,
      costType: 'mana',
      elements: [],
      type: 'targeted',
      projectiles: '1'
    }]);
  };
  
  const updateSpell = (id: string, updates: Partial<Spell>) => {
    onChange(spells.map(s => s.id === id ? { ...s, ...updates } : s));
  };
  
  const removeSpell = (id: string) => {
    onChange(spells.filter(s => s.id !== id));
  };
  
  const magicalDamageTypes = ALL_DAMAGE_TYPES.filter(t => !['slashing', 'piercing', 'bludgeoning', 'chopping'].includes(t));
  
  return (
    <div className="space-y-2">
      {spells.map(spell => (
        <div key={spell.id} className="p-2 bg-obsidian rounded border border-edge-bone space-y-2">
          <div className="flex justify-between items-center gap-2">
            <Input
              value={spell.name}
              onChange={(e) => updateSpell(spell.id, { name: e.target.value })}
              className="flex-1"
            />
            <Button variant="danger" size="sm" onClick={() => removeSpell(spell.id)}>×</Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <NumberStepper
              label="Стоимость"
              value={spell.manaCost}
              onChange={(v) => updateSpell(spell.id, { manaCost: v })}
              min={0}
              max={999}
            />
            <Select
              label="Тип стоимости"
              value={spell.costType}
              onChange={(e) => updateSpell(spell.id, { costType: e.target.value as SpellCostType })}
              options={[
                { value: 'mana', label: 'Мана' },
                { value: 'health', label: 'HP' }
              ]}
            />
            <Input
              label="Снаряды"
              value={spell.projectiles}
              onChange={(e) => updateSpell(spell.id, { projectiles: e.target.value })}
              placeholder="3 или d4"
            />
          </div>
          <Input
            label="Элементы (через запятую)"
            value={spell.elements.join(', ')}
            onChange={(e) => updateSpell(spell.id, { elements: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
            placeholder="огонь, электричество"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Формула урона"
              value={spell.damageFormula ?? ''}
              onChange={(e) => updateSpell(spell.id, { damageFormula: e.target.value || undefined })}
              placeholder="d20+d4"
            />
            <Select
              label="Тип урона"
              value={spell.damageType ?? ''}
              onChange={(e) => updateSpell(spell.id, { damageType: (e.target.value || undefined) as DamageType | undefined })}
              options={[
                { value: '', label: '— Нет —' },
                ...magicalDamageTypes.map(t => ({ value: t, label: DAMAGE_TYPE_NAMES[t] }))
              ]}
            />
          </div>
          <Input
            label="Описание"
            value={spell.description ?? ''}
            onChange={(e) => updateSpell(spell.id, { description: e.target.value || undefined })}
            placeholder="Описание эффекта"
          />
        </div>
      ))}
      <Button variant="secondary" onClick={addSpell} className="w-full">+ Добавить заклинание</Button>
    </div>
  );
}

function MagicBonusEditor({ bonuses, onChange }: { bonuses: Record<string, number>; onChange: (b: Record<string, number>) => void }) {
  const [newElement, setNewElement] = useState('');
  
  const addBonus = () => {
    if (newElement && !bonuses[newElement]) {
      onChange({ ...bonuses, [newElement]: 0 });
      setNewElement('');
    }
  };
  
  const updateBonus = (element: string, value: number) => {
    onChange({ ...bonuses, [element]: value });
  };
  
  const removeBonus = (element: string) => {
    const newBonuses = { ...bonuses };
    delete newBonuses[element];
    onChange(newBonuses);
  };
  
  return (
    <div className="space-y-2">
      {Object.entries(bonuses).map(([element, value]) => (
        <div key={element} className="flex items-center gap-2">
          <span className="flex-1 text-ancient capitalize">{element}</span>
          <NumberStepper
            value={value}
            onChange={(v) => updateBonus(element, v)}
            min={-10}
            max={20}
          />
          <Button variant="danger" size="sm" onClick={() => removeBonus(element)}>×</Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Select
          value={newElement}
          onChange={(e) => setNewElement(e.target.value)}
          options={[
            { value: '', label: 'Выберите элемент' },
            ...MAGIC_ELEMENTS.map(e => ({ value: e, label: e }))
          ]}
          className="flex-1"
        />
        <Button variant="secondary" onClick={addBonus} disabled={!newElement}>+</Button>
      </div>
    </div>
  );
}

// Редактор персональной магической защиты по элементам
function MagicArmorEditor({ overrides, onChange }: { overrides: Record<string, number>; onChange: (o: Record<string, number>) => void }) {
  const [newElement, setNewElement] = useState('');
  
  const addOverride = () => {
    if (newElement && overrides[newElement] === undefined) {
      onChange({ ...overrides, [newElement]: 0 });
      setNewElement('');
    }
  };
  
  const updateOverride = (element: string, value: number) => {
    onChange({ ...overrides, [element]: value });
  };
  
  const removeOverride = (element: string) => {
    const newOverrides = { ...overrides };
    delete newOverrides[element];
    onChange(newOverrides);
  };
  
  return (
    <div className="space-y-2 p-2 bg-dark rounded border border-edge-bone">
      <div className="text-xs text-faded uppercase">Персональная защита по элементам:</div>
      {Object.entries(overrides).map(([element, value]) => (
        <div key={element} className="flex items-center gap-2">
          <span className="flex-1 text-ancient capitalize text-sm">{element}</span>
          <NumberStepper
            value={value}
            onChange={(v) => updateOverride(element, v)}
            min={0}
            max={200}
          />
          <Button variant="danger" size="sm" onClick={() => removeOverride(element)}>×</Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Select
          value={newElement}
          onChange={(e) => setNewElement(e.target.value)}
          options={[
            { value: '', label: '+ Добавить элемент' },
            ...MAGIC_ELEMENTS.map(e => ({ value: e, label: e }))
          ]}
          className="flex-1"
        />
        <Button variant="secondary" onClick={addOverride} disabled={!newElement}>+</Button>
      </div>
    </div>
  );
}

function MultiplierEditor({ multipliers, onChange }: { multipliers: Record<string, number>; onChange: (m: Record<string, number>) => void }) {
  const [newType, setNewType] = useState('');
  
  const addMultiplier = () => {
    if (newType && multipliers[newType] === undefined) {
      onChange({ ...multipliers, [newType]: 1.0 });
      setNewType('');
    }
  };
  
  const updateMultiplier = (type: string, value: number) => {
    onChange({ ...multipliers, [type]: value });
  };
  
  const removeMultiplier = (type: string) => {
    const newMult = { ...multipliers };
    delete newMult[type];
    onChange(newMult);
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
          <span className={`flex-1 text-sm ${getMultiplierColor(value)}`}>
            {DAMAGE_TYPE_NAMES[type as DamageType] ?? type}
          </span>
          <Select
            value={String(value)}
            onChange={(e) => updateMultiplier(type, parseFloat(e.target.value))}
            options={MULTIPLIER_OPTIONS.map(o => ({ value: String(o.value), label: o.label }))}
            className="w-32"
          />
          <Button variant="danger" size="sm" onClick={() => removeMultiplier(type)}>×</Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Select
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
          options={[
            { value: '', label: '+ Добавить тип' },
            ...ALL_DAMAGE_TYPES.map(t => ({ value: t, label: DAMAGE_TYPE_NAMES[t] }))
          ]}
          className="flex-1"
        />
        <Button variant="secondary" onClick={addMultiplier} disabled={!newType}>+</Button>
      </div>
    </div>
  );
}

function ResourceEditor({ resources, onChange }: { resources: Resource[]; onChange: (r: Resource[]) => void }) {
  const addResource = () => {
    onChange([...resources, {
      id: generateId(),
      name: 'Новый ресурс',
      icon: '📦',
      current: 10,
      max: 10,
      resourceType: 'generic',
      syncWithDocs: false
    }]);
  };
  
  const updateResource = (id: string, updates: Partial<Resource>) => {
    onChange(resources.map(r => r.id === id ? { ...r, ...updates } : r));
  };
  
  const removeResource = (id: string) => {
    onChange(resources.filter(r => r.id !== id));
  };
  
  return (
    <div className="space-y-2">
      {resources.map(resource => (
        <div key={resource.id} className="p-2 bg-obsidian rounded border border-edge-bone space-y-2">
          <div className="flex justify-between items-center gap-2">
            <div className="flex gap-2 flex-1">
              <Input
                value={resource.icon}
                onChange={(e) => updateResource(resource.id, { icon: e.target.value })}
                className="w-12"
              />
              <Input
                value={resource.name}
                onChange={(e) => updateResource(resource.id, { name: e.target.value })}
                className="flex-1"
              />
            </div>
            <Button variant="danger" size="sm" onClick={() => removeResource(resource.id)}>×</Button>
          </div>
          
          <Select
            label="Тип ресурса"
            value={resource.resourceType}
            onChange={(e) => updateResource(resource.id, { resourceType: e.target.value as ResourceType })}
            options={[
              { value: 'generic', label: 'Обычный' },
              { value: 'ammo', label: 'Боеприпасы' }
            ]}
          />
          
          <div className="grid grid-cols-2 gap-2">
            <NumberStepper
              label="Текущее"
              value={resource.current}
              onChange={(v) => updateResource(resource.id, { current: v })}
              min={0}
              max={999}
            />
            <NumberStepper
              label="Максимум"
              value={resource.max}
              onChange={(v) => updateResource(resource.id, { max: v })}
              min={1}
              max={999}
            />
          </div>
          
          {resource.resourceType === 'ammo' && (
            <>
              <div className="text-xs text-mana-bright p-2 bg-mana-dark/30 rounded">
                🏹 Настройки боеприпасов
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Формула урона"
                  value={resource.damageFormula ?? ''}
                  onChange={(e) => updateResource(resource.id, { damageFormula: e.target.value || undefined })}
                  placeholder="6d10"
                />
                <Select
                  label="Тип урона"
                  value={resource.damageType ?? ''}
                  onChange={(e) => updateResource(resource.id, { damageType: (e.target.value || undefined) as DamageType | undefined })}
                  options={[
                    { value: '', label: '— Нет —' },
                    ...ALL_DAMAGE_TYPES.map(t => ({ value: t, label: DAMAGE_TYPE_NAMES[t] }))
                  ]}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Доп. урон"
                  value={resource.extraDamageFormula ?? ''}
                  onChange={(e) => updateResource(resource.id, { extraDamageFormula: e.target.value || undefined })}
                  placeholder="2d6"
                />
                <Select
                  label="Тип доп. урона"
                  value={resource.extraDamageType ?? ''}
                  onChange={(e) => updateResource(resource.id, { extraDamageType: (e.target.value || undefined) as DamageType | undefined })}
                  options={[
                    { value: '', label: '— Нет —' },
                    ...ALL_DAMAGE_TYPES.map(t => ({ value: t, label: DAMAGE_TYPE_NAMES[t] }))
                  ]}
                />
              </div>
            </>
          )}
        </div>
      ))}
      <Button variant="secondary" onClick={addResource} className="w-full">+ Добавить ресурс</Button>
    </div>
  );
}

// ========== GOOGLE DOCS SETTINGS ==========

function GoogleDocsSettings() {
  const { settings, updateSettings, addNotification, startAutoSync, setConnection } = useGameStore();
  const [isTesting, setIsTesting] = useState(false);
  
  // При изменении URL — обновляем сервис и перезапускаем синхронизацию
  const handleUrlChange = (url: string) => {
    updateSettings({ googleDocsUrl: url });
    
    if (url) {
      docsService.setUrl(url);
      // Запускаем авто-синхронизацию если URL появился
      startAutoSync();
    }
  };
  
  const handleTestConnection = async () => {
    if (!settings.googleDocsUrl) {
      addNotification('Введите URL Google Apps Script', 'info');
      return;
    }
    
    setIsTesting(true);
    try {
      docsService.setUrl(settings.googleDocsUrl);
      const result = await docsService.testConnection();
      
      if (result.success) {
        setConnection('docs', true);
        addNotification('Подключение успешно!', 'success');
      } else {
        setConnection('docs', false);
        addNotification(`Ошибка: ${result.error ?? 'неизвестная'}`, 'error');
      }
    } catch {
      setConnection('docs', false);
      addNotification('Ошибка подключения', 'error');
    } finally {
      setIsTesting(false);
    }
  };
  
  return (
    <div className="space-y-3">
      <Section title="Google Docs API" icon="📄">
        <div className="space-y-3">
          <Input
            label="URL Google Apps Script"
            value={settings.googleDocsUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://script.google.com/..."
          />
          
          <Button
            variant="secondary"
            onClick={handleTestConnection}
            loading={isTesting}
            className="w-full"
          >
            🔌 Тест подключения
          </Button>
        </div>
      </Section>
      
      <Section title="Синхронизация" icon="🔄">
        <div className="space-y-2">
          <Checkbox
            checked={settings.syncHP}
            onChange={(v) => updateSettings({ syncHP: v })}
            label="Синхронизировать HP"
          />
          <Checkbox
            checked={settings.syncMana}
            onChange={(v) => updateSettings({ syncMana: v })}
            label="Синхронизировать ману"
          />
          <Checkbox
            checked={settings.syncResources}
            onChange={(v) => updateSettings({ syncResources: v })}
            label="Синхронизировать ресурсы"
          />
          <Checkbox
            checked={settings.writeLogs}
            onChange={(v) => updateSettings({ writeLogs: v })}
            label="Записывать логи в Docs"
          />
          
          <NumberStepper
            label="Интервал авто-синхронизации (минуты)"
            value={settings.autoSyncInterval}
            onChange={(v) => updateSettings({ autoSyncInterval: v })}
            min={1}
            max={60}
          />
        </div>
      </Section>
    </div>
  );
}

// ========== TOKEN SETTINGS ==========

function TokenSettings() {
  const { units, updateUnit, addNotification } = useGameStore();
  const [bindingUnitId, setBindingUnitId] = useState<string | null>(null);
  
  const handleBindToken = async (unitId: string) => {
    setBindingUnitId(unitId);
    
    try {
      const tokenId = await selectToken();
      
      if (tokenId) {
        updateUnit(unitId, { owlbearTokenId: tokenId });
        addNotification('Токен привязан!', 'success');
      } else {
        addNotification('Выбор отменён', 'info');
      }
    } catch {
      addNotification('Ошибка привязки токена', 'error');
    } finally {
      setBindingUnitId(null);
    }
  };
  
  const handleUnbindToken = (unitId: string) => {
    updateUnit(unitId, { owlbearTokenId: undefined });
    addNotification('Токен отвязан', 'info');
  };
  
  return (
    <div className="space-y-3">
      <Section title="Привязка токенов" icon="🎯">
        <p className="text-xs text-faded mb-3">
          Привяжите персонажей к токенам на карте Owlbear Rodeo для синхронизации HP через HP Tracker.
        </p>
        
        <div className="space-y-2">
          {units.map(unit => (
            <div key={unit.id} className="flex items-center justify-between p-2 bg-obsidian rounded border border-edge-bone">
              <div>
                <div className="text-bone">{unit.name}</div>
                {unit.owlbearTokenId ? (
                  <div className="text-xs text-green-500">
                    🟢 {unit.owlbearTokenId.substring(0, 12)}...
                  </div>
                ) : (
                  <div className="text-xs text-faded">Не привязан</div>
                )}
              </div>
              <div className="flex gap-1">
                <Button
                  variant={unit.owlbearTokenId ? 'secondary' : 'gold'}
                  size="sm"
                  onClick={() => handleBindToken(unit.id)}
                  loading={bindingUnitId === unit.id}
                >
                  {unit.owlbearTokenId ? '🔄' : '🎯'}
                </Button>
                {unit.owlbearTokenId && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleUnbindToken(unit.id)}
                  >
                    ✕
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ========== EXPORT SETTINGS ==========

function ExportSettings() {
  const { units, settings, addUnit, updateSettings, addNotification } = useGameStore();
  
  const handleExport = () => {
    const data = {
      version: '2.0.0',
      exportDate: new Date().toISOString(),
      units,
      settings
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cursed-hearts-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    addNotification('Данные экспортированы!', 'success');
  };
  
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        
        if (data.units && Array.isArray(data.units)) {
          for (const unit of data.units) {
            addUnit(unit);
          }
        }
        
        if (data.settings) {
          updateSettings(data.settings);
        }
        
        addNotification('Данные импортированы!', 'success');
      } catch {
        addNotification('Ошибка импорта файла', 'error');
      }
    };
    reader.readAsText(file);
    
    // Reset input
    event.target.value = '';
  };
  
  return (
    <div className="space-y-3">
      <Section title="Экспорт / Импорт" icon="💾">
        <div className="space-y-3">
          <Button variant="gold" onClick={handleExport} className="w-full">
            📤 Экспортировать данные
          </Button>
          
          <label className="block">
            <span className="btn btn-secondary w-full text-center cursor-pointer block px-3 py-1.5 text-sm">
              📥 Импортировать данные
            </span>
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </label>
          
          <p className="text-xs text-faded">
            Экспорт сохраняет всех персонажей и настройки в JSON файл.
            При импорте персонажи добавляются к существующим.
          </p>
        </div>
      </Section>
    </div>
  );
}
