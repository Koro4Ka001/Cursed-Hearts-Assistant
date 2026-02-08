import { useState } from 'react';
import { useGameStore } from '@/stores/useGameStore';
import { Button, Section, Modal, Input, Select, Checkbox, ConfirmDialog } from '@/components/ui';
import { DAMAGE_TYPE_NAMES, DAMAGE_TYPE_ICONS, PHYSICAL_DAMAGE_TYPES, MAGICAL_DAMAGE_TYPES } from '@/constants/damageTypes';
import { PROFICIENCY_NAMES, STAT_FULL_NAMES, STAT_NAMES } from '@/constants/proficiencies';
import type {
  Unit, Weapon, Spell, Resource, QuickAction,
  DamageType, ProficiencyType, StatBonusType,
} from '@/types';
import { cn } from '@/utils/cn';

// ========== CONSTANTS ==========

const MAGIC_ELEMENTS = MAGICAL_DAMAGE_TYPES.map(t => DAMAGE_TYPE_NAMES[t]);

const DAMAGE_TYPE_OPTIONS = [
  ...PHYSICAL_DAMAGE_TYPES.map(t => ({ value: t, label: `${DAMAGE_TYPE_ICONS[t]} ${DAMAGE_TYPE_NAMES[t]}` })),
  ...MAGICAL_DAMAGE_TYPES.map(t => ({ value: t, label: `${DAMAGE_TYPE_ICONS[t]} ${DAMAGE_TYPE_NAMES[t]}` })),
  { value: 'pure', label: '⚪ Чистый' },
];

const PROF_OPTIONS: { value: string; label: string }[] = [
  { value: 'swords', label: '⚔️ Мечи' },
  { value: 'axes', label: '🪓 Топоры' },
  { value: 'hammers', label: '🔨 Молоты' },
  { value: 'polearms', label: '🔱 Древковое' },
  { value: 'unarmed', label: '👊 Рукопашный' },
  { value: 'bows', label: '🏹 Луки' },
];

const STAT_BONUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'physicalPower', label: 'Физ. мощь (+5/ед)' },
  { value: 'dexterity', label: 'Ловкость (+3/ед)' },
  { value: 'intelligence', label: 'Интеллект (+3/ед)' },
  { value: 'none', label: 'Нет бонуса' },
];

const SPELL_TYPE_OPTIONS = [
  { value: 'targeted', label: '🎯 По цели' },
  { value: 'aoe', label: '💫 По области' },
  { value: 'self', label: '🛡️ На себя' },
  { value: 'summon', label: '👻 Призыв' },
];

const STAT_KEYS = ['physicalPower', 'dexterity', 'intelligence', 'vitality', 'charisma', 'initiative'] as const;
const PROF_KEYS = ['swords', 'axes', 'hammers', 'polearms', 'unarmed', 'bows'] as const;

type SettingsView = 'main' | 'editUnit';
type EditSubTab = 'basic' | 'stats' | 'prof' | 'magic' | 'weapons' | 'spells' | 'resources' | 'actions';

const EDIT_TABS: { id: EditSubTab; icon: string; label: string }[] = [
  { id: 'basic', icon: '📋', label: 'Осн' },
  { id: 'stats', icon: '💪', label: 'Стат' },
  { id: 'prof', icon: '⚔️', label: 'Влад' },
  { id: 'magic', icon: '✨', label: 'Маг' },
  { id: 'weapons', icon: '🗡️', label: 'Оруж' },
  { id: 'spells', icon: '📖', label: 'Закл' },
  { id: 'resources', icon: '📦', label: 'Рес' },
  { id: 'actions', icon: '🎯', label: 'Дейст' },
];

// ========== MAIN COMPONENT ==========

