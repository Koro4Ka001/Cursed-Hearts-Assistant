import { useState } from 'react';
import { useGameStore } from '@/stores/useGameStore';
import { Button, Section, Input, Select, Modal, Checkbox, SubTabs, NumberStepper } from '@/components/ui';
import { googleDocsService } from '@/services/googleDocsService';
import { grimoireService } from '@/services/grimoireService';
import type { Unit, Weapon, Spell, Resource, StatName, ProficiencyType, DamageType } from '@/types';
import { STAT_NAMES, PROFICIENCY_NAMES, DAMAGE_TYPE_NAMES, DAMAGE_TYPE_ICONS, PHYSICAL_DAMAGE_TYPES, MAGICAL_DAMAGE_TYPES, ELEMENT_LIST, createDefaultUnit } from '@/types';
import { cn } from '@/utils/cn';

// All damage types for multiplier dropdown
const ALL_DAMAGE_TYPES_OPTIONS = [
  ...PHYSICAL_DAMAGE_TYPES.map(t => ({ value: t, label: `${DAMAGE_TYPE_ICONS[t]} ${DAMAGE_TYPE_NAMES[t]}` })),
  ...MAGICAL_DAMAGE_TYPES.map(t => ({ value: t, label: `${DAMAGE_TYPE_ICONS[t]} ${DAMAGE_TYPE_NAMES[t]}` })),
];

const MULTIPLIER_OPTIONS = [
  { value: '0', label: '×0 (иммун)' },
  { value: '0.25', label: '×0.25' },
  { value: '0.5', label: '×0.5 (резист)' },
  { value: '0.75', label: '×0.75' },
  { value: '1', label: '×1 (норма)' },
  { value: '1.5', label: '×1.5' },
  { value: '2', label: '×2 (уязвим)' },
  { value: '3', label: '×3' },
];

