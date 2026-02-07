import { useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { Button } from '@/components/ui/Button';
import { Input, Select, Checkbox } from '@/components/ui/Input';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { setWebAppUrl } from '@/services/googleDocsService';
import { getTokens, selectTokenForUnit, getTokenInfo } from '@/services/owlbearService';
import { PROFICIENCY_NAMES, STAT_NAMES } from '@/types';
import type { Unit, Weapon, Spell, ProficiencyType } from '@/types';

type EditSection = 'unit' | 'weapon' | 'spell' | 'stats' | 'proficiencies' | 'magic' | null;

export function SettingsTab() {
  const { 
    units, 
    selectedUnitId, 
    addUnit, 
    updateUnit, 
    deleteUnit, 
    selectUnit, 
    getSelectedUnit,
    addWeapon,
    updateWeapon,
    deleteWeapon,
    addSpell,
    updateSpell,
    deleteSpell,
    settings,
    updateSettings,
    showNotification,
  } = useGameStore();
  
  const unit = getSelectedUnit();
  
  // Состояние редактирования
  const [editSection, setEditSection] = useState<EditSection>(null);
  const [editingUnit, setEditingUnit] = useState<Partial<Unit>>({});
  const [editingWeapon, setEditingWeapon] = useState<Partial<Weapon>>({});
  const [editingSpell, setEditingSpell] = useState<Partial<Spell>>({});
  const [editingWeaponId, setEditingWeaponId] = useState<string | null>(null);
  const [editingSpellId, setEditingSpellId] = useState<string | null>(null);
  
  // Диалог подтверждения удаления
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'unit' | 'weapon' | 'spell'; id: string } | null>(null);
  
  // Токены (используются при выборе)
  const [, setAvailableTokens] = useState<{ id: string; name: string }[]>([]);
  const [, setLinkedTokenName] = useState<string>('');
  
  // Обработка сохранения URL
  const handleSaveUrl = () => {
    setWebAppUrl(settings.googleWebAppUrl);
    showNotification('success', 'URL сохранён');
  };
  
  // Создание нового юнита
  const handleCreateUnit = () => {
    const id = addUnit({
      name: 'Новый персонаж',
      shortName: 'Персонаж',
      googleDocsHeader: '',
      health: { current: 100, max: 100 },
      mana: { current: 50, max: 50 },
      stats: { physicalPower: 0, dexterity: 0, intelligence: 0, vitality: 0, charisma: 0, initiative: 0 },
      weaponProficiencies: { swords: 0, axes: 0, hammers: 0, polearms: 0, unarmed: 0, bows: 0 },
      magicBonuses: {},
      weapons: [],
      spells: [],
      resources: [],
      quickActions: [],
    });
    selectUnit(id);
    showNotification('success', 'Персонаж создан');
  };
  
  // Редактирование юнита
  const handleEditUnit = () => {
    if (!unit) return;
    setEditingUnit({ ...unit });
    setEditSection('unit');
  };
  
  const handleSaveUnit = () => {
    if (!unit || !editingUnit) return;
    updateUnit(unit.id, editingUnit);
    setEditSection(null);
    showNotification('success', 'Изменения сохранены');
  };
  
  // Редактирование характеристик
  const handleEditStats = () => {
    if (!unit) return;
    setEditingUnit({ stats: { ...unit.stats }, health: { ...unit.health }, mana: { ...unit.mana } });
    setEditSection('stats');
  };
  
  const handleSaveStats = () => {
    if (!unit || !editingUnit) return;
    updateUnit(unit.id, { 
      stats: editingUnit.stats,
      health: editingUnit.health,
      mana: editingUnit.mana,
    });
    setEditSection(null);
    showNotification('success', 'Характеристики сохранены');
  };
  
  // Редактирование владения оружием
  const handleEditProficiencies = () => {
    if (!unit) return;
    setEditingUnit({ weaponProficiencies: { ...unit.weaponProficiencies } });
    setEditSection('proficiencies');
  };
  
  const handleSaveProficiencies = () => {
    if (!unit || !editingUnit) return;
    updateUnit(unit.id, { weaponProficiencies: editingUnit.weaponProficiencies });
    setEditSection(null);
    showNotification('success', 'Владение сохранено');
  };
  
  // Редактирование магических бонусов
  const handleEditMagic = () => {
    if (!unit) return;
    setEditingUnit({ magicBonuses: { ...unit.magicBonuses } });
    setEditSection('magic');
  };
  
  const handleSaveMagic = () => {
    if (!unit || !editingUnit) return;
    updateUnit(unit.id, { magicBonuses: editingUnit.magicBonuses });
    setEditSection(null);
    showNotification('success', 'Бонусы магии сохранены');
  };
  
  // Оружие
  const handleAddWeapon = () => {
    setEditingWeapon({
      name: '',
      damageFormula: '1d6',
      damageType: 'slashing',
      proficiencyType: 'swords',
      statBonus: 'physicalPower',
    });
    setEditingWeaponId(null);
    setEditSection('weapon');
  };
  
  const handleEditWeapon = (weapon: Weapon) => {
    setEditingWeapon({ ...weapon });
    setEditingWeaponId(weapon.id);
    setEditSection('weapon');
  };
  
  const handleSaveWeapon = () => {
    if (!unit || !editingWeapon.name) return;
    
    if (editingWeaponId) {
      updateWeapon(unit.id, editingWeaponId, editingWeapon);
    } else {
      addWeapon(unit.id, editingWeapon as Omit<Weapon, 'id'>);
    }
    
    setEditSection(null);
    showNotification('success', 'Оружие сохранено');
  };
  
  // Заклинания
  const handleAddSpell = () => {
    setEditingSpell({
      name: '',
      manaCost: 10,
      elements: [],
      type: 'targeted',
      projectiles: 1,
      canDodge: true,
      damageFormula: '1d6',
    });
    setEditingSpellId(null);
    setEditSection('spell');
  };
  
  const handleEditSpell = (spell: Spell) => {
    setEditingSpell({ ...spell });
    setEditingSpellId(spell.id);
    setEditSection('spell');
  };
  
  const handleSaveSpell = () => {
    if (!unit || !editingSpell.name) return;
    
    if (editingSpellId) {
      updateSpell(unit.id, editingSpellId, editingSpell);
    } else {
      addSpell(unit.id, editingSpell as Omit<Spell, 'id'>);
    }
    
    setEditSection(null);
    showNotification('success', 'Заклинание сохранено');
  };
  
  // Удаление
  const handleConfirmDelete = () => {
    if (!deleteTarget || !unit) return;
    
    if (deleteTarget.type === 'unit') {
      deleteUnit(deleteTarget.id);
      showNotification('info', 'Персонаж удалён');
    } else if (deleteTarget.type === 'weapon') {
      deleteWeapon(unit.id, deleteTarget.id);
      showNotification('info', 'Оружие удалено');
    } else if (deleteTarget.type === 'spell') {
      deleteSpell(unit.id, deleteTarget.id);
      showNotification('info', 'Заклинание удалено');
    }
    
    setDeleteTarget(null);
  };
  
  // Привязка токена
  const handleLinkToken = async () => {
    if (!unit) return;
    
    const tokens = await getTokens();
    setAvailableTokens(tokens);
    
    const tokenId = await selectTokenForUnit(unit.name);
    if (tokenId) {
      updateUnit(unit.id, { tokenId });
      const tokenInfo = await getTokenInfo(tokenId);
      setLinkedTokenName(tokenInfo?.name || 'Токен привязан');
      showNotification('success', `Токен "${tokenInfo?.name || tokenId}" привязан`);
    }
  };
  
  return (
    <div className="p-3 space-y-4 overflow-y-auto max-h-[calc(100vh-280px)]">
      {/* Google Docs настройки */}
      <section className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
        <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
          <span>📄</span> Google Docs
        </h3>
        
        <div className="space-y-2">
          <Input
            label="Web App URL"
            value={settings.googleWebAppUrl}
            onChange={(e) => updateSettings({ googleWebAppUrl: e.target.value })}
            placeholder="https://script.google.com/..."
          />
          <Checkbox
            label="Авто-синхронизация"
            checked={settings.autoSync}
            onChange={(e) => updateSettings({ autoSync: e.target.checked })}
          />
          <Button variant="secondary" size="sm" onClick={handleSaveUrl}>
            💾 Сохранить URL
          </Button>
        </div>
      </section>
      
      {/* Управление юнитами */}
      <section className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
            <span>👤</span> Персонажи
          </h3>
          <Button size="sm" variant="secondary" onClick={handleCreateUnit}>
            + Создать
          </Button>
        </div>
        
        {/* Список юнитов */}
        <div className="space-y-2 mb-3">
          {units.map(u => (
            <div
              key={u.id}
              className={`flex items-center justify-between p-2 rounded-lg border ${
                u.id === selectedUnitId
                  ? 'bg-amber-900/20 border-amber-600'
                  : 'bg-gray-900/50 border-gray-700'
              }`}
            >
              <button
                className="flex-1 text-left text-gray-200 text-sm"
                onClick={() => selectUnit(u.id)}
              >
                {u.name}
                {u.tokenId && <span className="ml-2 text-xs text-gray-500">🎯</span>}
              </button>
              <button
                onClick={() => {
                  setDeleteTarget({ type: 'unit', id: u.id });
                  setShowDeleteDialog(true);
                }}
                className="text-gray-500 hover:text-red-400 p-1"
              >
                🗑
              </button>
            </div>
          ))}
        </div>
        
        {/* Редактирование выбранного юнита */}
        {unit && (
          <div className="space-y-2 border-t border-gray-700 pt-3">
            <div className="text-xs text-gray-400">Выбран: {unit.name}</div>
            
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="ghost" onClick={handleEditUnit}>
                ✏️ Общее
              </Button>
              <Button size="sm" variant="ghost" onClick={handleEditStats}>
                📊 Статы
              </Button>
              <Button size="sm" variant="ghost" onClick={handleEditProficiencies}>
                ⚔️ Владение
              </Button>
              <Button size="sm" variant="ghost" onClick={handleEditMagic}>
                ✨ Магия
              </Button>
            </div>
            
            <Button size="sm" variant="secondary" className="w-full" onClick={handleLinkToken}>
              🎯 Привязать токен
              {unit.tokenId && <span className="ml-2 text-green-400">✓</span>}
            </Button>
          </div>
        )}
      </section>
      
      {/* Оружие */}
      {unit && (
        <section className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
              <span>⚔️</span> Оружие
            </h3>
            <Button size="sm" variant="secondary" onClick={handleAddWeapon}>
              + Добавить
            </Button>
          </div>
          
          <div className="space-y-2">
            {unit.weapons.map(weapon => (
              <div
                key={weapon.id}
                className="flex items-center justify-between p-2 bg-gray-900/50 rounded-lg border border-gray-700"
              >
                <div className="flex-1">
                  <div className="text-sm text-gray-200">{weapon.name}</div>
                  <div className="text-xs text-gray-500">
                    {weapon.damageFormula} • {PROFICIENCY_NAMES[weapon.proficiencyType]}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEditWeapon(weapon)}
                    className="text-gray-500 hover:text-amber-400 p-1"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => {
                      setDeleteTarget({ type: 'weapon', id: weapon.id });
                      setShowDeleteDialog(true);
                    }}
                    className="text-gray-500 hover:text-red-400 p-1"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
            {unit.weapons.length === 0 && (
              <p className="text-gray-500 text-xs text-center py-2">Нет оружия</p>
            )}
          </div>
        </section>
      )}
      
      {/* Заклинания */}
      {unit && (
        <section className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-purple-400 flex items-center gap-2">
              <span>✨</span> Заклинания
            </h3>
            <Button size="sm" variant="secondary" onClick={handleAddSpell}>
              + Добавить
            </Button>
          </div>
          
          <div className="space-y-2">
            {unit.spells.map(spell => (
              <div
                key={spell.id}
                className="flex items-center justify-between p-2 bg-gray-900/50 rounded-lg border border-gray-700"
              >
                <div className="flex-1">
                  <div className="text-sm text-gray-200">{spell.name}</div>
                  <div className="text-xs text-gray-500">
                    💠{spell.manaCost} • {spell.elements.join(', ') || 'Без элемента'}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEditSpell(spell)}
                    className="text-gray-500 hover:text-amber-400 p-1"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => {
                      setDeleteTarget({ type: 'spell', id: spell.id });
                      setShowDeleteDialog(true);
                    }}
                    className="text-gray-500 hover:text-red-400 p-1"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
            {unit.spells.length === 0 && (
              <p className="text-gray-500 text-xs text-center py-2">Нет заклинаний</p>
            )}
          </div>
        </section>
      )}
      
      {/* Модальные окна редактирования */}
      
      {/* Редактирование юнита */}
      <Modal
        isOpen={editSection === 'unit'}
        onClose={() => setEditSection(null)}
        title="Редактирование персонажа"
      >
        <div className="space-y-3">
          <Input
            label="Имя"
            value={editingUnit.name || ''}
            onChange={(e) => setEditingUnit({ ...editingUnit, name: e.target.value })}
          />
          <Input
            label="Короткое имя (для логов)"
            value={editingUnit.shortName || ''}
            onChange={(e) => setEditingUnit({ ...editingUnit, shortName: e.target.value })}
          />
          <Input
            label="Заголовок в Google Docs"
            value={editingUnit.googleDocsHeader || ''}
            onChange={(e) => setEditingUnit({ ...editingUnit, googleDocsHeader: e.target.value })}
          />
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" onClick={() => setEditSection(null)}>Отмена</Button>
            <Button variant="primary" onClick={handleSaveUnit}>Сохранить</Button>
          </div>
        </div>
      </Modal>
      
      {/* Редактирование статов */}
      <Modal
        isOpen={editSection === 'stats'}
        onClose={() => setEditSection(null)}
        title="Характеристики"
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="HP текущее"
              type="number"
              value={editingUnit.health?.current || 0}
              onChange={(e) => setEditingUnit({ 
                ...editingUnit, 
                health: { ...editingUnit.health!, current: parseInt(e.target.value) || 0 } 
              })}
            />
            <Input
              label="HP макс"
              type="number"
              value={editingUnit.health?.max || 0}
              onChange={(e) => setEditingUnit({ 
                ...editingUnit, 
                health: { ...editingUnit.health!, max: parseInt(e.target.value) || 0 } 
              })}
            />
            <Input
              label="Мана текущая"
              type="number"
              value={editingUnit.mana?.current || 0}
              onChange={(e) => setEditingUnit({ 
                ...editingUnit, 
                mana: { ...editingUnit.mana!, current: parseInt(e.target.value) || 0 } 
              })}
            />
            <Input
              label="Мана макс"
              type="number"
              value={editingUnit.mana?.max || 0}
              onChange={(e) => setEditingUnit({ 
                ...editingUnit, 
                mana: { ...editingUnit.mana!, max: parseInt(e.target.value) || 0 } 
              })}
            />
          </div>
          
          <div className="border-t border-gray-700 pt-3">
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(STAT_NAMES).map(([key, label]) => (
                <Input
                  key={key}
                  label={label}
                  type="number"
                  value={editingUnit.stats?.[key as keyof typeof STAT_NAMES] || 0}
                  onChange={(e) => setEditingUnit({
                    ...editingUnit,
                    stats: { ...editingUnit.stats!, [key]: parseInt(e.target.value) || 0 },
                  })}
                />
              ))}
            </div>
          </div>
          
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" onClick={() => setEditSection(null)}>Отмена</Button>
            <Button variant="primary" onClick={handleSaveStats}>Сохранить</Button>
          </div>
        </div>
      </Modal>
      
      {/* Редактирование владения */}
      <Modal
        isOpen={editSection === 'proficiencies'}
        onClose={() => setEditSection(null)}
        title="Владение оружием"
      >
        <div className="space-y-3">
          <p className="text-xs text-gray-400">Бонус к попаданию для каждого типа оружия</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(PROFICIENCY_NAMES).map(([key, label]) => (
              <Input
                key={key}
                label={label}
                type="number"
                value={editingUnit.weaponProficiencies?.[key as ProficiencyType] || 0}
                onChange={(e) => setEditingUnit({
                  ...editingUnit,
                  weaponProficiencies: { 
                    ...editingUnit.weaponProficiencies!, 
                    [key]: parseInt(e.target.value) || 0 
                  },
                })}
              />
            ))}
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" onClick={() => setEditSection(null)}>Отмена</Button>
            <Button variant="primary" onClick={handleSaveProficiencies}>Сохранить</Button>
          </div>
        </div>
      </Modal>
      
      {/* Редактирование магических бонусов */}
      <Modal
        isOpen={editSection === 'magic'}
        onClose={() => setEditSection(null)}
        title="Бонусы магии"
      >
        <div className="space-y-3">
          <p className="text-xs text-gray-400">Бонус к касту для каждого элемента</p>
          
          {Object.entries(editingUnit.magicBonuses || {}).map(([element, bonus]) => (
            <div key={element} className="flex gap-2 items-end">
              <Input
                label={element}
                type="number"
                value={bonus}
                onChange={(e) => setEditingUnit({
                  ...editingUnit,
                  magicBonuses: { 
                    ...editingUnit.magicBonuses, 
                    [element]: parseInt(e.target.value) || 0 
                  },
                })}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const newBonuses = { ...editingUnit.magicBonuses };
                  delete newBonuses[element];
                  setEditingUnit({ ...editingUnit, magicBonuses: newBonuses });
                }}
              >
                🗑
              </Button>
            </div>
          ))}
          
          <div className="flex gap-2 items-end">
            <Input
              id="new-element"
              placeholder="Новый элемент"
              className="flex-1"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const input = document.getElementById('new-element') as HTMLInputElement;
                if (input?.value) {
                  setEditingUnit({
                    ...editingUnit,
                    magicBonuses: { ...editingUnit.magicBonuses, [input.value]: 0 },
                  });
                  input.value = '';
                }
              }}
            >
              + Добавить
            </Button>
          </div>
          
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" onClick={() => setEditSection(null)}>Отмена</Button>
            <Button variant="primary" onClick={handleSaveMagic}>Сохранить</Button>
          </div>
        </div>
      </Modal>
      
      {/* Редактирование оружия */}
      <Modal
        isOpen={editSection === 'weapon'}
        onClose={() => setEditSection(null)}
        title={editingWeaponId ? 'Редактирование оружия' : 'Новое оружие'}
      >
        <div className="space-y-3">
          <Input
            label="Название"
            value={editingWeapon.name || ''}
            onChange={(e) => setEditingWeapon({ ...editingWeapon, name: e.target.value })}
            placeholder="Фамильная сабля"
          />
          <Input
            label="Формула урона"
            value={editingWeapon.damageFormula || ''}
            onChange={(e) => setEditingWeapon({ ...editingWeapon, damageFormula: e.target.value })}
            placeholder="5d20"
          />
          <div className="grid grid-cols-2 gap-2">
            <Select
              label="Тип урона"
              value={editingWeapon.damageType || 'slashing'}
              onChange={(e) => setEditingWeapon({ ...editingWeapon, damageType: e.target.value as Weapon['damageType'] })}
              options={[
                { value: 'slashing', label: 'Режущий' },
                { value: 'piercing', label: 'Колющий' },
                { value: 'bludgeoning', label: 'Дробящий' },
                { value: 'chopping', label: 'Рубящий' },
              ]}
            />
            <Select
              label="Тип владения"
              value={editingWeapon.proficiencyType || 'swords'}
              onChange={(e) => setEditingWeapon({ ...editingWeapon, proficiencyType: e.target.value as ProficiencyType })}
              options={Object.entries(PROFICIENCY_NAMES).map(([value, label]) => ({ value, label }))}
            />
          </div>
          <Select
            label="Бонус от характеристики"
            value={editingWeapon.statBonus || 'physicalPower'}
            onChange={(e) => setEditingWeapon({ ...editingWeapon, statBonus: e.target.value as 'physicalPower' | 'dexterity' })}
            options={[
              { value: 'physicalPower', label: 'Физ. Сила (×5)' },
              { value: 'dexterity', label: 'Ловкость (×3)' },
            ]}
          />
          <Input
            label="Особые свойства"
            value={editingWeapon.special || ''}
            onChange={(e) => setEditingWeapon({ ...editingWeapon, special: e.target.value })}
            placeholder="Опционально"
          />
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" onClick={() => setEditSection(null)}>Отмена</Button>
            <Button variant="primary" onClick={handleSaveWeapon} disabled={!editingWeapon.name}>
              Сохранить
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Редактирование заклинания */}
      <Modal
        isOpen={editSection === 'spell'}
        onClose={() => setEditSection(null)}
        title={editingSpellId ? 'Редактирование заклинания' : 'Новое заклинание'}
        size="lg"
      >
        <div className="space-y-3 max-h-96 overflow-y-auto">
          <Input
            label="Название"
            value={editingSpell.name || ''}
            onChange={(e) => setEditingSpell({ ...editingSpell, name: e.target.value })}
            placeholder="Винтовая молния"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Стоимость маны"
              type="number"
              value={editingSpell.manaCost || 0}
              onChange={(e) => setEditingSpell({ ...editingSpell, manaCost: parseInt(e.target.value) || 0 })}
            />
            <Select
              label="Тип"
              value={editingSpell.type || 'targeted'}
              onChange={(e) => setEditingSpell({ ...editingSpell, type: e.target.value as Spell['type'] })}
              options={[
                { value: 'targeted', label: 'Направленное' },
                { value: 'aoe', label: 'По площади' },
                { value: 'self', label: 'На себя' },
                { value: 'summon', label: 'Призыв' },
              ]}
            />
          </div>
          <Input
            label="Элементы (через запятую)"
            value={editingSpell.elements?.join(', ') || ''}
            onChange={(e) => setEditingSpell({ 
              ...editingSpell, 
              elements: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
            })}
            placeholder="Электричество, Астрал"
          />
          {editingSpell.type === 'targeted' && (
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Количество снарядов"
                type="number"
                value={editingSpell.projectiles || 1}
                onChange={(e) => setEditingSpell({ ...editingSpell, projectiles: parseInt(e.target.value) || 1 })}
              />
              <div className="flex items-end pb-2">
                <Checkbox
                  label="Можно увернуться"
                  checked={editingSpell.canDodge ?? true}
                  onChange={(e) => setEditingSpell({ ...editingSpell, canDodge: e.target.checked })}
                />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Формула урона"
              value={editingSpell.damageFormula || ''}
              onChange={(e) => setEditingSpell({ ...editingSpell, damageFormula: e.target.value })}
              placeholder="1d20+1d4"
            />
            <Input
              label="Тип урона"
              value={editingSpell.damageType || ''}
              onChange={(e) => setEditingSpell({ ...editingSpell, damageType: e.target.value })}
              placeholder="electricity"
            />
          </div>
          <Input
            label="Описание"
            value={editingSpell.description || ''}
            onChange={(e) => setEditingSpell({ ...editingSpell, description: e.target.value })}
            placeholder="Опциональное описание заклинания"
          />
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" onClick={() => setEditSection(null)}>Отмена</Button>
            <Button variant="primary" onClick={handleSaveSpell} disabled={!editingSpell.name}>
              Сохранить
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Диалог подтверждения удаления */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleConfirmDelete}
        title="Удаление"
        message={`Вы уверены, что хотите удалить ${
          deleteTarget?.type === 'unit' ? 'персонажа' :
          deleteTarget?.type === 'weapon' ? 'оружие' : 'заклинание'
        }?`}
        confirmText="Удалить"
        variant="danger"
      />
    </div>
  );
}
