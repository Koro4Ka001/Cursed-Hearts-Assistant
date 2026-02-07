import { useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { roll, formatRollResult } from '@/services/diceService';
import { writeLog } from '@/services/googleDocsService';
import { showNotification } from '@/services/owlbearService';
import { DAMAGE_TYPE_NAMES } from '@/types';
import type { Resource, RollResult } from '@/types';

export function ResourcesTab() {
  const { getSelectedUnit, modifyResourceAmount, addResource, deleteResource, settings, addLog } = useGameStore();
  const unit = getSelectedUnit();
  
  // Модальное окно добавления ресурса
  const [showAddModal, setShowAddModal] = useState(false);
  const [newResource, setNewResource] = useState<Partial<Resource>>({
    name: '',
    icon: '📦',
    current: 0,
    max: 10,
    isConsumableWeapon: false,
  });
  
  // Модальное окно результата атаки
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const [lastRoll, setLastRoll] = useState<RollResult | null>(null);
  
  if (!unit) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <p>Выберите персонажа</p>
      </div>
    );
  }
  
  const handleAddResource = () => {
    if (!newResource.name) return;
    
    addResource(unit.id, {
      name: newResource.name,
      icon: newResource.icon || '📦',
      current: newResource.current || 0,
      max: newResource.max || 10,
      isConsumableWeapon: newResource.isConsumableWeapon,
      damageFormula: newResource.damageFormula,
      damageType: newResource.damageType,
    });
    
    setShowAddModal(false);
    setNewResource({
      name: '',
      icon: '📦',
      current: 0,
      max: 10,
      isConsumableWeapon: false,
    });
  };
  
  const handleUseConsumable = async (resource: Resource) => {
    if (resource.current <= 0 || !resource.damageFormula) return;
    
    // Уменьшаем количество
    modifyResourceAmount(unit.id, resource.id, -1);
    
    // Бросаем урон
    const damageRoll = await roll(resource.damageFormula);
    setLastRoll(damageRoll);
    
    const damageTypeName = DAMAGE_TYPE_NAMES[resource.damageType || ''] || resource.damageType || 'урона';
    const message = `💥 ${resource.name}: ${damageRoll.total} ${damageTypeName}`;
    
    setResultMessage(message);
    setShowResultModal(true);
    
    await showNotification(`🏹 ${unit.shortName}: ${damageRoll.total} ${damageTypeName}`);
    
    const logAction = `использует ${resource.name}: ${damageRoll.total} ${damageTypeName} (осталось ${resource.current - 1})`;
    addLog({ unitName: unit.shortName, action: logAction });
    if (settings.googleWebAppUrl && unit.googleDocsHeader) {
      await writeLog(unit.googleDocsHeader, unit.shortName, logAction);
    }
  };
  
  return (
    <div className="p-3 space-y-4 overflow-y-auto max-h-[calc(100vh-280px)]">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
          <span>📦</span> Ресурсы
        </h3>
        <Button size="sm" variant="secondary" onClick={() => setShowAddModal(true)}>
          + Добавить
        </Button>
      </div>
      
      {unit.resources.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-8">
          Нет ресурсов. Добавьте стрелы, зелья или другие расходники.
        </p>
      ) : (
        <div className="space-y-3">
          {unit.resources.map(resource => (
            <div
              key={resource.id}
              className="bg-gray-800/50 rounded-lg p-3 border border-gray-700"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{resource.icon}</span>
                  <span className="font-medium text-gray-200">{resource.name}</span>
                </div>
                <button
                  onClick={() => deleteResource(unit.id, resource.id)}
                  className="text-gray-500 hover:text-red-400 transition-colors"
                  title="Удалить"
                >
                  🗑
                </button>
              </div>
              
              {resource.isConsumableWeapon && resource.damageFormula && (
                <div className="text-xs text-gray-400 mb-2">
                  💥 {resource.damageFormula} {DAMAGE_TYPE_NAMES[resource.damageType || ''] || resource.damageType || ''}
                </div>
              )}
              
              <ProgressBar
                current={resource.current}
                max={resource.max}
                color="amber"
                size="sm"
              />
              
              <div className="flex items-center justify-center gap-2 mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => modifyResourceAmount(unit.id, resource.id, -5)}
                  disabled={resource.current <= 0}
                >
                  -5
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => modifyResourceAmount(unit.id, resource.id, -1)}
                  disabled={resource.current <= 0}
                >
                  -1
                </Button>
                <span className="px-3 text-sm font-mono text-gray-300">
                  {resource.current}/{resource.max}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => modifyResourceAmount(unit.id, resource.id, 1)}
                  disabled={resource.current >= resource.max}
                >
                  +1
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => modifyResourceAmount(unit.id, resource.id, 5)}
                  disabled={resource.current >= resource.max}
                >
                  +5
                </Button>
              </div>
              
              {resource.isConsumableWeapon && (
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => handleUseConsumable(resource)}
                  disabled={resource.current <= 0}
                >
                  🎯 Использовать
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Модальное окно добавления ресурса */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Добавить ресурс"
      >
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              label="Иконка"
              value={newResource.icon}
              onChange={(e) => setNewResource({ ...newResource, icon: e.target.value })}
              className="w-16 text-center text-xl"
            />
            <div className="flex-1">
              <Input
                label="Название"
                value={newResource.name}
                onChange={(e) => setNewResource({ ...newResource, name: e.target.value })}
                placeholder="Стрелы"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <Input
              label="Текущее"
              type="number"
              value={newResource.current}
              onChange={(e) => setNewResource({ ...newResource, current: parseInt(e.target.value) || 0 })}
              min={0}
            />
            <Input
              label="Максимум"
              type="number"
              value={newResource.max}
              onChange={(e) => setNewResource({ ...newResource, max: parseInt(e.target.value) || 1 })}
              min={1}
            />
          </div>
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={newResource.isConsumableWeapon}
              onChange={(e) => setNewResource({ ...newResource, isConsumableWeapon: e.target.checked })}
              className="w-4 h-4 bg-gray-800 border-gray-600 rounded text-amber-500"
            />
            <span className="text-sm text-gray-300">Расходуемое оружие (стрелы)</span>
          </label>
          
          {newResource.isConsumableWeapon && (
            <div className="flex gap-2">
              <Input
                label="Формула урона"
                value={newResource.damageFormula || ''}
                onChange={(e) => setNewResource({ ...newResource, damageFormula: e.target.value })}
                placeholder="6d10"
              />
              <Input
                label="Тип урона"
                value={newResource.damageType || ''}
                onChange={(e) => setNewResource({ ...newResource, damageType: e.target.value })}
                placeholder="piercing"
              />
            </div>
          )}
          
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>
              Отмена
            </Button>
            <Button variant="primary" onClick={handleAddResource} disabled={!newResource.name}>
              Добавить
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Модальное окно результата */}
      <Modal
        isOpen={showResultModal}
        onClose={() => setShowResultModal(false)}
        title="💥 Урон нанесён!"
      >
        <div className="text-center py-4">
          <p className="text-lg font-semibold text-amber-400">
            {resultMessage}
          </p>
          {lastRoll && (
            <p className="text-xs text-gray-500 mt-2">{formatRollResult(lastRoll)}</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