export function SettingsTab() {
  const store = useGameStore();
  const { units, settings, logs } = store;

  const [view, setView] = useState<SettingsView>('main');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubTab, setEditSubTab] = useState<EditSubTab>('basic');

  // New unit
  const [showNewUnit, setShowNewUnit] = useState(false);
  const [newName, setNewName] = useState('');
  const [newShortName, setNewShortName] = useState('');
  const [newHpMax, setNewHpMax] = useState('100');
  const [newManaMax, setNewManaMax] = useState('50');

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);

  // Item modals
  const [weaponModal, setWeaponModal] = useState<{ open: boolean; editing?: Weapon }>({ open: false });
  const [spellModal, setSpellModal] = useState<{ open: boolean; editing?: Spell }>({ open: false });
  const [resourceModal, setResourceModal] = useState<{ open: boolean; editing?: Resource }>({ open: false });
  const [actionModal, setActionModal] = useState<{ open: boolean; editing?: QuickAction }>({ open: false });

  const editingUnit = editingId ? store.getUnitById(editingId) : null;

  // ========== HANDLERS ==========

  const handleCreateUnit = () => {
    if (!newName.trim()) return;
    const id = store.addUnit({
      name: newName.trim(),
      shortName: newShortName.trim() || newName.trim().slice(0, 4),
      googleDocsHeader: newName.trim(),
      health: { current: parseInt(newHpMax) || 100, max: parseInt(newHpMax) || 100 },
      mana: { current: parseInt(newManaMax) || 50, max: parseInt(newManaMax) || 50 },
      stats: { physicalPower: 1, dexterity: 1, intelligence: 1, vitality: 1, charisma: 1, initiative: 1 },
      proficiencies: { swords: 0, axes: 0, hammers: 0, polearms: 0, unarmed: 0, bows: 0 },
      magicBonuses: {},
      weapons: [],
      spells: [],
      resources: [],
      quickActions: [],
      hasRokCards: false,
    });
    store.addLog(`⚙️ Создан юнит: ${newName.trim()}`, 'action');
    setNewName(''); setNewShortName(''); setNewHpMax('100'); setNewManaMax('50');
    setShowNewUnit(false);
    setEditingId(id);
    setEditSubTab('basic');
    setView('editUnit');
  };

  const handleDeleteUnit = (id: string) => {
    const u = store.getUnitById(id);
    store.deleteUnit(id);
    store.addLog(`⚙️ Удалён юнит: ${u?.name || id}`, 'action');
    if (editingId === id) { setView('main'); setEditingId(null); }
    setDeleteTarget(null);
  };

  // ========== RENDER: MAIN VIEW ==========

  if (view === 'editUnit' && editingUnit) {
    return renderUnitEditor(editingUnit);
  }

  return (
    <div className="space-y-3 animate-fade-in">
      {/* UNITS */}
      <Section title="Юниты" icon="👥" actions={
        <Button variant="gold" size="sm" onClick={() => setShowNewUnit(true)}>+ Добавить</Button>
      }>
        {units.length === 0 ? (
          <p className="text-xs text-faded">Нет юнитов. Создайте первого!</p>
        ) : (
          <div className="space-y-1">
            {units.map(u => (
              <div key={u.id} className="flex items-center gap-2 p-2 rounded-lg bg-input border border-border-bone hover:border-faded transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-bone truncate">{u.name}</div>
                  <div className="text-[10px] text-faded">
                    HP {u.health.current}/{u.health.max} • MP {u.mana.current}/{u.mana.max} •
                    {u.weapons.length}⚔ {u.spells.length}📖 {u.resources.length}📦
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => { setEditingId(u.id); setEditSubTab('basic'); setView('editUnit'); }}>✏️</Button>
                <Button variant="danger" size="sm" onClick={() => setDeleteTarget(u.id)}>🗑</Button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* SETTINGS */}
      <Section title="Синхронизация" icon="🔄" collapsible defaultOpen={false}>
        <div className="space-y-2">
          <Input
            label="URL Google Apps Script"
            value={settings.webAppUrl}
            onChange={e => store.updateSettings({ webAppUrl: e.target.value })}
            placeholder="https://script.google.com/..."
          />
          <Checkbox label="Синхр. HP при изменении" checked={settings.syncHpOnChange} onChange={v => store.updateSettings({ syncHpOnChange: v })} />
          <Checkbox label="Синхр. ману при изменении" checked={settings.syncManaOnChange} onChange={v => store.updateSettings({ syncManaOnChange: v })} />
          <Checkbox label="Синхр. ресурсы при изменении" checked={settings.syncResourcesOnChange} onChange={v => store.updateSettings({ syncResourcesOnChange: v })} />
        </div>
      </Section>

      {/* LOGS */}
      <Section title={`Логи (${logs.length})`} icon="📜" collapsible defaultOpen={false} actions={
        logs.length > 0 ? <Button variant="ghost" size="sm" onClick={store.clearLogs}>Очистить</Button> : undefined
      }>
        {logs.length === 0 ? (
          <p className="text-xs text-faded">Пусто</p>
        ) : (
          <div className="max-h-60 overflow-y-auto space-y-0.5">
            {logs.map((log, i) => {
              const time = new Date(log.timestamp);
              const timeStr = time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              const colors: Record<string, string> = {
                action: 'text-ancient', damage: 'text-blood-bright', heal: 'text-success-text',
                spell: 'text-mana-bright', resource: 'text-gold', error: 'text-error-text',
              };
              return (
                <div key={i} className={cn('text-[10px] py-0.5', colors[log.type] || 'text-faded')}>
                  <span className="text-dim mr-1">{timeStr}</span>{log.message}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* DANGER ZONE */}
      <Section title="Опасная зона" icon="⚠️" collapsible defaultOpen={false}>
        <Button variant="danger" size="sm" className="w-full" onClick={() => setResetConfirm(true)}>
          🗑 Сбросить ВСЕ данные
        </Button>
      </Section>

      {/* MODALS */}
      <Modal open={showNewUnit} onClose={() => setShowNewUnit(false)} title="Новый юнит" size="sm">
        <div className="space-y-3">
          <Input label="Имя" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Кассиан" />
          <Input label="Короткое имя" value={newShortName} onChange={e => setNewShortName(e.target.value)} placeholder="Касс" />
          <div className="grid grid-cols-2 gap-2">
            <Input label="HP макс" type="number" value={newHpMax} onChange={e => setNewHpMax(e.target.value)} />
            <Input label="Мана макс" type="number" value={newManaMax} onChange={e => setNewManaMax(e.target.value)} />
          </div>
          <Button variant="gold" className="w-full" onClick={handleCreateUnit} disabled={!newName.trim()}>
            Создать юнита
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDeleteUnit(deleteTarget)}
        title="Удалить юнита?"
        message="Все данные юнита будут потеряны безвозвратно."
      />

      <ConfirmDialog
        open={resetConfirm}
        onClose={() => setResetConfirm(false)}
        onConfirm={() => { store.resetAll(); setResetConfirm(false); }}
        title="Сбросить всё?"
        message="ВСЕ юниты, настройки и логи будут удалены!"
      />
    </div>
  );

  // ========== RENDER: UNIT EDITOR ==========

  function renderUnitEditor(unit: Unit) {
    return (
      <div className="space-y-2 animate-fade-in">
        {/* Back + Unit name */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setView('main'); setEditingId(null); }}>
            ← Назад
          </Button>
          <span className="text-sm font-bold text-gold truncate flex-1">{unit.name}</span>
        </div>

        {/* Sub-tab bar */}
        <div className="flex flex-wrap gap-0.5">
          {EDIT_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setEditSubTab(tab.id)}
              className={cn(
                'px-2 py-1 text-[10px] border rounded transition-all cursor-pointer',
                editSubTab === tab.id
                  ? 'border-gold text-gold-bright bg-gold-dark/20'
                  : 'border-border-bone text-dim hover:text-faded'
              )}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Sub-tab content */}
        <div className="animate-fade-in">
          {editSubTab === 'basic' && renderBasicInfo(unit)}
          {editSubTab === 'stats' && renderStats(unit)}
          {editSubTab === 'prof' && renderProficiencies(unit)}
          {editSubTab === 'magic' && renderMagicBonuses(unit)}
          {editSubTab === 'weapons' && renderWeapons(unit)}
          {editSubTab === 'spells' && renderSpells(unit)}
          {editSubTab === 'resources' && renderResources(unit)}
          {editSubTab === 'actions' && renderActions(unit)}
        </div>

        {/* Item modals */}
        {renderWeaponModal(unit)}
        {renderSpellModal(unit)}
        {renderResourceModal(unit)}
        {renderActionModal(unit)}
      </div>
    );
  }

  // ========== BASIC INFO ==========

  function renderBasicInfo(unit: Unit) {
    return (
      <Section title="Основная информация" icon="📋">
        <div className="space-y-2">
          <Input label="Имя" value={unit.name} onChange={e => store.updateUnit(unit.id, { name: e.target.value })} />
          <Input label="Короткое имя" value={unit.shortName} onChange={e => store.updateUnit(unit.id, { shortName: e.target.value })} />
          <Input label="Заголовок Google Docs" value={unit.googleDocsHeader} onChange={e => store.updateUnit(unit.id, { googleDocsHeader: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Input label="HP текущие" type="number" value={unit.health.current}
              onChange={e => store.setHealth(unit.id, parseInt(e.target.value) || 0)} />
            <Input label="HP максимум" type="number" value={unit.health.max}
              onChange={e => store.setHealth(unit.id, unit.health.current, parseInt(e.target.value) || 1)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Мана текущая" type="number" value={unit.mana.current}
              onChange={e => store.setMana(unit.id, parseInt(e.target.value) || 0)} />
            <Input label="Мана максимум" type="number" value={unit.mana.max}
              onChange={e => store.setMana(unit.id, unit.mana.current, parseInt(e.target.value) || 1)} />
          </div>
          <Checkbox label="🃏 Механика Карт Рока" checked={unit.hasRokCards}
            onChange={v => store.updateUnit(unit.id, { hasRokCards: v })} />
        </div>
      </Section>
    );
  }

  // ========== STATS ==========

  function renderStats(unit: Unit) {
    return (
      <Section title="Характеристики" icon="💪">
        <div className="space-y-2">
          {STAT_KEYS.map(key => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs text-ancient w-28 truncate">{STAT_FULL_NAMES[key]}</span>
              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={() => {
                    const stats = { ...unit.stats, [key]: Math.max(0, unit.stats[key] - 1) };
                    store.updateUnit(unit.id, { stats });
                  }}
                  className="w-6 h-6 rounded bg-input border border-border-bone text-faded hover:text-bone hover:border-faded text-xs cursor-pointer"
                >−</button>
                <span className="w-8 text-center text-sm font-bold text-gold">{unit.stats[key]}</span>
                <button
                  onClick={() => {
                    const stats = { ...unit.stats, [key]: unit.stats[key] + 1 };
                    store.updateUnit(unit.id, { stats });
                  }}
                  className="w-6 h-6 rounded bg-input border border-border-bone text-faded hover:text-bone hover:border-faded text-xs cursor-pointer"
                >+</button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 p-2 rounded bg-input border border-border-bone/50 text-[10px] text-faded">
          💡 Физ.мощь: +5 к физ.урону/ед • Ловкость: +3 к урону луков/ед • Интеллект: +3 к маг.урону/ед • Живучесть: +5 к HP/ед
        </div>
      </Section>
    );
  }

  // ========== PROFICIENCIES ==========

  function renderProficiencies(unit: Unit) {
    return (
      <Section title="Владение оружием" icon="⚔️">
        <div className="space-y-2">
          {PROF_KEYS.map(key => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs text-ancient w-28">{PROFICIENCY_NAMES[key]}</span>
              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={() => {
                    const profs = { ...unit.proficiencies, [key]: Math.max(0, unit.proficiencies[key] - 1) };
                    store.updateUnit(unit.id, { proficiencies: profs });
                  }}
                  className="w-6 h-6 rounded bg-input border border-border-bone text-faded hover:text-bone hover:border-faded text-xs cursor-pointer"
                >−</button>
                <span className="w-8 text-center text-sm font-bold text-gold">+{unit.proficiencies[key]}</span>
                <button
                  onClick={() => {
                    const profs = { ...unit.proficiencies, [key]: unit.proficiencies[key] + 1 };
                    store.updateUnit(unit.id, { proficiencies: profs });
                  }}
                  className="w-6 h-6 rounded bg-input border border-border-bone text-faded hover:text-bone hover:border-faded text-xs cursor-pointer"
                >+</button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 p-2 rounded bg-input border border-border-bone/50 text-[10px] text-faded">
          💡 Бонус владения добавляется к броску d20 на попадание
        </div>
      </Section>
    );
  }

  // ========== MAGIC BONUSES ==========

  function renderMagicBonuses(unit: Unit) {
    return (
      <Section title="Бонусы магических элементов" icon="✨">
        <div className="space-y-1">
          {MAGIC_ELEMENTS.map(element => {
            const bonus = unit.magicBonuses[element] || 0;
            return (
              <div key={element} className="flex items-center gap-2">
                <span className="text-xs text-ancient flex-1 truncate">{element}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const bonuses = { ...unit.magicBonuses, [element]: Math.max(0, bonus - 1) };
                      store.updateUnit(unit.id, { magicBonuses: bonuses });
                    }}
                    className="w-5 h-5 rounded bg-input border border-border-bone text-faded hover:text-bone text-[10px] cursor-pointer"
                  >−</button>
                  <span className={cn('w-6 text-center text-xs font-bold', bonus > 0 ? 'text-gold' : 'text-dim')}>
                    {bonus > 0 ? `+${bonus}` : '0'}
                  </span>
                  <button
                    onClick={() => {
                      const bonuses = { ...unit.magicBonuses, [element]: bonus + 1 };
                      store.updateUnit(unit.id, { magicBonuses: bonuses });
                    }}
                    className="w-5 h-5 rounded bg-input border border-border-bone text-faded hover:text-bone text-[10px] cursor-pointer"
                  >+</button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 p-2 rounded bg-input border border-border-bone/50 text-[10px] text-faded">
          💡 Макс. бонус элемента заклинания добавляется к броску на каст
        </div>
      </Section>
    );
  }

  // ========== WEAPONS ==========

  function renderWeapons(unit: Unit) {
    return (
      <Section title={`Оружие (${unit.weapons.length})`} icon="🗡️" actions={
        <Button variant="gold" size="sm" onClick={() => setWeaponModal({ open: true })}>+ Добавить</Button>
      }>
        {unit.weapons.length === 0 ? (
          <p className="text-xs text-faded">Нет оружия</p>
        ) : (
          <div className="space-y-1">
            {unit.weapons.map(w => (
              <div key={w.id} className="flex items-center gap-2 p-2 rounded bg-input border border-border-bone">
                <span>{DAMAGE_TYPE_ICONS[w.damageType]}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-bone truncate">{w.name}</div>
                  <div className="text-[10px] text-faded">
                    {w.damageFormula} {DAMAGE_TYPE_NAMES[w.damageType]} • {PROFICIENCY_NAMES[w.proficiencyType]} • {STAT_NAMES[w.statBonus]}
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setWeaponModal({ open: true, editing: w })}>✏️</Button>
                <Button variant="ghost" size="sm" onClick={() => store.deleteWeapon(unit.id, w.id)}>✕</Button>
              </div>
            ))}
          </div>
        )}
      </Section>
    );
  }

  // ========== SPELLS ==========

  function renderSpells(unit: Unit) {
    return (
      <Section title={`Заклинания (${unit.spells.length})`} icon="📖" actions={
        <Button variant="gold" size="sm" onClick={() => setSpellModal({ open: true })}>+ Добавить</Button>
      }>
        {unit.spells.length === 0 ? (
          <p className="text-xs text-faded">Нет заклинаний</p>
        ) : (
          <div className="space-y-1">
            {unit.spells.map(s => (
              <div key={s.id} className="flex items-center gap-2 p-2 rounded bg-input border border-border-bone">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-bone truncate">{s.name}</div>
                  <div className="text-[10px] text-faded">
                    💎{s.manaCost} • {s.elements.join(', ')} • {s.type}
                    {s.damageFormula && ` • ${s.damageFormula}`}
                    {s.type === 'targeted' && ` • ${s.projectiles} снаряд(ов)`}
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setSpellModal({ open: true, editing: s })}>✏️</Button>
                <Button variant="ghost" size="sm" onClick={() => store.deleteSpell(unit.id, s.id)}>✕</Button>
              </div>
            ))}
          </div>
        )}
      </Section>
    );
  }

  // ========== RESOURCES ==========

  function renderResources(unit: Unit) {
    return (
      <Section title={`Ресурсы (${unit.resources.length})`} icon="📦" actions={
        <Button variant="gold" size="sm" onClick={() => setResourceModal({ open: true })}>+ Добавить</Button>
      }>
        {unit.resources.length === 0 ? (
          <p className="text-xs text-faded">Нет ресурсов</p>
        ) : (
          <div className="space-y-1">
            {unit.resources.map(r => (
              <div key={r.id} className="flex items-center gap-2 p-2 rounded bg-input border border-border-bone">
                <span className="text-lg">{r.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-bone truncate">{r.name}</div>
                  <div className="text-[10px] text-faded">
                    {r.current}/{r.max}
                    {r.isRokCards && ' 🃏'}
                    {r.isConsumableWeapon && ` ⚔ ${r.damageFormula}`}
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setResourceModal({ open: true, editing: r })}>✏️</Button>
                <Button variant="ghost" size="sm" onClick={() => store.deleteResource(unit.id, r.id)}>✕</Button>
              </div>
            ))}
          </div>
        )}
      </Section>
    );
  }

  // ========== QUICK ACTIONS ==========

  function renderActions(unit: Unit) {
    return (
      <Section title={`Быстрые действия (${unit.quickActions.length})`} icon="🎯" actions={
        <Button variant="gold" size="sm" onClick={() => setActionModal({ open: true })}>+ Добавить</Button>
      }>
        {unit.quickActions.length === 0 ? (
          <p className="text-xs text-faded">Нет быстрых действий</p>
        ) : (
          <div className="space-y-1">
            {unit.quickActions.map(a => (
              <div key={a.id} className="flex items-center gap-2 p-2 rounded bg-input border border-border-bone">
                <span className="text-lg">{a.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-bone truncate">{a.name}</div>
                  <div className="text-[10px] text-faded">
                    {a.baseDice || '—'} + {STAT_NAMES[a.statBonus]}{a.flatBonus ? ` +${a.flatBonus}` : ''}
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setActionModal({ open: true, editing: a })}>✏️</Button>
                <Button variant="ghost" size="sm" onClick={() => store.deleteQuickAction(unit.id, a.id)}>✕</Button>
              </div>
            ))}
          </div>
        )}
      </Section>
    );
  }

  // ========== WEAPON MODAL ==========

  function renderWeaponModal(unit: Unit) {
    return (
      <WeaponFormModal
        open={weaponModal.open}
        editing={weaponModal.editing}
        onClose={() => setWeaponModal({ open: false })}
        onSave={(data) => {
          if (weaponModal.editing) {
            store.updateWeapon(unit.id, weaponModal.editing.id, data);
          } else {
            store.addWeapon(unit.id, data as Omit<Weapon, 'id'>);
          }
          setWeaponModal({ open: false });
        }}
      />
    );
  }

  // ========== SPELL MODAL ==========

  function renderSpellModal(unit: Unit) {
    return (
      <SpellFormModal
        open={spellModal.open}
        editing={spellModal.editing}
        onClose={() => setSpellModal({ open: false })}
        onSave={(data) => {
          if (spellModal.editing) {
            store.updateSpell(unit.id, spellModal.editing.id, data);
          } else {
            store.addSpell(unit.id, data as Omit<Spell, 'id'>);
          }
          setSpellModal({ open: false });
        }}
      />
    );
  }

  // ========== RESOURCE MODAL ==========

  function renderResourceModal(unit: Unit) {
    return (
      <ResourceFormModal
        open={resourceModal.open}
        editing={resourceModal.editing}
        onClose={() => setResourceModal({ open: false })}
        onSave={(data) => {
          if (resourceModal.editing) {
            store.updateResource(unit.id, resourceModal.editing.id, data);
          } else {
            store.addResource(unit.id, data as Omit<Resource, 'id'>);
          }
          setResourceModal({ open: false });
        }}
      />
    );
  }

  // ========== ACTION MODAL ==========

  function renderActionModal(unit: Unit) {
    return (
      <ActionFormModal
        open={actionModal.open}
        editing={actionModal.editing}
        onClose={() => setActionModal({ open: false })}
        onSave={(data) => {
          if (actionModal.editing) {
            store.updateQuickAction(unit.id, actionModal.editing.id, data);
          } else {
            store.addQuickAction(unit.id, data as Omit<QuickAction, 'id'>);
          }
          setActionModal({ open: false });
        }}
      />
    );
  }
}

// ===================================================================
// FORM MODALS
// ===================================================================

// ========== WEAPON FORM ==========

function WeaponFormModal({ open, editing, onClose, onSave }: {
  open: boolean;
  editing?: Weapon;
  onClose: () => void;
  onSave: (data: Partial<Weapon>) => void;
}) {
  const [name, setName] = useState('');
  const [formula, setFormula] = useState('3d20');
  const [damageType, setDamageType] = useState<string>('slashing');
  const [profType, setProfType] = useState<string>('swords');
  const [statBonus, setStatBonus] = useState<string>('physicalPower');
  const [special, setSpecial] = useState('');

  // Reset form when opened
  const resetForm = () => {
    if (editing) {
      setName(editing.name); setFormula(editing.damageFormula);
      setDamageType(editing.damageType); setProfType(editing.proficiencyType);
      setStatBonus(editing.statBonus); setSpecial(editing.special || '');
    } else {
      setName(''); setFormula('3d20'); setDamageType('slashing');
      setProfType('swords'); setStatBonus('physicalPower'); setSpecial('');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Редактировать оружие' : 'Новое оружие'} size="md">
      <ModalFormInit onInit={resetForm} deps={[open, editing?.id]} />
      <div className="space-y-3">
        <Input label="Название" value={name} onChange={e => setName(e.target.value)} placeholder="Фамильная сабля" />
        <Input label="Формула урона" value={formula} onChange={e => setFormula(e.target.value)} placeholder="3d20+5" />
        <Select label="Тип урона" value={damageType} onChange={e => setDamageType(e.target.value)} options={DAMAGE_TYPE_OPTIONS} />
        <Select label="Тип владения" value={profType} onChange={e => setProfType(e.target.value)} options={PROF_OPTIONS} />
        <Select label="Бонус характеристики к урону" value={statBonus} onChange={e => setStatBonus(e.target.value)} options={STAT_BONUS_OPTIONS} />
        <Input label="Особые свойства" value={special} onChange={e => setSpecial(e.target.value)} placeholder="Необязательно" />
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Отмена</Button>
          <Button variant="gold" className="flex-1" disabled={!name.trim() || !formula.trim()} onClick={() => {
            onSave({
              name: name.trim(), damageFormula: formula.trim(),
              damageType: damageType as DamageType, proficiencyType: profType as ProficiencyType,
              statBonus: statBonus as StatBonusType, special: special.trim() || undefined,
            });
          }}>
            {editing ? 'Сохранить' : 'Добавить'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ========== SPELL FORM ==========

function SpellFormModal({ open, editing, onClose, onSave }: {
  open: boolean;
  editing?: Spell;
  onClose: () => void;
  onSave: (data: Partial<Spell>) => void;
}) {
  const [name, setName] = useState('');
  const [manaCost, setManaCost] = useState('10');
  const [elements, setElements] = useState<string[]>([]);
  const [spellType, setSpellType] = useState<string>('targeted');
  const [projectiles, setProjectiles] = useState('1');
  const [canDodge, setCanDodge] = useState(true);
  const [formula, setFormula] = useState('');
  const [damageType, setDamageType] = useState<string>('fire');
  const [description, setDescription] = useState('');

  const resetForm = () => {
    if (editing) {
      setName(editing.name); setManaCost(String(editing.manaCost));
      setElements(editing.elements); setSpellType(editing.type);
      setProjectiles(String(editing.projectiles)); setCanDodge(editing.canDodge);
      setFormula(editing.damageFormula || ''); setDamageType(editing.damageType || 'fire');
      setDescription(editing.description || '');
    } else {
      setName(''); setManaCost('10'); setElements([]);
      setSpellType('targeted'); setProjectiles('1'); setCanDodge(true);
      setFormula(''); setDamageType('fire'); setDescription('');
    }
  };

  const toggleElement = (el: string) => {
    setElements(prev => prev.includes(el) ? prev.filter(e => e !== el) : [...prev, el]);
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Редактировать заклинание' : 'Новое заклинание'} size="lg">
      <ModalFormInit onInit={resetForm} deps={[open, editing?.id]} />
      <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
        <Input label="Название" value={name} onChange={e => setName(e.target.value)} placeholder="Огненный шар" />
        <Input label="Стоимость маны" type="number" value={manaCost} onChange={e => setManaCost(e.target.value)} />

        <div>
          <label className="text-xs text-faded uppercase tracking-wider">Элементы</label>
          <div className="flex flex-wrap gap-1 mt-1">
            {MAGIC_ELEMENTS.map(el => (
              <button
                key={el}
                onClick={() => toggleElement(el)}
                className={cn(
                  'px-2 py-0.5 text-[10px] border rounded cursor-pointer transition-colors',
                  elements.includes(el)
                    ? 'border-gold bg-gold-dark/30 text-gold-bright'
                    : 'border-border-bone text-dim hover:text-faded'
                )}
              >{el}</button>
            ))}
          </div>
        </div>

        <Select label="Тип заклинания" value={spellType} onChange={e => setSpellType(e.target.value)} options={SPELL_TYPE_OPTIONS} />

        {spellType === 'targeted' && (
          <>
            <Input label="Количество снарядов" type="number" value={projectiles} onChange={e => setProjectiles(e.target.value)} />
            <Checkbox label="Можно увернуться" checked={canDodge} onChange={setCanDodge} />
          </>
        )}

        <Input label="Формула урона (необязательно)" value={formula} onChange={e => setFormula(e.target.value)} placeholder="2d12+5" />
        {formula && <Select label="Тип урона" value={damageType} onChange={e => setDamageType(e.target.value)} options={DAMAGE_TYPE_OPTIONS} />}
        <Input label="Описание" value={description} onChange={e => setDescription(e.target.value)} placeholder="Эффект заклинания..." />

        <div className="flex gap-2 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Отмена</Button>
          <Button variant="gold" className="flex-1" disabled={!name.trim() || elements.length === 0} onClick={() => {
            onSave({
              name: name.trim(), manaCost: parseInt(manaCost) || 0,
              elements, type: spellType as Spell['type'],
              projectiles: parseInt(projectiles) || 1, canDodge,
              damageFormula: formula.trim() || undefined,
              damageType: formula.trim() ? damageType : undefined,
              description: description.trim() || undefined,
            });
          }}>
            {editing ? 'Сохранить' : 'Добавить'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ========== RESOURCE FORM ==========

function ResourceFormModal({ open, editing, onClose, onSave }: {
  open: boolean;
  editing?: Resource;
  onClose: () => void;
  onSave: (data: Partial<Resource>) => void;
}) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📦');
  const [current, setCurrent] = useState('10');
  const [max, setMax] = useState('10');
  const [isRok, setIsRok] = useState(false);
  const [isWeapon, setIsWeapon] = useState(false);
  const [formula, setFormula] = useState('');
  const [damageType, setDamageType] = useState<string>('piercing');
  const [profType, setProfType] = useState<string>('bows');
  const [statBonus, setStatBonus] = useState<string>('dexterity');

  const resetForm = () => {
    if (editing) {
      setName(editing.name); setIcon(editing.icon);
      setCurrent(String(editing.current)); setMax(String(editing.max));
      setIsRok(editing.isRokCards); setIsWeapon(editing.isConsumableWeapon);
      setFormula(editing.damageFormula || ''); setDamageType(editing.damageType || 'piercing');
      setProfType(editing.proficiencyType || 'bows'); setStatBonus(editing.statBonus || 'dexterity');
    } else {
      setName(''); setIcon('📦'); setCurrent('10'); setMax('10');
      setIsRok(false); setIsWeapon(false); setFormula('');
      setDamageType('piercing'); setProfType('bows'); setStatBonus('dexterity');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Редактировать ресурс' : 'Новый ресурс'} size="md">
      <ModalFormInit onInit={resetForm} deps={[open, editing?.id]} />
      <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-[60px_1fr] gap-2">
          <Input label="Иконка" value={icon} onChange={e => setIcon(e.target.value)} />
          <Input label="Название" value={name} onChange={e => setName(e.target.value)} placeholder="Стрелы" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input label="Текущее" type="number" value={current} onChange={e => setCurrent(e.target.value)} />
          <Input label="Максимум" type="number" value={max} onChange={e => setMax(e.target.value)} />
        </div>
        <Checkbox label="🃏 Это Карты Рока" checked={isRok} onChange={setIsRok} />
        <Checkbox label="⚔️ Это расходуемое оружие" checked={isWeapon} onChange={setIsWeapon} />
        {isWeapon && (
          <>
            <Input label="Формула урона" value={formula} onChange={e => setFormula(e.target.value)} placeholder="1d8+3" />
            <Select label="Тип урона" value={damageType} onChange={e => setDamageType(e.target.value)} options={DAMAGE_TYPE_OPTIONS} />
            <Select label="Тип владения" value={profType} onChange={e => setProfType(e.target.value)} options={PROF_OPTIONS} />
            <Select label="Бонус стата" value={statBonus} onChange={e => setStatBonus(e.target.value)} options={STAT_BONUS_OPTIONS} />
          </>
        )}
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Отмена</Button>
          <Button variant="gold" className="flex-1" disabled={!name.trim()} onClick={() => {
            onSave({
              name: name.trim(), icon,
              current: parseInt(current) || 0, max: parseInt(max) || 1,
              isRokCards: isRok, isConsumableWeapon: isWeapon,
              damageFormula: isWeapon ? formula.trim() || undefined : undefined,
              damageType: isWeapon ? damageType as DamageType : undefined,
              proficiencyType: isWeapon ? profType as ProficiencyType : undefined,
              statBonus: isWeapon ? statBonus as StatBonusType : undefined,
            });
          }}>
            {editing ? 'Сохранить' : 'Добавить'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ========== QUICK ACTION FORM ==========

function ActionFormModal({ open, editing, onClose, onSave }: {
  open: boolean;
  editing?: QuickAction;
  onClose: () => void;
  onSave: (data: Partial<QuickAction>) => void;
}) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🎲');
  const [baseDice, setBaseDice] = useState('1d20');
  const [statBonus, setStatBonus] = useState<string>('none');
  const [flatBonus, setFlatBonus] = useState('0');
  const [description, setDescription] = useState('');

  const resetForm = () => {
    if (editing) {
      setName(editing.name); setIcon(editing.icon);
      setBaseDice(editing.baseDice); setStatBonus(editing.statBonus);
      setFlatBonus(String(editing.flatBonus)); setDescription(editing.description || '');
    } else {
      setName(''); setIcon('🎲'); setBaseDice('1d20');
      setStatBonus('none'); setFlatBonus('0'); setDescription('');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Редактировать действие' : 'Новое действие'} size="md">
      <ModalFormInit onInit={resetForm} deps={[open, editing?.id]} />
      <div className="space-y-3">
        <div className="grid grid-cols-[60px_1fr] gap-2">
          <Input label="Иконка" value={icon} onChange={e => setIcon(e.target.value)} />
          <Input label="Название" value={name} onChange={e => setName(e.target.value)} placeholder="Проверка харизмы" />
        </div>
        <Input label="Бросок кубиков" value={baseDice} onChange={e => setBaseDice(e.target.value)} placeholder="1d20" />
        <Select label="Бонус характеристики" value={statBonus} onChange={e => setStatBonus(e.target.value)} options={STAT_BONUS_OPTIONS} />
        <Input label="Доп. числовой бонус" type="number" value={flatBonus} onChange={e => setFlatBonus(e.target.value)} />
        <Input label="Описание" value={description} onChange={e => setDescription(e.target.value)} placeholder="Необязательно" />
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Отмена</Button>
          <Button variant="gold" className="flex-1" disabled={!name.trim()} onClick={() => {
            onSave({
              name: name.trim(), icon,
              baseDice: baseDice.trim(), statBonus: statBonus as StatBonusType,
              flatBonus: parseInt(flatBonus) || 0,
              description: description.trim() || undefined,
            });
          }}>
            {editing ? 'Сохранить' : 'Добавить'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ========== HELPER: Form init on open ==========

import { useEffect, useRef } from 'react';

function ModalFormInit({ onInit, deps }: { onInit: () => void; deps: unknown[] }) {
  const initialized = useRef(false);
  const depsStr = JSON.stringify(deps);

  useEffect(() => {
    initialized.current = false;
  }, [depsStr]);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      onInit();
    }
  });

  return null;
}