export function SettingsTab() {
  const { units, settings, combatLog, addUnit, deleteUnit, selectUnit, updateSettings, addNotification, clearLogs, setConnection } = useGameStore();
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

  const handleDeleteUnit = (id: string) => {
    const unit = units.find((u) => u.id === id);
    if (unit && confirm(`Удалить "${unit.name}"?`)) {
      deleteUnit(id);
      addNotification({ type: 'info', title: 'Удалено', message: unit.name });
    }
  };

  const testGoogleDocs = async () => {
    if (!settings.googleDocsUrl) {
      addNotification({ type: 'error', title: 'Ошибка', message: 'Укажите URL Web App!' });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    googleDocsService.setConfig(settings.googleDocsUrl, '');

    try {
      const result = await googleDocsService.testConnection();
      if (result.success) {
        setTestResult('✓ Подключение успешно!');
        setConnection('docs', 'connected');
        addNotification({ type: 'success', title: 'Google Docs', message: 'Подключение установлено!' });
      } else {
        setTestResult(`✕ ${result.error}`);
        setConnection('docs', 'error');
        addNotification({ type: 'error', title: 'Google Docs', message: result.error || 'Ошибка' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Неизвестная ошибка';
      setTestResult(`✕ ${msg}`);
      setConnection('docs', 'error');
      addNotification({ type: 'error', title: 'Google Docs', message: msg });
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
    addNotification({ type: 'success', title: 'Экспорт', message: 'Готово!' });
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
        if (data.units) data.units.forEach((u: Unit) => addUnit(u));
        if (data.settings) updateSettings(data.settings);
        addNotification({ type: 'success', title: 'Импорт', message: 'Готово!' });
      } catch {
        addNotification({ type: 'error', title: 'Ошибка', message: 'Некорректный файл!' });
      }
    };
    input.click();
  };

  return (
    <div className="space-y-2 animate-[fadeSlideIn_200ms]">
      {/* Units */}
      <Section title="Юниты" icon="👥">
        <div className="space-y-1">
          {units.length === 0 ? (
            <p className="text-[11px] text-[#7a6f62] italic">Нет юнитов</p>
          ) : (
            units.map((u) => (
              <div key={u.id} className="flex items-center gap-1 bg-[#161412] rounded-lg px-2 py-1.5 border border-[#3a332a]">
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium text-[#d4c8b8] truncate">{u.name}</div>
                  <div className="text-[9px] text-[#7a6f62]">
                    HP:{u.health.current}/{u.health.max} MP:{u.mana.current}/{u.mana.max}
                    {u.owlbearTokenId && ' 🎯'}
                  </div>
                </div>
                <button onClick={() => { selectUnit(u.id); addNotification({ type: 'info', title: 'Выбрано', message: u.name }); }}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#1a1816] text-[#7a6f62] cursor-pointer text-xs">👆</button>
                <button onClick={() => { setEditingUnitId(u.id); setShowUnitEditor(true); }}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#1a1816] text-[#7a6f62] cursor-pointer text-xs">✏️</button>
                <button onClick={() => handleDeleteUnit(u.id)}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#1a1816] text-[#7a6f62] cursor-pointer text-xs">🗑️</button>
              </div>
            ))
          )}
          <Button variant="gold" size="sm" className="w-full" onClick={handleCreateUnit}>+ Юнит</Button>
        </div>
      </Section>

      {/* Google Docs */}
      <Section title="Google Docs" icon="📄" collapsible>
        <div className="space-y-2">
          <Input label="Web App URL" value={settings.googleDocsUrl}
            onChange={(e) => {
              updateSettings({ googleDocsUrl: e.target.value });
              if (!e.target.value) setConnection('docs', 'not_configured');
            }}
            placeholder="https://script.google.com/macros/s/..." />
          <Button variant="gold" size="sm" onClick={testGoogleDocs} loading={isTesting} className="w-full">
            🔗 Тест подключения
          </Button>
          {testResult && (
            <div className={cn('p-1.5 rounded text-[11px]',
              testResult.startsWith('✓') ? 'bg-[#1a2e14] text-[#a0d090]' : 'bg-[#2e1414] text-[#d09090]')}>
              {testResult}
            </div>
          )}
          <Checkbox checked={settings.syncHP} onChange={(v) => updateSettings({ syncHP: v })} label="Синхр. HP" />
          <Checkbox checked={settings.syncMana} onChange={(v) => updateSettings({ syncMana: v })} label="Синхр. Ману" />
          <Checkbox checked={settings.syncResources} onChange={(v) => updateSettings({ syncResources: v })} label="Синхр. Ресурсы" />
          <Checkbox checked={settings.writeLogs} onChange={(v) => updateSettings({ writeLogs: v })} label="Писать логи" />
        </div>
      </Section>

      {/* Data */}
      <Section title="Данные" icon="💾" collapsible defaultOpen={false}>
        <div className="flex gap-1.5">
          <Button variant="secondary" size="sm" className="flex-1" onClick={handleExport}>📤 Экспорт</Button>
          <Button variant="secondary" size="sm" className="flex-1" onClick={handleImport}>📥 Импорт</Button>
        </div>
      </Section>

      {/* Logs */}
      <Section title={`Логи (${combatLog.length})`} icon="📜" collapsible defaultOpen={false}>
        {combatLog.length === 0 ? (
          <p className="text-[11px] text-[#7a6f62] italic">Пусто</p>
        ) : (
          <>
            <Button size="sm" variant="ghost" onClick={clearLogs} className="w-full mb-1">Очистить</Button>
            <div className="max-h-40 overflow-y-auto space-y-0.5">
              {combatLog.slice(0, 30).map((log) => (
                <div key={log.id} className="text-[10px] text-[#b8a892] px-1.5 py-0.5 bg-[#0c0a09] rounded">
                  <span className="text-[#7a6f62]">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {' '}<span className="text-[#d4a726]">{log.unitName}</span>
                  {' '}{log.message}
                </div>
              ))}
            </div>
          </>
        )}
      </Section>

      {showUnitEditor && editingUnitId && (
        <UnitEditorModal unitId={editingUnitId} onClose={() => setShowUnitEditor(false)} />
      )}
    </div>
  );
}

// ===== UNIT EDITOR =====
function UnitEditorModal({ unitId, onClose }: { unitId: string; onClose: () => void }) {
  const unit = useGameStore((s) => s.units.find((u) => u.id === unitId));
  const updateUnit = useGameStore((s) => s.updateUnit);
  const addNotification = useGameStore((s) => s.addNotification);
  const [activeSubTab, setActiveSubTab] = useState('basic');

  if (!unit) return null;

  const subTabs = [
    { id: 'basic', label: 'Осн' },
    { id: 'stats', label: 'Стат' },
    { id: 'prof', label: 'Влад' },
    { id: 'magic', label: 'Маг' },
    { id: 'weapons', label: 'Оруж' },
    { id: 'spells', label: 'Закл' },
    { id: 'armor', label: 'Брон' },
    { id: 'resources', label: 'Рес' },
  ];

  const update = (u: Partial<Unit>) => updateUnit(unitId, u);

  return (
    <Modal isOpen={true} onClose={onClose} title={unit.name} maxWidth="max-w-lg">
      <div className="space-y-2">
        <SubTabs tabs={subTabs} activeTab={activeSubTab} onTabChange={setActiveSubTab} />

        {activeSubTab === 'basic' && <BasicEditor unit={unit} onUpdate={update} />}
        {activeSubTab === 'stats' && <StatsEditor unit={unit} onUpdate={update} />}
        {activeSubTab === 'prof' && <ProficiencyEditor unit={unit} onUpdate={update} />}
        {activeSubTab === 'magic' && <MagicEditor unit={unit} onUpdate={update} />}
        {activeSubTab === 'weapons' && <WeaponsEditor unit={unit} onUpdate={update} />}
        {activeSubTab === 'spells' && <SpellsEditor unit={unit} onUpdate={update} onNotify={addNotification} />}
        {activeSubTab === 'armor' && <ArmorEditor unit={unit} onUpdate={update} />}
        {activeSubTab === 'resources' && <ResourcesEditor unit={unit} onUpdate={update} />}
      </div>
    </Modal>
  );
}

// ===== BASIC EDITOR with Token Binding =====
function BasicEditor({ unit, onUpdate }: { unit: Unit; onUpdate: (u: Partial<Unit>) => void }) {
  const [isSelectingToken, setIsSelectingToken] = useState(false);
  const addNotification = useGameStore((s) => s.addNotification);

  const handleBindToken = async () => {
    setIsSelectingToken(true);
    const tokenId = await grimoireService.selectToken();
    setIsSelectingToken(false);

    if (tokenId) {
      onUpdate({ owlbearTokenId: tokenId });
      addNotification({ type: 'success', title: 'Токен привязан!', message: `ID: ${tokenId.slice(0, 12)}...` });
    } else {
      addNotification({ type: 'warning', title: 'Отмена', message: 'Токен не выбран (таймаут)' });
    }
  };

  return (
    <div className="space-y-2">
      <Input label="Имя" value={unit.name} onChange={(e) => onUpdate({ name: e.target.value })} />
      <Input label="Короткое имя" value={unit.shortName} onChange={(e) => onUpdate({ shortName: e.target.value })} />
      <Input label="Заголовок в Docs" value={unit.googleDocsHeader} onChange={(e) => onUpdate({ googleDocsHeader: e.target.value })} placeholder="КАССИАН|КАРТОЧНЫЙ ДИЛЕР" />
      <div className="grid grid-cols-2 gap-2">
        <NumberStepper label="HP тек." value={unit.health.current} onChange={(v) => onUpdate({ health: { ...unit.health, current: v } })} />
        <NumberStepper label="HP макс." value={unit.health.max} onChange={(v) => onUpdate({ health: { ...unit.health, max: v } })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberStepper label="Мана тек." value={unit.mana.current} onChange={(v) => onUpdate({ mana: { ...unit.mana, current: v } })} />
        <NumberStepper label="Мана макс." value={unit.mana.max} onChange={(v) => onUpdate({ mana: { ...unit.mana, max: v } })} />
      </div>
      <Checkbox checked={unit.hasRokCards} onChange={(v) => onUpdate({ hasRokCards: v })} label="Есть Карты Рока" />

      {/* Token Binding */}
      <div className="p-2.5 border border-[#3a332a] bg-[#0c0a09] rounded-lg">
        <div className="text-[10px] text-[#d4a726] uppercase font-bold mb-1.5">🎯 Привязка к токену (Grimoire)</div>
        {unit.owlbearTokenId ? (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#a0d090] flex-1">✓ Привязан: {unit.owlbearTokenId.slice(0, 16)}...</span>
            <button onClick={() => onUpdate({ owlbearTokenId: undefined })}
              className="text-[10px] text-[#d09090] underline cursor-pointer hover:text-[#ff6060]">Отвязать</button>
          </div>
        ) : (
          <Button variant="secondary" size="sm" className="w-full" onClick={handleBindToken} loading={isSelectingToken} disabled={isSelectingToken}>
            {isSelectingToken ? '⏳ Кликните на токен...' : '🎯 Привязать токен на карте'}
          </Button>
        )}
        <p className="text-[9px] text-[#4a433a] mt-1">HP токена будет обновляться при изменениях</p>
      </div>
    </div>
  );
}

function StatsEditor({ unit, onUpdate }: { unit: Unit; onUpdate: (u: Partial<Unit>) => void }) {
  const hints: Record<StatName, string> = {
    physicalPower: '+5/ед к физ.урону', dexterity: '+3/ед к луч.урону', intelligence: '+3/ед к маг.урону',
    vitality: '', charisma: '', initiative: '',
  };
  return (
    <div className="space-y-2">
      {(Object.keys(STAT_NAMES) as StatName[]).map((stat) => (
        <div key={stat} className="flex items-center gap-2">
          <div className="flex-1">
            <div className="text-[12px] text-[#d4c8b8]">{STAT_NAMES[stat]}</div>
            {hints[stat] && <div className="text-[9px] text-[#7a6f62]">{hints[stat]}</div>}
          </div>
          <NumberStepper value={unit.stats[stat]} onChange={(v) => onUpdate({ stats: { ...unit.stats, [stat]: v } })} min={-50} max={50} />
        </div>
      ))}
    </div>
  );
}

function ProficiencyEditor({ unit, onUpdate }: { unit: Unit; onUpdate: (u: Partial<Unit>) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-[9px] text-[#7a6f62]">Бонус к попаданию</p>
      {(Object.keys(PROFICIENCY_NAMES) as ProficiencyType[]).map((prof) => (
        <div key={prof} className="flex items-center gap-2">
          <span className="flex-1 text-[12px] text-[#d4c8b8]">{PROFICIENCY_NAMES[prof]}</span>
          <NumberStepper value={unit.proficiencies[prof]} onChange={(v) => onUpdate({ proficiencies: { ...unit.proficiencies, [prof]: v } })} max={50} />
        </div>
      ))}
    </div>
  );
}

function MagicEditor({ unit, onUpdate }: { unit: Unit; onUpdate: (u: Partial<Unit>) => void }) {
  const [newEl, setNewEl] = useState('');
  const [newBonus, setNewBonus] = useState(0);
  return (
    <div className="space-y-2">
      <p className="text-[9px] text-[#7a6f62]">Бонусы к элементам</p>
      {Object.entries(unit.magicBonuses).map(([el, bonus]) => (
        <div key={el} className="flex items-center gap-1.5 bg-[#161412] p-1.5 rounded">
          <span className="flex-1 text-[12px] text-[#d4c8b8]">{el}</span>
          <NumberStepper value={bonus} onChange={(v) => onUpdate({ magicBonuses: { ...unit.magicBonuses, [el]: v } })} max={50} />
          <button onClick={() => { const u = { ...unit.magicBonuses }; delete u[el]; onUpdate({ magicBonuses: u }); }}
            className="w-6 h-6 flex items-center justify-center text-[#7a6f62] hover:text-[#d09090] cursor-pointer text-xs">✕</button>
        </div>
      ))}
      <div className="flex gap-1 items-end">
        <Select value={newEl} onChange={(e) => setNewEl(e.target.value)}
          options={[{ value: '', label: '—' }, ...ELEMENT_LIST.filter(e => !(e in unit.magicBonuses)).map((el) => ({ value: el, label: el }))]} />
        <NumberStepper value={newBonus} onChange={setNewBonus} max={50} />
        <Button size="sm" variant="gold" onClick={() => { if (newEl) { onUpdate({ magicBonuses: { ...unit.magicBonuses, [newEl]: newBonus } }); setNewEl(''); setNewBonus(0); } }} disabled={!newEl}>+</Button>
      </div>
    </div>
  );
}

function WeaponsEditor({ unit, onUpdate }: { unit: Unit; onUpdate: (u: Partial<Unit>) => void }) {
  const [showForm, setShowForm] = useState(false);
  return (
    <div className="space-y-1.5">
      {unit.weapons.map((w) => (
        <div key={w.id} className="bg-[#161412] p-1.5 rounded border border-[#3a332a] flex items-center gap-1.5">
          <span className="text-xs">{w.weaponType === 'melee' ? '⚔️' : '🏹'}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-medium text-[#d4c8b8] truncate">{w.name}</div>
            <div className="text-[9px] text-[#7a6f62]">{w.damageFormula} {w.damageType && DAMAGE_TYPE_NAMES[w.damageType]}</div>
          </div>
          <button onClick={() => onUpdate({ weapons: unit.weapons.filter((x) => x.id !== w.id) })}
            className="w-6 h-6 flex items-center justify-center text-[#7a6f62] hover:text-[#d09090] cursor-pointer text-xs">✕</button>
        </div>
      ))}
      {showForm ? (
        <WeaponForm onSave={(w) => { onUpdate({ weapons: [...unit.weapons, w] }); setShowForm(false); }} onCancel={() => setShowForm(false)} />
      ) : (
        <Button variant="gold" size="sm" className="w-full" onClick={() => setShowForm(true)}>+ Оружие</Button>
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
    <div className="bg-[#0c0a09] p-2 rounded border border-[#3a332a] space-y-1.5">
      <Input label="Название" value={name} onChange={(e) => setName(e.target.value)} placeholder="Меч" />
      <Select label="Тип" value={weaponType} onChange={(e) => setWeaponType(e.target.value as 'melee' | 'ranged')}
        options={[{ value: 'melee', label: 'Ближний' }, { value: 'ranged', label: 'Дальний' }]} />
      <Input label="Урон" value={damageFormula} onChange={(e) => setDamageFormula(e.target.value)} placeholder="5d20" />
      <Select label="Тип урона" value={damageType} onChange={(e) => setDamageType(e.target.value as DamageType)}
        options={PHYSICAL_DAMAGE_TYPES.map((t) => ({ value: t, label: DAMAGE_TYPE_NAMES[t] }))} />
      <Select label="Владение" value={profType} onChange={(e) => setProfType(e.target.value as ProficiencyType)}
        options={Object.entries(PROFICIENCY_NAMES).map(([k, v]) => ({ value: k, label: v }))} />
      <Select label="Бонус от" value={statBonus} onChange={(e) => setStatBonus(e.target.value as 'physicalPower' | 'dexterity' | 'none')}
        options={[{ value: 'physicalPower', label: 'Физ.мощь (×5)' }, { value: 'dexterity', label: 'Ловкость (×3)' }, { value: 'none', label: 'Нет' }]} />
      {weaponType === 'ranged' && <NumberStepper label="Бонус попад." value={hitBonus} onChange={setHitBonus} max={50} />}
      <div className="flex gap-1.5 pt-1">
        <Button variant="gold" size="sm" className="flex-1" onClick={() => {
          if (!name.trim()) return;
          onSave({ id: crypto.randomUUID(), name: name.trim(), weaponType, damageFormula, damageType, proficiencyType: profType, statBonus, hitBonus: weaponType === 'ranged' ? hitBonus : undefined, usesAmmo: weaponType === 'ranged' });
        }}>Сохранить</Button>
        <Button variant="secondary" size="sm" onClick={onCancel}>Отмена</Button>
      </div>
    </div>
  );
}

function SpellsEditor({ unit, onUpdate, onNotify }: { unit: Unit; onUpdate: (u: Partial<Unit>) => void; onNotify: (n: { type: 'success' | 'error'; title: string; message: string }) => void }) {
  const [showForm, setShowForm] = useState(false);
  return (
    <div className="space-y-1.5">
      {unit.spells.map((s) => (
        <div key={s.id} className="bg-[#161412] p-1.5 rounded border border-[#3a332a] flex items-center gap-1.5">
          <span className="text-xs">✨</span>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-medium text-[#d4c8b8] truncate">{s.name}</div>
            <div className="text-[9px] text-[#7a6f62]">{s.manaCost}MP {s.elements.join(',')} {s.type} {s.projectiles}×</div>
          </div>
          <button onClick={() => onUpdate({ spells: unit.spells.filter((x) => x.id !== s.id) })}
            className="w-6 h-6 flex items-center justify-center text-[#7a6f62] hover:text-[#d09090] cursor-pointer text-xs">✕</button>
        </div>
      ))}
      {showForm ? (
        <SpellForm onSave={(s) => { onUpdate({ spells: [...unit.spells, s] }); setShowForm(false); onNotify({ type: 'success', title: 'Добавлено', message: s.name }); }}
          onCancel={() => setShowForm(false)} />
      ) : (
        <Button variant="gold" size="sm" className="w-full" onClick={() => setShowForm(true)}>+ Заклинание</Button>
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
    <div className="bg-[#0c0a09] p-2 rounded border border-[#3a332a] space-y-1.5">
      <Input label="Название" value={name} onChange={(e) => setName(e.target.value)} />
      <NumberStepper label="Мана" value={manaCost} onChange={setManaCost} max={999} />
      <div>
        <label className="block mb-0.5 text-[10px] uppercase tracking-wider text-[#7a6f62] font-semibold">Элементы</label>
        <div className="flex flex-wrap gap-0.5">
          {ELEMENT_LIST.map((el) => (
            <button key={el} onClick={() => setElements(elements.includes(el) ? elements.filter((e) => e !== el) : [...elements, el])}
              className={cn('px-1.5 py-0.5 rounded text-[9px] border cursor-pointer transition-all',
                elements.includes(el) ? 'bg-[#6a5014] border-[#d4a726] text-[#ffd700]' : 'bg-[#161412] border-[#3a332a] text-[#7a6f62]'
              )}>{el}</button>
          ))}
        </div>
      </div>
      <Select label="Тип" value={type} onChange={(e) => setType(e.target.value as 'targeted' | 'aoe' | 'self' | 'summon')}
        options={[{ value: 'targeted', label: 'Направленное' }, { value: 'aoe', label: 'По площади' }, { value: 'self', label: 'На себя' }, { value: 'summon', label: 'Призыв' }]} />
      {type === 'targeted' && (
        <>
          <NumberStepper label="Снарядов" value={projectiles} onChange={setProjectiles} min={1} max={20} />
          <Checkbox checked={canDodge} onChange={setCanDodge} label="Можно увернуться" />
        </>
      )}
      <Input label="Формула урона" value={damageFormula} onChange={(e) => setDamageFormula(e.target.value)} placeholder="3d20" />
      <Input label="Описание" value={description} onChange={(e) => setDescription(e.target.value)} />
      <div className="flex gap-1.5 pt-1">
        <Button variant="gold" size="sm" className="flex-1" onClick={() => {
          if (!name.trim()) return;
          onSave({ id: crypto.randomUUID(), name: name.trim(), manaCost, elements, type, projectiles, canDodge, damageFormula, description: description || undefined });
        }}>Сохранить</Button>
        <Button variant="secondary" size="sm" onClick={onCancel}>Отмена</Button>
      </div>
    </div>
  );
}

// ===== ARMOR EDITOR — with dropdown-based multipliers =====
function ArmorEditor({ unit, onUpdate }: { unit: Unit; onUpdate: (u: Partial<Unit>) => void }) {
  const [newOverrideKey, setNewOverrideKey] = useState('');
  const [newOverrideVal, setNewOverrideVal] = useState(0);
  const [newMultType, setNewMultType] = useState('');
  const [newMultVal, setNewMultVal] = useState('1');

  const updateArmor = (key: string, value: number) => {
    onUpdate({ armor: { ...unit.armor, [key]: value } });
  };

  const availableMultTypes = ALL_DAMAGE_TYPES_OPTIONS.filter(t => !(t.value in unit.damageMultipliers));

  return (
    <div className="space-y-3">
      {/* Physical Armor */}
      <div>
        <h4 className="text-[10px] uppercase tracking-wider text-[#d4a726] font-bold mb-1">⚔️ Физ. защита</h4>
        <div className="grid grid-cols-2 gap-1.5">
          <NumberStepper label="Режущий" value={unit.armor.slashing} onChange={(v) => updateArmor('slashing', v)} />
          <NumberStepper label="Колющий" value={unit.armor.piercing} onChange={(v) => updateArmor('piercing', v)} />
          <NumberStepper label="Дробящий" value={unit.armor.bludgeoning} onChange={(v) => updateArmor('bludgeoning', v)} />
          <NumberStepper label="Рубящий" value={unit.armor.chopping} onChange={(v) => updateArmor('chopping', v)} />
        </div>
      </div>

      {/* Magic Armor */}
      <div>
        <h4 className="text-[10px] uppercase tracking-wider text-[#d4a726] font-bold mb-1">✨ Маг. защита</h4>
        <NumberStepper label="Базовая" value={unit.armor.magicBase} onChange={(v) => updateArmor('magicBase', v)} />
        <div className="mt-1.5">
          <p className="text-[9px] text-[#7a6f62] mb-1">Особая защита от элементов:</p>
          <div className="space-y-0.5">
            {Object.entries(unit.armor.magicOverrides).map(([key, val]) => (
              <div key={key} className="flex items-center gap-1 bg-[#161412] px-2 py-1 rounded text-[11px]">
                <span className="flex-1 text-[#d4c8b8]">{key}</span>
                <span className="text-[#b8a892] font-mono">{val}</span>
                <button onClick={() => { const u = { ...unit.armor.magicOverrides }; delete u[key]; onUpdate({ armor: { ...unit.armor, magicOverrides: u } }); }}
                  className="w-5 h-5 text-[#7a6f62] hover:text-[#d09090] cursor-pointer text-[10px]">✕</button>
              </div>
            ))}
          </div>
          <div className="flex gap-0.5 items-end mt-1">
            <Select value={newOverrideKey} onChange={(e) => setNewOverrideKey(e.target.value)}
              options={[{ value: '', label: '—' }, ...ELEMENT_LIST.filter(e => !(e in unit.armor.magicOverrides)).map((el) => ({ value: el, label: el }))]} />
            <NumberStepper value={newOverrideVal} onChange={setNewOverrideVal} />
            <Button size="sm" variant="gold" onClick={() => {
              if (!newOverrideKey) return;
              onUpdate({ armor: { ...unit.armor, magicOverrides: { ...unit.armor.magicOverrides, [newOverrideKey]: newOverrideVal } } });
              setNewOverrideKey('');
            }}>+</Button>
          </div>
        </div>
      </div>

      <NumberStepper label="💀 От нежити" value={unit.armor.undead} onChange={(v) => updateArmor('undead', v)} />

      {/* DAMAGE MULTIPLIERS — DROPDOWN */}
      <div>
        <h4 className="text-[10px] uppercase tracking-wider text-[#d4a726] font-bold mb-1">📊 Множители урона</h4>
        <p className="text-[9px] text-[#4a433a] mb-1.5">{'<1 = резист, >1 = уязвимость'}</p>

        {/* Current multipliers */}
        <div className="space-y-0.5 mb-1.5">
          {Object.entries(unit.damageMultipliers).map(([type, value]) => {
            const info = ALL_DAMAGE_TYPES_OPTIONS.find(t => t.value === type);
            return (
              <div key={type} className="flex items-center justify-between px-2 py-1 bg-[#0a0806] border border-[#2a2520] rounded">
                <span className="text-[11px]">{info?.label || type}</span>
                <div className="flex items-center gap-1.5">
                  <span className={cn('text-[11px] font-bold font-mono',
                    value < 1 ? 'text-[#a0d090]' : value > 1 ? 'text-[#d09090]' : 'text-[#7a6f62]')}>
                    ×{value}
                  </span>
                  <button onClick={() => { const u = { ...unit.damageMultipliers }; delete u[type]; onUpdate({ damageMultipliers: u }); }}
                    className="w-5 h-5 text-[#5a1c1c] hover:text-[#d09090] cursor-pointer text-[10px]">✕</button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add new multiplier — DROPDOWNS */}
        {availableMultTypes.length > 0 && (
          <div className="flex gap-1 items-end">
            <div className="flex-1">
              <select value={newMultType} onChange={(e) => setNewMultType(e.target.value)}
                className="w-full h-9 px-2 bg-[#161412] border border-[#3a332a] text-[#d4c8b8] text-[12px] rounded-lg focus:outline-none focus:border-[#d4a726] cursor-pointer appearance-none">
                <option value="">Тип урона...</option>
                {availableMultTypes.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <select value={newMultVal} onChange={(e) => setNewMultVal(e.target.value)}
              className="w-24 h-9 px-2 bg-[#161412] border border-[#3a332a] text-[#d4c8b8] text-[12px] rounded-lg focus:outline-none focus:border-[#d4a726] cursor-pointer appearance-none">
              {MULTIPLIER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <Button size="sm" variant="gold" onClick={() => {
              if (!newMultType) return;
              onUpdate({ damageMultipliers: { ...unit.damageMultipliers, [newMultType]: parseFloat(newMultVal) } });
              setNewMultType('');
              setNewMultVal('1');
            }} disabled={!newMultType} className="h-9">+</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ResourcesEditor({ unit, onUpdate }: { unit: Unit; onUpdate: (u: Partial<Unit>) => void }) {
  const [showForm, setShowForm] = useState(false);
  return (
    <div className="space-y-1.5">
      {unit.resources.map((r) => (
        <div key={r.id} className="bg-[#161412] p-1.5 rounded border border-[#3a332a] flex items-center gap-1.5">
          <span>{r.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-[#d4c8b8]">{r.name}</div>
            <div className="text-[9px] text-[#7a6f62]">{r.current}/{r.max} {r.resourceType}{r.damageFormula ? ` ${r.damageFormula}` : ''}</div>
          </div>
          <button onClick={() => onUpdate({ resources: unit.resources.filter((x) => x.id !== r.id) })}
            className="w-6 h-6 flex items-center justify-center text-[#7a6f62] hover:text-[#d09090] cursor-pointer text-xs">✕</button>
        </div>
      ))}
      {showForm ? (
        <ResourceForm onSave={(r) => { onUpdate({ resources: [...unit.resources, r] }); setShowForm(false); }} onCancel={() => setShowForm(false)} />
      ) : (
        <Button variant="gold" size="sm" className="w-full" onClick={() => setShowForm(true)}>+ Ресурс</Button>
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
  const [syncWithDocs, setSyncWithDocs] = useState(false);

  return (
    <div className="bg-[#0c0a09] p-2 rounded border border-[#3a332a] space-y-1.5">
      <div className="flex gap-1.5">
        <div className="w-14"><Input label="Иконка" value={icon} onChange={(e) => setIcon(e.target.value)} /></div>
        <div className="flex-1"><Input label="Название" value={name} onChange={(e) => setName(e.target.value)} /></div>
      </div>
      <NumberStepper label="Макс." value={max} onChange={setMax} min={1} max={999} />
      <Select label="Тип" value={resourceType} onChange={(e) => setResourceType(e.target.value as 'generic' | 'arrows' | 'consumable')}
        options={[{ value: 'generic', label: 'Обычный' }, { value: 'arrows', label: 'Стрелы' }, { value: 'consumable', label: 'Расходник' }]} />
      {resourceType === 'arrows' && (
        <>
          <Input label="Формула урона" value={damageFormula} onChange={(e) => setDamageFormula(e.target.value)} placeholder="3d20" />
          <Select label="Тип урона" value={damageType} onChange={(e) => setDamageType(e.target.value as DamageType)}
            options={PHYSICAL_DAMAGE_TYPES.map((t) => ({ value: t, label: DAMAGE_TYPE_NAMES[t] }))} />
        </>
      )}
      <Checkbox checked={syncWithDocs} onChange={setSyncWithDocs} label="Синхр. с Docs" />
      <div className="flex gap-1.5 pt-1">
        <Button variant="gold" size="sm" className="flex-1" onClick={() => {
          if (!name.trim()) return;
          onSave({ id: crypto.randomUUID(), name: name.trim(), icon, current: max, max, resourceType,
            damageFormula: damageFormula || undefined, damageType: resourceType === 'arrows' ? damageType : undefined, syncWithDocs });
        }}>Сохранить</Button>
        <Button variant="secondary" size="sm" onClick={onCancel}>Отмена</Button>
      </div>
    </div>
  );
}
