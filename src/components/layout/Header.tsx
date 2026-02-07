import { useGameStore } from '@/stores/gameStore';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { syncUnit } from '@/services/googleDocsService';
import { useState } from 'react';

export function Header() {
  const { units, selectedUnitId, selectUnit, getSelectedUnit, setHealth, setMana, showNotification } = useGameStore();
  const selectedUnit = getSelectedUnit();
  const [isSyncing, setIsSyncing] = useState(false);
  
  const handleSync = async () => {
    if (!selectedUnit?.googleDocsHeader) {
      showNotification('error', 'Заголовок Google Docs не настроен');
      return;
    }
    
    setIsSyncing(true);
    try {
      const result = await syncUnit(selectedUnit.googleDocsHeader);
      if (result.success && result.health && result.mana) {
        setHealth(selectedUnit.id, result.health.current, result.health.max);
        setMana(selectedUnit.id, result.mana.current, result.mana.max);
        showNotification('success', 'Данные синхронизированы!');
      } else if (result.error) {
        showNotification('error', result.error);
      }
    } catch (error) {
      showNotification('error', 'Ошибка синхронизации');
    } finally {
      setIsSyncing(false);
    }
  };
  
  return (
    <div className="bg-gradient-to-b from-gray-800 to-gray-900 border-b border-gray-700 p-3">
      {/* Title */}
      <div className="text-center mb-3">
        <h1 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-amber-400 to-red-400">
          ☠ CURSED HEARTS ☠
        </h1>
        <p className="text-xs text-gray-500">PLAYER ASSISTANT</p>
      </div>
      
      {/* Unit selector */}
      <div className="flex items-center gap-2 mb-3">
        <select
          value={selectedUnitId || ''}
          onChange={(e) => selectUnit(e.target.value || null)}
          className="flex-1 px-3 py-2 text-sm bg-gray-800 border border-gray-600 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          {units.length === 0 ? (
            <option value="">Нет персонажей</option>
          ) : (
            units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))
          )}
        </select>
        <button
          onClick={handleSync}
          disabled={isSyncing || !selectedUnit}
          className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-200 rounded-lg transition-colors"
          title="Синхронизировать с Google Docs"
        >
          {isSyncing ? '⏳' : '🔄'}
        </button>
      </div>
      
      {/* HP and Mana bars */}
      {selectedUnit && (
        <div className="space-y-2">
          <ProgressBar
            current={selectedUnit.health.current}
            max={selectedUnit.health.max}
            color="red"
            icon="🩸"
            size="md"
          />
          <ProgressBar
            current={selectedUnit.mana.current}
            max={selectedUnit.mana.max}
            color="blue"
            icon="💠"
            size="md"
          />
        </div>
      )}
    </div>
  );
}
