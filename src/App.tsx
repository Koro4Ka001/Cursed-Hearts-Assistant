import { useState, useEffect } from 'react';
import { useGameStore } from './stores/gameStore';
import OBR from '@owlbear-rodeo/sdk';

// Tabs
type TabType = 'combat' | 'magic' | 'resources' | 'actions' | 'settings';

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('combat');
  const [isReady, setIsReady] = useState(false);
  
  const { units, activeUnitId, setActiveUnit, getActiveUnit } = useGameStore();
  const activeUnit = getActiveUnit();

  useEffect(() => {
    OBR.onReady(() => {
      setIsReady(true);
      console.log('Owlbear SDK Ready!');
    });
  }, []);

  const tabs: { id: TabType; icon: string; label: string }[] = [
    { id: 'combat', icon: '⚔️', label: 'Бой' },
    { id: 'magic', icon: '✨', label: 'Магия' },
    { id: 'resources', icon: '📦', label: 'Ресурс' },
    { id: 'actions', icon: '🎯', label: 'Действ' },
    { id: 'settings', icon: '⚙️', label: 'Настр' },
  ];

  const healthPercent = activeUnit 
    ? (activeUnit.health.current / activeUnit.health.max) * 100 
    : 0;
  const manaPercent = activeUnit 
    ? (activeUnit.mana.current / activeUnit.mana.max) * 100 
    : 0;

  return (
    <div className="min-h-screen bg-[#030303] text-[#d4c8b8] p-2">
      {/* Header */}
      <div className="text-center py-2 border-b border-[#3a332a] mb-2">
        <div className="text-[#ffd700] text-xs tracking-widest">☠ CURSED HEARTS ☠</div>
        <div className="text-[#4a433a] text-[10px]">PLAYER ASSISTANT</div>
      </div>

      {/* Unit Selector */}
      <div className="flex gap-2 mb-3">
        <select
          value={activeUnitId || ''}
          onChange={(e) => setActiveUnit(e.target.value)}
          className="flex-1 bg-[#161412] border border-[#3a332a] text-[#d4a726] 
                     px-3 py-2 text-sm focus:outline-none focus:border-[#d4a726]"
        >
          {units.length === 0 ? (
            <option value="">— Добавьте юнита —</option>
          ) : (
            units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))
          )}
        </select>
        <button 
          className="bg-[#161412] border border-[#3a332a] px-3 text-[#d4a726]
                     hover:border-[#d4a726] transition-colors"
          onClick={() => console.log('Sync')}
        >
          🔄
        </button>
      </div>

      {/* Stats Bars */}
      {activeUnit && (
        <div className="space-y-2 mb-3">
          {/* Health */}
          <div className="flex items-center gap-2">
            <span className="text-sm">🩸</span>
            <span className="text-[10px] text-[#7a6f62] w-8">HP</span>
            <div className="flex-1 h-6 bg-[#0a0606] border-2 border-[#4a0000] relative overflow-hidden">
              <div 
                className="h-full bg-gradient-to-b from-[#cc2020] via-[#8b0000] to-[#2a0000] transition-all"
                style={{ width: `${healthPercent}%` }}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-white drop-shadow-lg">
                {activeUnit.health.current}/{activeUnit.health.max}
              </span>
            </div>
          </div>
          
          {/* Mana */}
          <div className="flex items-center gap-2">
            <span className="text-sm">💠</span>
            <span className="text-[10px] text-[#7a6f62] w-8">Мана</span>
            <div className="flex-1 h-6 bg-[#050a14] border-2 border-[#0a2040] relative overflow-hidden">
              <div 
                className="h-full bg-gradient-to-b from-[#4a9eff] via-[#1a4a8b] to-[#051530] transition-all"
                style={{ width: `${manaPercent}%` }}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-white drop-shadow-lg">
                {activeUnit.mana.current}/{activeUnit.mana.max}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex gap-1 mb-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 text-center border transition-colors
              ${activeTab === tab.id 
                ? 'bg-[#161412] border-[#d4a726] text-[#ffd700]' 
                : 'bg-[#0c0a09] border-[#3a332a] text-[#4a433a] hover:text-[#7a6f62]'
              }`}
          >
            <div className="text-lg">{tab.icon}</div>
            <div className="text-[9px]">{tab.label}</div>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="border border-[#3a332a] bg-[#0c0a09] p-3">
        {activeTab === 'combat' && <CombatTab />}
        {activeTab === 'magic' && <MagicTab />}
        {activeTab === 'resources' && <ResourcesTab />}
        {activeTab === 'actions' && <ActionsTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>

      {/* OBR Status */}
      <div className="mt-2 text-center text-[10px] text-[#4a433a]">
        {isReady ? '✓ Owlbear подключен' : '⏳ Подключение...'}
      </div>
    </div>
  );
}

// === TAB COMPONENTS ===

function CombatTab() {
  const activeUnit = useGameStore((s) => s.getActiveUnit());
  const [damage, setDamage] = useState('');
  const [heal, setHeal] = useState('');

  if (!activeUnit) {
    return <div className="text-center text-[#4a433a] py-4">Выберите юнита</div>;
  }

  return (
    <div className="space-y-4">
      {/* Attack Section */}
      <Section title="⚔️ АТАКА">
        <div className="space-y-2">
          <label className="text-[10px] text-[#7a6f62] uppercase tracking-wider">Оружие</label>
          <select className="w-full bg-[#161412] border border-[#3a332a] text-[#d4c8b8] px-3 py-2 text-sm">
            {activeUnit.weapons.length === 0 ? (
              <option>— Нет оружия —</option>
            ) : (
              activeUnit.weapons.map((w) => (
                <option key={w.id} value={w.id}>{w.name} ({w.damageFormula})</option>
              ))
            )}
          </select>
          <button className="w-full py-2 bg-gradient-to-b from-[#3a1515] to-[#100404] 
                             border border-[#4a0000] text-[#f0c0c0] text-sm font-bold
                             hover:border-[#8b0000] transition-colors">
            ⚔️ АТАКОВАТЬ!
          </button>
        </div>
      </Section>

      {/* Damage Section */}
      <Section title="🩸 ПОЛУЧЕНИЕ УРОНА">
        <div className="space-y-2">
          <input
            type="number"
            value={damage}
            onChange={(e) => setDamage(e.target.value)}
            placeholder="Входящий урон"
            className="w-full bg-[#161412] border border-[#3a332a] text-[#d4c8b8] px-3 py-2 text-sm"
          />
          <button className="w-full py-2 bg-gradient-to-b from-[#3a1515] to-[#100404] 
                             border border-[#4a0000] text-[#f0c0c0] text-sm
                             hover:border-[#8b0000] transition-colors">
            🩸 ПОЛУЧИТЬ УРОН
          </button>
        </div>
      </Section>

      {/* Heal Section */}
      <Section title="💚 ИСЦЕЛЕНИЕ">
        <div className="flex gap-2">
          <input
            type="number"
            value={heal}
            onChange={(e) => setHeal(e.target.value)}
            placeholder="HP"
            className="flex-1 bg-[#161412] border border-[#3a332a] text-[#d4c8b8] px-3 py-2 text-sm"
          />
          <button className="px-4 bg-gradient-to-b from-[#1a2a15] to-[#0a150a] 
                             border border-[#2e5a1c] text-[#a0d090] text-sm
                             hover:border-[#4a8a35] transition-colors">
            💚 Исцелить
          </button>
        </div>
      </Section>
    </div>
  );
}

function MagicTab() {
  const activeUnit = useGameStore((s) => s.getActiveUnit());
  const [manaAmount, setManaAmount] = useState('');

  if (!activeUnit) {
    return <div className="text-center text-[#4a433a] py-4">Выберите юнита</div>;
  }

  return (
    <div className="space-y-4">
      <Section title="✨ ЗАКЛИНАНИЯ">
        <div className="space-y-2">
          <select className="w-full bg-[#161412] border border-[#3a332a] text-[#d4c8b8] px-3 py-2 text-sm">
            {activeUnit.spells.length === 0 ? (
              <option>— Гримуар пуст —</option>
            ) : (
              activeUnit.spells.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.manaCost} 💠)</option>
              ))
            )}
          </select>
          <button className="w-full py-2 bg-gradient-to-b from-[#2a2010] to-[#0a0805] 
                             border border-[#8b6914] text-[#ffd700] text-sm font-bold
                             hover:border-[#d4a726] transition-colors">
            ✨ СОТВОРИТЬ!
          </button>
        </div>
      </Section>

      <Section title="💠 МАНА">
        <div className="space-y-2">
          <input
            type="number"
            value={manaAmount}
            onChange={(e) => setManaAmount(e.target.value)}
            placeholder="Количество"
            className="w-full bg-[#161412] border border-[#3a332a] text-[#d4c8b8] px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button className="flex-1 py-2 bg-gradient-to-b from-[#2a1515] to-[#150a0a] 
                               border border-[#5a1c1c] text-[#d09090] text-sm
                               hover:border-[#8a3535] transition-colors">
              − Потратить
            </button>
            <button className="flex-1 py-2 bg-gradient-to-b from-[#1a2a15] to-[#0a150a] 
                               border border-[#2e5a1c] text-[#a0d090] text-sm
                               hover:border-[#4a8a35] transition-colors">
              + Восстановить
            </button>
          </div>
        </div>
      </Section>
    </div>
  );
}

function ResourcesTab() {
  const activeUnit = useGameStore((s) => s.getActiveUnit());

  if (!activeUnit) {
    return <div className="text-center text-[#4a433a] py-4">Выберите юнита</div>;
  }

  return (
    <div className="space-y-3">
      {activeUnit.resources.length === 0 ? (
        <div className="text-center text-[#4a433a] py-4">Нет ресурсов</div>
      ) : (
        activeUnit.resources.map((res) => (
          <div key={res.id} className="border border-[#3a332a] bg-[#0f0d0c] p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{res.icon}</span>
              <span className="flex-1 text-sm text-[#d4a726]">{res.name}</span>
              <button className="text-[#7a6f62] hover:text-[#d4c8b8]">✏</button>
            </div>
            <div className="flex items-center justify-center gap-2">
              <button className="px-2 py-1 bg-[#161412] border border-[#3a332a] text-[#7a6f62]">-5</button>
              <button className="px-2 py-1 bg-[#161412] border border-[#3a332a] text-[#7a6f62]">-1</button>
              <span className="px-3 text-[#ffd700] font-bold">[{res.current}]/{res.max}</span>
              <button className="px-2 py-1 bg-[#161412] border border-[#3a332a] text-[#7a6f62]">+1</button>
              <button className="px-2 py-1 bg-[#161412] border border-[#3a332a] text-[#7a6f62]">+5</button>
            </div>
          </div>
        ))
      )}
      <button className="w-full py-2 border border-dashed border-[#3a332a] text-[#4a433a] text-sm
                         hover:border-[#7a6f62] hover:text-[#7a6f62] transition-colors">
        + Добавить ресурс
      </button>
    </div>
  );
}

function ActionsTab() {
  const activeUnit = useGameStore((s) => s.getActiveUnit());

  if (!activeUnit) {
    return <div className="text-center text-[#4a433a] py-4">Выберите юнита</div>;
  }

  return (
    <div className="space-y-2">
      {activeUnit.quickActions.length === 0 ? (
        <div className="text-center text-[#4a433a] py-4">Нет быстрых действий</div>
      ) : (
        activeUnit.quickActions.map((action) => (
          <button 
            key={action.id}
            className="w-full flex items-center gap-3 p-3 bg-[#0f0d0c] border border-[#3a332a]
                       hover:border-[#7a6f62] transition-colors text-left"
          >
            <span className="text-xl">{action.icon}</span>
            <span className="flex-1 text-sm">{action.name}</span>
            {action.diceFormula && (
              <span className="text-[10px] text-[#7a6f62]">{action.diceFormula}</span>
            )}
          </button>
        ))
      )}
      <button className="w-full py-2 border border-dashed border-[#3a332a] text-[#4a433a] text-sm
                         hover:border-[#7a6f62] hover:text-[#7a6f62] transition-colors">
        + Создать действие
      </button>
    </div>
  );
}

function SettingsTab() {
  const { units, addUnit, deleteUnit, settings, updateSettings } = useGameStore();
  const [showNewUnit, setShowNewUnit] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');

  const createUnit = () => {
    if (!newUnitName.trim()) return;
    addUnit({
      name: newUnitName,
      shortName: newUnitName,
      googleDocsHeader: newUnitName,
      health: { current: 100, max: 100 },
      mana: { current: 50, max: 50 },
      stats: {
        physicalPower: 1,
        dexterity: 1,
        intelligence: 1,
        vitality: 1,
        charisma: 1,
        initiative: 1,
      },
      proficiencies: {
        swords: 0, axes: 0, hammers: 0, polearms: 0, unarmed: 0, bows: 0,
      },
      magicBonuses: {},
      weapons: [],
      spells: [],
      resources: [],
      quickActions: [],
    });
    setNewUnitName('');
    setShowNewUnit(false);
  };

  return (
    <div className="space-y-4">
      <Section title="👥 ЮНИТЫ">
        <div className="space-y-2">
          {units.map((u) => (
            <div key={u.id} className="flex items-center gap-2 p-2 bg-[#0f0d0c] border border-[#3a332a]">
              <span className="flex-1 text-sm">{u.name}</span>
              <button className="text-[#7a6f62] hover:text-[#d4c8b8]">✏</button>
              <button 
                onClick={() => deleteUnit(u.id)}
                className="text-[#5a1c1c] hover:text-[#8b0000]"
              >
                🗑
              </button>
            </div>
          ))}
          
          {showNewUnit ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={newUnitName}
                onChange={(e) => setNewUnitName(e.target.value)}
                placeholder="Имя юнита"
                className="flex-1 bg-[#161412] border border-[#3a332a] text-[#d4c8b8] px-3 py-2 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && createUnit()}
              />
              <button 
                onClick={createUnit}
                className="px-3 bg-[#1a2a15] border border-[#2e5a1c] text-[#a0d090]"
              >
                ✓
              </button>
              <button 
                onClick={() => setShowNewUnit(false)}
                className="px-3 bg-[#2a1515] border border-[#5a1c1c] text-[#d09090]"
              >
                ✕
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowNewUnit(true)}
              className="w-full py-2 border border-dashed border-[#3a332a] text-[#4a433a] text-sm
                         hover:border-[#7a6f62] hover:text-[#7a6f62] transition-colors"
            >
              + Добавить юнита
            </button>
          )}
        </div>
      </Section>

      <Section title="🔗 СИНХРОНИЗАЦИЯ">
        <div className="space-y-2">
          <label className="text-[10px] text-[#7a6f62] uppercase tracking-wider">Web App URL</label>
          <input
            type="text"
            value={settings.webAppUrl}
            onChange={(e) => updateSettings({ webAppUrl: e.target.value })}
            placeholder="https://script.google.com/macros/s/..."
            className="w-full bg-[#161412] border border-[#3a332a] text-[#d4c8b8] px-3 py-2 text-sm"
          />
        </div>
      </Section>
    </div>
  );
}

// === HELPER COMPONENTS ===

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[10px] text-[#d4a726] uppercase tracking-wider font-bold">
        {title}
        <div className="flex-1 h-px bg-[#3a332a]" />
      </div>
      {children}
    </div>
  );
}
