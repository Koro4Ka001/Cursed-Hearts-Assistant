// src/components/UnitSelector.tsx
import { useState } from 'react';
import { useGameStore } from '../stores/useGameStore';
import { Button } from './ui';

export function UnitSelector() {
  const {
    units,
    selectedUnitId,
    selectUnit,
    pullStatsFromDocs,
    addNotification,
    settings,
    connections,
    setActiveTab
  } = useGameStore();
  
  const [isSyncing, setIsSyncing] = useState(false);
  
  const selectedUnit = units.find(u => u.id === selectedUnitId);
  
  const handleSync = async () => {
    if (!selectedUnitId || !selectedUnit) return;
    
    if (!settings.googleDocsUrl) {
      addNotification('Настройте URL Google Docs в настройках', 'warning');
      return;
    }
    
    if (!selectedUnit.googleDocsHeader) {
      addNotification('Укажите заголовок Google Docs для персонажа', 'warning');
      return;
    }
    
    setIsSyncing(true);
    try {
      await pullStatsFromDocs(selectedUnitId);
      addNotification(`📥 ${selectedUnit.shortName || selectedUnit.name}: синхронизировано`, 'success');
    } catch (e) {
      console.error('[UnitSelector] Sync failed:', e);
      addNotification('Ошибка синхронизации', 'error');
    } finally {
      setIsSyncing(false);
    }
  };
  
  // Если нет юнитов — показываем подсказку
  if (units.length === 0) {
    return (
      <div className="flex items-center justify-center h-11 px-3 bg-obsidian border-b border-edge-bone">
        <button
          onClick={() => setActiveTab('settings')}
          className="text-gold hover:text-gold-bright text-[13px] font-garamond transition-colors"
        >
          ✨ Создайте первого персонажа в настройках →
        </button>
      </div>
    );
  }
  
  // Проверяем, можно ли синхронизировать
  const canSync = !!(selectedUnit?.googleDocsHeader && settings.googleDocsUrl);
  
  // Формируем подсказку для кнопки синхронизации
  const getSyncTitle = (): string => {
    if (!settings.googleDocsUrl) {
      return 'Настройте URL Google Docs в настройках';
    }
    if (!selectedUnit?.googleDocsHeader) {
      return 'Укажите заголовок Google Docs для персонажа';
    }
    return 'Синхронизировать с Google Docs';
  };
  
  return (
    <div className="flex items-center gap-2 h-11 px-3 bg-obsidian border-b border-edge-bone">
      <select
        value={selectedUnitId ?? ''}
        onChange={(e) => selectUnit(e.target.value)}
        className="flex-1 bg-dark border border-edge-bone text-bone rounded-lg px-3 py-1.5 font-garamond text-[13px] cursor-pointer focus:border-gold focus:ring-2 focus:ring-gold/15 outline-none transition-all"
      >
        {units.map(unit => (
          <option key={unit.id} value={unit.id}>
            {unit.name}
          </option>
        ))}
      </select>
      
      <Button
        variant="secondary"
        size="sm"
        onClick={handleSync}
        loading={isSyncing}
        disabled={!canSync || isSyncing}
        title={getSyncTitle()}
      >
        🔄
      </Button>
    </div>
  );
}
