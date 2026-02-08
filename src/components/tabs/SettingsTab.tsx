import { useState } from 'react';
import { useGameStore } from '@/stores/useGameStore';
import { Button, Section, Input, Select, Modal, Checkbox, SubTabs, NumberStepper } from '@/components/ui';
import type { Unit, Weapon, Spell, Resource, StatName, ProficiencyType, DamageType } from '@/types';
import { STAT_NAMES, PROFICIENCY_NAMES, DAMAGE_TYPE_NAMES, PHYSICAL_DAMAGE_TYPES, ELEMENT_LIST, createDefaultUnit } from '@/types';
import { cn } from '@/utils/cn';

export function SettingsTab() {
  const { units, settings, combatLog, addUnit, deleteUnit, selectUnit, updateSettings, addNotification, clearLogs } = useGameStore();
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [showUnitEditor, setShowUnitEditor] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const handleCreateUnit = () => {
    const newUnit = createDefaultUnit();
    addUnit(newUnit);
    setEditingUnitId(newUnit.id);
    setShowUnitEditor(true);
  };

  const handleEditUnit = (id: string) => {
    setEditingUnitId(id);
    setShowUnitEditor(true);
  };

  const handleDeleteUnit = (id: string) => {
    const unit = units.find((u) => u.id === id);
    if (unit && confirm(`Удалить юнита "${unit.name}"?`)) {
      deleteUnit(id);
      addNotification({ type: 'info', title: 'Удалено', message: `Юнит "${unit.name}" удалён` });
    }
  };

  const testGoogleDocs = async () => {
    if (!settings.googleDocsUrl) {
      addNotification({ type: 'error', title: 'Ошибка', message: 'Укажите URL Web App!' });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const response = await fetch(`${settings.googleDocsUrl}?action=test`, { method: 'GET' });
      if (response.ok) {
        setTestResult('✓ Подключение успешно!');
        useGameStore.getState().setConnection('docs', 'connected');
      } else {
        setTestResult(`✕ Ошибка: ${response.status} ${response.statusText}`);
        useGameStore.getState().setConnection('docs', 'error');
      }
    } catch (err) {
      setTestResult(`✕ Ошибка: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`);
      useGameStore.getState().setConnection('docs', 'error');
    }
    setIsTesting(false);
  };

  const handleExport = () => {
    const data = { units, settings };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cursed-hearts-backup.json';
    a.click();
    URL.revokeObjectURL(url);
    addNotification({ type: 'success', title: 'Экспорт', message: 'Данные экспортированы!' });
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.units) {
          data.units.forEach((u: Unit) => addUnit(u));
        }
        if (data.settings) {
          updateSettings(data.settings);
        }
        addNotification({ type: 'success', title: 'Импорт', message: 'Данные импортированы!' });
      } catch {
        addNotification({ type: 'error', title: 'Ошибка', message: 'Некорректный файл!' });
      }
    };
    input.click();
  };

  return (
    <div className="space-y-3 animate-[fadeSlideIn_300ms]">
      {/* Unit Management */}
      <Section title="Управление юнитами" icon="👥">
        <div className="space-y-2">
          {units.length === 0 ? (
            <p className="text-xs text-[#7a6f62] italic">Нет юнитов. Создайте первого!</p>
          ) : (
            units.map((u) => (
              <div key={u.id} className="flex items-center gap-2 bg-[#161412] rounded-lg px-3 py-2 border border-[#3a332a]">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#d4c8b8] truncate">{u.name}</div>
                  <div className="text-[10px] text-[#7a6f62]">
                    HP: {u.health.current}/{u.health.max} | MP: {u.mana.current}/{u.mana.max}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => { selectUnit(u.id); addNotification({ type: 'info', title: 'Выбрано', message: u.name }); }}>👆</Button>
                <Button size="sm" variant="ghost" onClick={() => handleEditUnit(u.id)}>✏️</Button>
                <Button size="sm" variant="ghost" onClick={() => handleDeleteUnit(u.id)}>🗑️</Button>
              </div>
            ))
          )}
          <Button variant="gold" className="w-full" onClick={handleCreateUnit}>
            + Создать юнита
          </Button>
        </div>
      </Section>

      {/* Google Docs Sync */}
      <Section title="Синхронизация Google Docs" icon="📄" collapsible>
        <div className="space-y-3">
          <Input
            label="Web App URL"
            value={settings.googleDocsUrl}
            onChange={(e) => updateSettings({ googleDocsUrl: e.target.value })}
            placeholder="https://script.google.com/macros/s/..."
          />
          <div className="flex gap-2">
            <Button variant="gold" onClick={testGoogleDocs} loading={isTesting} className="flex-1">
              🔗 Тест подключения
            </Button>
          </div>
          {testResult && (
            <div className={cn(
              'p-2 rounded-lg text-xs',
              testResult.startsWith('✓') ? 'bg-[#1a2e14] text-[#a0d090]' : 'bg-[#2e1414] text-[#d09090]'
            )}>
              {testResult}
            </div>
          )}
          <div className="space-y-1">
            <Checkbox checked={settings.syncHP} onChange={(v) => updateSettings({ syncHP: v })} label="Синхронизировать HP" />
            <Checkbox checked={settings.syncMana} onChange={(v) => updateSettings({ syncMana: v })} label="Синхронизировать Ману" />
            <Checkbox checked={settings.syncResources} onChange={(v) => updateSettings({ syncResources: v })} label="Синхронизировать Ресурсы" />
            <Checkbox checked={settings.writeLogs} onChange={(v) => updateSettings({ writeLogs: v })} label="Писать логи в документ" />
          </div>
        </div>
      </Section>

      {/* Data */}
      <Section title="Данные" icon="💾" collapsible>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={handleExport}>📤 Экспорт</Button>
          <Button variant="secondary" className="flex-1" onClick={handleImport}>📥 Импорт</Button>
        </div>
      </Section>

      {/* Logs */}
      <Section title={`Логи (${combatLog.length})`} icon="📜" collapsible>
        <div className="space-y-1">
          {combatLog.length === 0 ? (
            <p className="text-xs text-[#7a6f62] italic">Нет записей</p>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={clearLogs} className="w-full mb-1">Очистить логи</Button>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {combatLog.slice(0, 20).map((log) => (
                  <div key={log.id} className="text-[11px] text-[#b8a892] px-2 py-1 bg-[#0c0a09] rounded">
                    <span className="text-[#7a6f62]">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    {' '}
                    <span className="font-bold text-[#d4a726]">{log.unitName}</span>
                    {' '}
                    {log.message}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </Section>

      {/* Unit Editor Modal */}
      {showUnitEditor && editingUnitId && (
        <UnitEditorModal
          unitId={editingUnitId}
          onClose={() => setShowUnitEditor(false)}
        />
      )}
    </div>
  );
}

// ===== UNIT EDITOR MODAL =====
function UnitEditorModal({ unitId, onClose }: { unitId: string; onClose: () => void }) {
  const unit = useGameStore((s) => s.units.find((u) => u.id === unitId));
  const updateUnit = useGameStore((s) => s.updateUnit);
  const addNotification = useGameStore((s) => s.addNotification);
  const [activeSubTab, setActiveSubTab] = useState('basic');

  if (!unit) return null;

  const subTabs = [
    { id: 'basic', label: 'Осн.' },
    { id: 'stats', label: 'Стат' },
    { id: 'prof', label: 'Влад.' },
    { id: 'magic', label: 'Маг.' },
    { id: 'weapons', label: 'Оруж.' },
    { id: 'spells', label: 'Закл.' },
    { id: 'armor', label: 'Брон.' },
    { id: 'resources', label: 'Рес.' },
  ];

  return (
    <Modal isOpen={true} onClose={onClose} title={`Редактор: ${unit.name}`} maxWidth="max-w-lg">
      <div className="space-y-3">
        <SubTabs tabs={subTabs} activeTab={activeSubTab} onTabChange={setActiveSubTab} />

        {activeSubTab === 'basic' && <BasicEditor unit={unit} onUpdate={(u) => updateUnit(unitId, u)} />}
        {activeSubTab === 'stats' && <StatsEditor unit={unit} onUpdate={(u) => updateUnit(unitId, u)} />}
        {activeSubTab === 'prof' && <ProficiencyEditor unit={unit} onUpdate={(u) => updateUnit(unitId, u)} />}
        {activeSubTab === 'magic' && <MagicEditor unit={unit} onUpdate={(u) => updateUnit(unitId, u)} />}
        {activeSubTab === 'weapons' && <WeaponsEditor unit={unit} onUpdate={(u) => updateUnit(unitId, u)} />}
        {activeSubTab === 'spells' && <SpellsEditor unit={unit} onUpdate={(u) => updateUnit(unitId, u)} onNotify={addNotification} />}
        {activeSubTab === 'armor' && <ArmorEditor unit={unit} onUpdate={(u) => updateUnit(unitId, u)} />}
        {activeSubTab === 'resources' && <ResourcesEditor unit={unit} onUpdate={(u) => updateUnit(unitId, u)} />}
      </div>
    </Modal>
  );
}

// ===== BASIC EDITOR =====
function BasicEditor({ unit, onUpdate }: { unit: Unit; onUpdate: (u: Partial<Unit>) => void }) {
  return (
    <div className="space-y-3">
      <Input label="Имя" value={unit.name} onChange={(e) => onUpdate({ name: e.target.value })} />
      <Input label="Короткое имя" value={unit.shortName} onChange={(e) => onUpdate({ shortName: e.target.value })} />
      <Input label="Заголовок в Docs" value={unit.googleDocsHeader} onChange={(e) => onUpdate({ googleDocsHeader: e.target.value })} />
      <div className="grid grid-cols-2 gap-2">
        <NumberStepper label="HP текущее" value={unit.health.current} onChange={(v) => onUpdate({ health: { ...unit.health, current: v } })} />
        <NumberStepper label="HP максимум" value={unit.health.max} onChange={(v) => onUpdate({ health: { ...unit.health, max: v } })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberStepper label="Мана текущая" value={unit.mana.current} onChange={(v) => onUpdate({ mana: { ...unit.mana, current: v } })} />
        <NumberStepper label="Мана максимум" value={unit.mana.max} onChange={(v) => onUpdate({ mana: { ...unit.mana, max: v } })} />
      </div>
      <Checkbox
        checked={unit.hasRokCards}
        onChange={(v) => onUpdate({ hasRokCards: v })}
        label="Есть Карты Рока"
      />
    </div>
  );
}

// ===== STATS EDITOR =====
function StatsEditor({ unit, onUpdate }: { unit: Unit; onUpdate: (u: Partial<Unit>) => void }) {
  const updateStat = (stat: StatName, value: number) => {
    onUpdate({ stats: { ...unit.stats, [stat]: value } });
  };

  const statDescriptions: Record<StatName, string> = {
    physicalPower: '+5 к физ урону за ед.',
    dexterity: '+3 к урону луков за ед.',
    intelligence: '+3 к маг урону за ед.',
    vitality: 'Живучесть',
    charisma: 'Харизма',
    initiative: 'Инициатива',
  };

  return (
    <div className="space-y-3">
      {(Object.keys(STAT_NAMES) as StatName[]).map((stat) => (
        <div key={stat} className="flex items-center gap-3">
          <div className="flex-1">
            <div className="text-sm text-[#d4c8b8]">{STAT_NAMES[stat]}</div>
            <div className="text-[10px] text-[#7a6f62]">{statDescriptions[stat]}</div>
          </div>
          <NumberStepper value={unit.stats[stat]} onChange={(v) => updateStat(stat, v)} min={-50} max={50} />
        </div>
      ))}
    </div>
  );
}

// ===== PROFICIENCY EDITOR =====
function ProficiencyEditor({ unit, onUpdate }: { unit: Unit; onUpdate: (u: Partial<Unit>) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-[10px] text-[#7a6f62]">Бонус к попаданию при атаке</p>
      {(Object.keys(PROFICIENCY_NAMES) as ProficiencyType[]).map((prof) => (
        <div key={prof} className="flex items-center gap-3">
          <span className="flex-1 text-sm text-[#d4c8b8]">{PROFICIENCY_NAMES[prof]}</span>
          <NumberStepper value={unit.proficiencies[prof]} onChange={(v) => onUpdate({ proficiencies: { ...unit.proficiencies, [prof]: v } })} min={0} max={50} />
        </div>
      ))}
    </div>
  );
}

// ===== MAGIC EDITOR =====
function MagicEditor({ unit, onUpdate }: { unit: Unit; onUpdate: (u: Partial<Unit>) => void }) {
  const [newElement, setNewElement] = useState('');
  const [newBonus, setNewBonus] = useState(0);

  const addMagicBonus = () => {
    if (!newElement) return;
    onUpdate({ magicBonuses: { ...unit.magicBonuses, [newElement]: newBonus } });
    setNewElement('');
    setNewBonus(0);
  };

  const removeMagicBonus = (key: string) => {
    const updated = { ...unit.magicBonuses };
    delete updated[key];
    onUpdate({ magicBonuses: updated });
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-[#7a6f62]">Бонусы к магическим элементам</p>
      {Object.entries(unit.magicBonuses).map(([el, bonus]) => (
        <div key={el} className="flex items-center gap-2 bg-[#161412] p-2 rounded-lg">
          <span className="flex-1 text-sm text-[#d4c8b8]">{el}</span>
          <NumberStepper value={bonus} onChange={(v) => onUpdate({ magicBonuses: { ...unit.magicBonuses, [el]: v } })} min={0} max={50} />
          <Button size="sm" variant="ghost" onClick={() => removeMagicBonus(el)}>🗑️</Button>
        </div>
      ))}
      <div className="flex gap-2 items-end">
        <Select
          label="Элемент"
          value={newElement}
          onChange={(e) => setNewElement(e.target.value)}
          options={[{ value: '', label: '-- Выберите --' }, ...ELEMENT_LIST.map((el) => ({ value: el, label: el }))]}
        />
        <NumberStepper label="Бонус" value={newBonus} onChange={setNewBonus} min={0} max={50} />
        <Button size="sm" variant="gold" onClick={addMagicBonus} disabled={!newElement}>+</Button>
      </div>
    </div>
  );
}

// ===== WEAPONS EDITOR =====
function WeaponsEditor({ unit, onUpdate }: { unit: Unit; onUpdate: (u: Partial<Unit>) => void }) {
  const [showForm, setShowForm] = useState(false);

  const addWeapon = (weapon: Weapon) => {
    onUpdate({ weapons: [...unit.weapons, weapon] });
    setShowForm(false);
  };

  const removeWeapon = (id: string) => {
    onUpdate({ weapons: unit.weapons.filter((w) => w.id !== id) });
  };

  return (
    <div className="space-y-2">
      {unit.weapons.map((w) => (
        <div key={w.id} className="bg-[#161412] p-2 rounded-lg border border-[#3a332a]">
          <div className="flex items-center gap-2">
            <span className="text-sm">{w.weaponType === 'melee' ? '⚔️' : '🏹'}</span>
            <span className="flex-1 text-sm font-medium text-[#d4c8b8]">{w.name}</span>
            <Button size="sm" variant="ghost" onClick={() => removeWeapon(w.id)}>🗑️</Button>
          </div>
          <div className="text-[10px] text-[#7a6f62] mt-1">
            {w.damageFormula && `Урон: ${w.damageFormula}`}
            {w.damageType && ` (${DAMAGE_TYPE_NAMES[w.damageType]})`}
            {w.hitBonus && ` | +${w.hitBonus} попад.`}
          </div>
        </div>
      ))}
      {showForm ? (
        <WeaponForm onSave={addWeapon} onCancel={() => setShowForm(false)} />
      ) : (
        <Button variant="gold" className="w-full" onClick={() => setShowForm(true)}>+ Добавить оружие</Button>
      )}
    </div>
  );
}

function WeaponForm({ onSave, onCancel }: { onSave: (w: Weapon) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [weaponType, setWeaponType] = useState<'melee' | 'ranged'>('melee');
  const [damageFormula, setDamageFormula] = useState('5d20');
  const [damageType, setDamageType] = useState<DamageType>('slashing');
  const [profType, setProfType] = useState<ProficiencyType>('swords');
  const [statBonus, setStatBonus] = useState<'physicalPower' | 'dexterity' | 'none'>('physicalPower');
  const [hitBonus, setHitBonus] = useState(0);

  return (
    <div className="bg-[#0c0a09] p-3 rounded-lg border border-[#3a332a] space-y-2">
      <Input label="Название" value={name} onChange={(e) => setName(e.target.value)} placeholder="Меч" />
      <Select
        label="Тип"
        value={weaponType}
        onChange={(e) => setWeaponType(e.target.value as 'melee' | 'ranged')}
        options={[{ value: 'melee', label: 'Ближний бой' }, { value: 'ranged', label: 'Дальний бой' }]}
      />
      <Input label="Формула урона" value={damageFormula} onChange={(e) => setDamageFormula(e.target.value)} placeholder="5d20" />
      <Select
        label="Тип урона"
        value={damageType}
        onChange={(e) => setDamageType(e.target.value as DamageType)}
        options={PHYSICAL_DAMAGE_TYPES.map((t) => ({ value: t, label: DAMAGE_TYPE_NAMES[t] }))}
      />
      <Select
        label="Владение"
        value={profType}
        onChange={(e) => setProfType(e.target.value as ProficiencyType)}
        options={Object.entries(PROFICIENCY_NAMES).map(([k, v]) => ({ value: k, label: v }))}
      />
      <Select
        label="Бонус от характ."
        value={statBonus}
        onChange={(e) => setStatBonus(e.target.value as 'physicalPower' | 'dexterity' | 'none')}
        options={[{ value: 'physicalPower', label: 'Физ. мощь (×5)' }, { value: 'dexterity', label: 'Ловкость (×3)' }, { value: 'none', label: 'Нет' }]}
      />
      {weaponType === 'ranged' && (
        <NumberStepper label="Бонус попадания" value={hitBonus} onChange={setHitBonus} min={0} max={50} />
      )}
      <div className="flex gap-2 pt-1">
        <Button variant="gold" className="flex-1" onClick={() => {
          if (!name.trim()) return;
          onSave({
            id: crypto.randomUUID(), name: name.trim(), weaponType, damageFormula, damageType,
            proficiencyType: profType, statBonus, hitBonus: weaponType === 'ranged' ? hitBonus : undefined,
            usesAmmo: weaponType === 'ranged',
          });
        }}>Сохранить</Button>
        <Button variant="secondary" onClick={onCancel}>Отмена</Button>
      </div>
    </div>
  );
}

// ===== SPELLS EDITOR =====
function SpellsEditor({ unit, onUpdate, onNotify }: { unit: Unit; onUpdate: (u: Partial<Unit>) => void; onNotify: (n: { type: 'success' | 'error'; title: string; message: string }) => void }) {
  const [showForm, setShowForm] = useState(false);

  const addSpell = (spell: Spell) => {
    onUpdate({ spells: [...unit.spells, spell] });
    setShowForm(false);
    onNotify({ type: 'success', title: 'Добавлено', message: `Заклинание "${spell.name}" добавлено` });
  };

  const removeSpell = (id: string) => {
    onUpdate({ spells: unit.spells.filter((s) => s.id !== id) });
  };

  return (
    <div className="space-y-2">
      {unit.spells.map((s) => (
        <div key={s.id} className="bg-[#161412] p-2 rounded-lg border border-[#3a332a]">
          <div className="flex items-center gap-2">
            <span className="text-sm">✨</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[#d4c8b8] truncate">{s.name}</div>
              <div className="text-[10px] text-[#7a6f62]">
                {s.manaCost} MP | {s.elements.join(', ')} | {s.type} | {s.projectiles}×
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => removeSpell(s.id)}>🗑️</Button>
          </div>
        </div>
      ))}
      {showForm ? (
        <SpellForm onSave={addSpell} onCancel={() => setShowForm(false)} />
      ) : (
        <Button variant="gold" className="w-full" onClick={() => setShowForm(true)}>+ Добавить заклинание</Button>
      )}
    </div>
  );
}

function SpellForm({ onSave, onCancel }: { onSave: (s: Spell) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [manaCost, setManaCost] = useState(10);
  const [elements, setElements] = useState<string[]>([]);
  const [type, setType] = useState<'targeted' | 'aoe' | 'self' | 'summon'>('targeted');
  const [projectiles, setProjectiles] = useState(1);
  const [canDodge, setCanDodge] = useState(true);
  const [damageFormula, setDamageFormula] = useState('3d20');
  const [description, setDescription] = useState('');

  return (
    <div className="bg-[#0c0a09] p-3 rounded-lg border border-[#3a332a] space-y-2">
      <Input label="Название" value={name} onChange={(e) => setName(e.target.value)} />
      <NumberStepper label="Стоимость маны" value={manaCost} onChange={setManaCost} min={0} max={999} />
      <div>
        <label className="block mb-1 text-[10px] uppercase tracking-wider text-[#7a6f62] font-semibold">Элементы</label>
        <div className="flex flex-wrap gap-1">
          {ELEMENT_LIST.map((el) => (
            <button
              key={el}
              onClick={() => setElements(elements.includes(el) ? elements.filter((e) => e !== el) : [...elements, el])}
              className={cn(
                'px-2 py-1 rounded text-[10px] border cursor-pointer transition-all',
                elements.includes(el) ? 'bg-[#6a5014] border-[#d4a726] text-[#ffd700]' : 'bg-[#161412] border-[#3a332a] text-[#7a6f62]'
              )}
            >
              {el}
            </button>
          ))}
        </div>
      </div>
      <Select
        label="Тип"
        value={type}
        onChange={(e) => setType(e.target.value as 'targeted' | 'aoe' | 'self' | 'summon')}
        options={[
          { value: 'targeted', label: 'Направленное' },
          { value: 'aoe', label: 'По площади' },
          { value: 'self', label: 'На себя' },
          { value: 'summon', label: 'Призыв' },
        ]}
      />
      {type === 'targeted' && (
        <>
          <NumberStepper label="Снарядов" value={projectiles} onChange={setProjectiles} min={1} max={20} />
          <Checkbox checked={canDodge} onChange={setCanDodge} label="Можно увернуться" />
        </>
      )}
      <Input label="Формула урона" value={damageFormula} onChange={(e) => setDamageFormula(e.target.value)} placeholder="3d20" />
      <Input label="Описание" value={description} onChange={(e) => setDescription(e.target.value)} />
      <div className="flex gap-2 pt-1">
        <Button variant="gold" className="flex-1" onClick={() => {
          if (!name.trim()) return;
          onSave({
            id: crypto.randomUUID(), name: name.trim(), manaCost, elements, type,
            projectiles, canDodge, damageFormula, description: description || undefined,
          });
        }}>Сохранить</Button>
        <Button variant="secondary" onClick={onCancel}>Отмена</Button>
      </div>
    </div>
  );
}

// ===== ARMOR EDITOR =====
function ArmorEditor({ unit, onUpdate }: { unit: Unit; onUpdate: (u: Partial<Unit>) => void }) {
  const [newOverrideKey, setNewOverrideKey] = useState('');
  const [newOverrideVal, setNewOverrideVal] = useState(0);
  const [newMultKey, setNewMultKey] = useState('');
  const [newMultVal, setNewMultVal] = useState(1.0);

  const updateArmor = (key: string, value: number) => {
    onUpdate({ armor: { ...unit.armor, [key]: value } });
  };

  const addMagicOverride = () => {
    if (!newOverrideKey) return;
    onUpdate({ armor: { ...unit.armor, magicOverrides: { ...unit.armor.magicOverrides, [newOverrideKey]: newOverrideVal } } });
    setNewOverrideKey('');
  };

  const removeOverride = (key: string) => {
    const updated = { ...unit.armor.magicOverrides };
    delete updated[key];
    onUpdate({ armor: { ...unit.armor, magicOverrides: updated } });
  };

  const addMultiplier = () => {
    if (!newMultKey) return;
    onUpdate({ damageMultipliers: { ...unit.damageMultipliers, [newMultKey]: newMultVal } });
    setNewMultKey('');
    setNewMultVal(1.0);
  };

  const removeMultiplier = (key: string) => {
    const updated = { ...unit.damageMultipliers };
    delete updated[key];
    onUpdate({ damageMultipliers: updated });
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-[11px] uppercase tracking-wider text-[#d4a726] font-bold mb-2">Физическая защита</h4>
        <div className="grid grid-cols-2 gap-2">
          <NumberStepper label="Режущий" value={unit.armor.slashing} onChange={(v) => updateArmor('slashing', v)} />
          <NumberStepper label="Колющий" value={unit.armor.piercing} onChange={(v) => updateArmor('piercing', v)} />
          <NumberStepper label="Дробящий" value={unit.armor.bludgeoning} onChange={(v) => updateArmor('bludgeoning', v)} />
          <NumberStepper label="Рубящий" value={unit.armor.chopping} onChange={(v) => updateArmor('chopping', v)} />
        </div>
      </div>

      <div>
        <h4 className="text-[11px] uppercase tracking-wider text-[#d4a726] font-bold mb-2">Магическая защита</h4>
        <NumberStepper label="Базовая маг. защита" value={unit.armor.magicBase} onChange={(v) => updateArmor('magicBase', v)} />
        <div className="mt-2 space-y-1">
          {Object.entries(unit.armor.magicOverrides).map(([key, val]) => (
            <div key={key} className="flex items-center gap-2 bg-[#161412] p-1.5 rounded">
              <span className="flex-1 text-xs text-[#d4c8b8]">{key}: {val}</span>
              <Button size="sm" variant="ghost" onClick={() => removeOverride(key)}>✕</Button>
            </div>
          ))}
          <div className="flex gap-1 items-end">
            <Select value={newOverrideKey} onChange={(e) => setNewOverrideKey(e.target.value)}
              options={[{ value: '', label: 'Элемент' }, ...ELEMENT_LIST.map((el) => ({ value: el, label: el }))]} />
            <NumberStepper value={newOverrideVal} onChange={setNewOverrideVal} />
            <Button size="sm" variant="gold" onClick={addMagicOverride} disabled={!newOverrideKey}>+</Button>
          </div>
        </div>
      </div>

      <NumberStepper label="Защита от нежити" value={unit.armor.undead} onChange={(v) => updateArmor('undead', v)} />

      <div>
        <h4 className="text-[11px] uppercase tracking-wider text-[#d4a726] font-bold mb-2">Множители урона</h4>
        <p className="text-[10px] text-[#7a6f62] mb-2">{'<1 = резист, >1 = уязвимость'}</p>
        {Object.entries(unit.damageMultipliers).map(([key, val]) => (
          <div key={key} className="flex items-center gap-2 bg-[#161412] p-1.5 rounded mb-1">
            <span className="flex-1 text-xs text-[#d4c8b8]">{key}: ×{val}</span>
            <Button size="sm" variant="ghost" onClick={() => removeMultiplier(key)}>✕</Button>
          </div>
        ))}
        <div className="flex gap-1 items-end">
          <Input value={newMultKey} onChange={(e) => setNewMultKey(e.target.value)} placeholder="Тип урона" />
          <input
            type="number"
            step="0.1"
            value={newMultVal}
            onChange={(e) => setNewMultVal(parseFloat(e.target.value) || 1)}
            className="w-16 h-10 px-2 bg-[#161412] text-center text-[#d4c8b8] text-sm rounded border border-[#3a332a] focus:outline-none focus:border-[#d4a726]"
          />
          <Button size="sm" variant="gold" onClick={addMultiplier} disabled={!newMultKey}>+</Button>
        </div>
      </div>
    </div>
  );
}

// ===== RESOURCES EDITOR =====
function ResourcesEditor({ unit, onUpdate }: { unit: Unit; onUpdate: (u: Partial<Unit>) => void }) {
  const [showForm, setShowForm] = useState(false);

  const addResource = (res: Resource) => {
    onUpdate({ resources: [...unit.resources, res] });
    setShowForm(false);
  };

  const removeResource = (id: string) => {
    onUpdate({ resources: unit.resources.filter((r) => r.id !== id) });
  };

  return (
    <div className="space-y-2">
      {unit.resources.map((r) => (
        <div key={r.id} className="bg-[#161412] p-2 rounded-lg border border-[#3a332a]">
          <div className="flex items-center gap-2">
            <span>{r.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-[#d4c8b8]">{r.name}</div>
              <div className="text-[10px] text-[#7a6f62]">{r.current}/{r.max} | {r.resourceType}{r.damageFormula ? ` | ${r.damageFormula}` : ''}</div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => removeResource(r.id)}>🗑️</Button>
          </div>
        </div>
      ))}
      {showForm ? (
        <ResourceForm onSave={addResource} onCancel={() => setShowForm(false)} />
      ) : (
        <Button variant="gold" className="w-full" onClick={() => setShowForm(true)}>+ Добавить ресурс</Button>
      )}
    </div>
  );
}

function ResourceForm({ onSave, onCancel }: { onSave: (r: Resource) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📦');
  const [max, setMax] = useState(10);
  const [resourceType, setResourceType] = useState<'generic' | 'arrows' | 'consumable'>('generic');
  const [damageFormula, setDamageFormula] = useState('');
  const [damageType, setDamageType] = useState<DamageType>('piercing');

  return (
    <div className="bg-[#0c0a09] p-3 rounded-lg border border-[#3a332a] space-y-2">
      <div className="flex gap-2">
        <div className="w-16"><Input label="Иконка" value={icon} onChange={(e) => setIcon(e.target.value)} /></div>
        <div className="flex-1"><Input label="Название" value={name} onChange={(e) => setName(e.target.value)} /></div>
      </div>
      <NumberStepper label="Максимум" value={max} onChange={setMax} min={1} max={999} />
      <Select
        label="Тип ресурса"
        value={resourceType}
        onChange={(e) => setResourceType(e.target.value as 'generic' | 'arrows' | 'consumable')}
        options={[
          { value: 'generic', label: 'Обычный' },
          { value: 'arrows', label: 'Стрелы' },
          { value: 'consumable', label: 'Расходник' },
        ]}
      />
      {resourceType === 'arrows' && (
        <>
          <Input label="Формула урона" value={damageFormula} onChange={(e) => setDamageFormula(e.target.value)} placeholder="3d20" />
          <Select label="Тип урона" value={damageType} onChange={(e) => setDamageType(e.target.value as DamageType)}
            options={PHYSICAL_DAMAGE_TYPES.map((t) => ({ value: t, label: DAMAGE_TYPE_NAMES[t] }))} />
        </>
      )}
      <div className="flex gap-2 pt-1">
        <Button variant="gold" className="flex-1" onClick={() => {
          if (!name.trim()) return;
          onSave({
            id: crypto.randomUUID(), name: name.trim(), icon, current: max, max,
            resourceType, damageFormula: damageFormula || undefined,
            damageType: resourceType === 'arrows' ? damageType : undefined,
          });
        }}>Сохранить</Button>
        <Button variant="secondary" onClick={onCancel}>Отмена</Button>
      </div>
    </div>
  );
}
