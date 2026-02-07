import { useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { roll, formatRollResult } from '@/services/diceService';
import { writeLog } from '@/services/googleDocsService';
import { showNotification } from '@/services/owlbearService';
import type { QuickAction, RollResult } from '@/types';

export function ActionsTab() {
  const { getSelectedUnit, addQuickAction, deleteQuickAction, settings, addLog } = useGameStore();
  const unit = getSelectedUnit();
  
  // Модальное окно добавления действия
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAction, setNewAction] = useState<Partial<QuickAction>>({
    name: '',
    icon: '🎯',
    diceFormula: '',
    description: '',
  });
  
  // Модальное окно результата
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
  
  const handleAddAction = () => {
    if (!newAction.name) return;
    
    addQuickAction(unit.id, {
      name: newAction.name,
      icon: newAction.icon || '🎯',
      diceFormula: newAction.diceFormula,
      description: newAction.description,
    });
    
    setShowAddModal(false);
    setNewAction({
      name: '',
      icon: '🎯',
      diceFormula: '',
      description: '',
    });
  };
  
  const handleExecuteAction = async (action: QuickAction) => {
    let message = `${action.icon} ${action.name}`;
    let rollResult: RollResult | null = null;
    
    if (action.diceFormula) {
      rollResult = await roll(action.diceFormula);
      setLastRoll(rollResult);
      message += `: ${rollResult.total}`;
      
      await showNotification(`${action.icon} ${unit.shortName}: ${action.name} = ${rollResult.total}`);
    } else {
      await showNotification(`${action.icon} ${unit.shortName}: ${action.name}`);
    }
    
    if (action.description) {
      message += `\n${action.description}`;
    }
    
    setResultMessage(message);
    setShowResultModal(true);
    
    const logAction = action.diceFormula 
      ? `${action.name}: ${action.diceFormula} = ${rollResult?.total}`
      : action.name;
    addLog({ unitName: unit.shortName, action: logAction });
    if (settings.googleWebAppUrl && unit.googleDocsHeader) {
      await writeLog(unit.googleDocsHeader, unit.shortName, logAction);
    }
  };
  
  // Предустановленные действия
  const presetActions: Omit<QuickAction, 'id'>[] = [
    { name: 'Уворот', icon: '🔄', diceFormula: '1d20', description: 'Попытка увернуться от атаки' },
    { name: 'Инициатива', icon: '⚡', diceFormula: `1d20+${unit.stats.initiative}`, description: 'Бросок инициативы' },
    { name: 'Восприятие', icon: '👁️', diceFormula: '1d20', description: 'Проверка восприятия' },
    { name: 'Харизма', icon: '💬', diceFormula: `1d20+${unit.stats.charisma}`, description: 'Проверка харизмы' },
  ];
  
  return (
    <div className="p-3 space-y-4 overflow-y-auto max-h-[calc(100vh-280px)]">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
          <span>🎯</span> Быстрые действия
        </h3>
        <Button size="sm" variant="secondary" onClick={() => setShowAddModal(true)}>
          + Добавить
        </Button>
      </div>
      
      {/* Кастомные действия */}
      {unit.quickActions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-gray-400">Мои действия</h4>
          <div className="grid grid-cols-2 gap-2">
            {unit.quickActions.map(action => (
              <div
                key={action.id}
                className="relative bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden"
              >
                <button
                  onClick={() => handleExecuteAction(action)}
                  className="w-full p-3 text-left hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{action.icon}</span>
                    <span className="font-medium text-gray-200 text-sm">{action.name}</span>
                  </div>
                  {action.diceFormula && (
                    <div className="text-xs text-gray-500 mt-1">🎲 {action.diceFormula}</div>
                  )}
                </button>
                <button
                  onClick={() => deleteQuickAction(unit.id, action.id)}
                  className="absolute top-1 right-1 text-xs text-gray-500 hover:text-red-400 transition-colors p-1"
                  title="Удалить"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Предустановленные действия */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-gray-400">Стандартные проверки</h4>
        <div className="grid grid-cols-2 gap-2">
          {presetActions.map((action, index) => (
            <button
              key={index}
              onClick={() => handleExecuteAction({ ...action, id: `preset-${index}` })}
              className="p-3 text-left bg-gray-800/30 rounded-lg border border-gray-700/50 hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{action.icon}</span>
                <span className="font-medium text-gray-300 text-sm">{action.name}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">🎲 {action.diceFormula}</div>
            </button>
          ))}
        </div>
      </div>
      
      {/* Общие броски */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-gray-400">Быстрые броски</h4>
        <div className="flex flex-wrap gap-2">
          {['1d4', '1d6', '1d8', '1d10', '1d12', '1d20', '1d100', '2d6', '3d6'].map(formula => (
            <Button
              key={formula}
              variant="ghost"
              size="sm"
              onClick={async () => {
                const result = await roll(formula);
                setLastRoll(result);
                setResultMessage(`🎲 ${formula} = ${result.total}`);
                setShowResultModal(true);
                await showNotification(`🎲 ${unit.shortName}: ${formula} = ${result.total}`);
                addLog({ unitName: unit.shortName, action: `бросает ${formula} = ${result.total}` });
              }}
            >
              {formula}
            </Button>
          ))}
        </div>
      </div>
      
      {/* Модальное окно добавления действия */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Добавить действие"
      >
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              label="Иконка"
              value={newAction.icon}
              onChange={(e) => setNewAction({ ...newAction, icon: e.target.value })}
              className="w-16 text-center text-xl"
            />
            <div className="flex-1">
              <Input
                label="Название"
                value={newAction.name}
                onChange={(e) => setNewAction({ ...newAction, name: e.target.value })}
                placeholder="Уворот"
              />
            </div>
          </div>
          
          <Input
            label="Формула броска (опционально)"
            value={newAction.diceFormula}
            onChange={(e) => setNewAction({ ...newAction, diceFormula: e.target.value })}
            placeholder="1d20+2"
          />
          
          <Input
            label="Описание (опционально)"
            value={newAction.description}
            onChange={(e) => setNewAction({ ...newAction, description: e.target.value })}
            placeholder="Описание действия"
          />
          
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>
              Отмена
            </Button>
            <Button variant="primary" onClick={handleAddAction} disabled={!newAction.name}>
              Добавить
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Модальное окно результата */}
      <Modal
        isOpen={showResultModal}
        onClose={() => setShowResultModal(false)}
        title="🎲 Результат"
      >
        <div className="text-center py-4 whitespace-pre-line">
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
