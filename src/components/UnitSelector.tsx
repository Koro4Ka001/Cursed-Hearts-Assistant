import { useGameStore } from '../stores/useGameStore';
import { Button } from './ui';

export function UnitSelector() {
  const {
    units,
    selectedUnitId,
    selectUnit,
    isSyncing,
    syncFromDocs,
    settings,
    setActiveTab
  } = useGameStore();
  
  const selectedUnit = units.find(u => u.id === selectedUnitId);
  
  const handleSync = async () => {
    if (selectedUnitId) {
      // showNotifications = true для ручной синхронизации
      await syncFromDocs(selectedUnitId, true);
    }
  };
  
  // Если нет юнитов — показываем подсказку
  if (units.length === 0) {
    return (
      <div className="flex items-center justify-center h-10 px-3 bg-obsidian border-b border-edge-bone">
        <button
          onClick={() => setActiveTab('settings')}
          className="text-gold hover:text-gold-bright text-sm font-garamond transition-colors"
        >
          ✨ Создайте первого персонажа в настройках →
        </button>
      </div>
    );
  }
  
  // Проверяем, можно ли синхронизировать
  const canSync = selectedUnit?.googleDocsHeader && settings.googleDocsUrl;
  
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
    <div className="flex items-center gap-2 h-10 px-3 bg-obsidian border-b border-edge-bone">
      <select
        value={selectedUnitId ?? ''}
        onChange={(e) => selectUnit(e.target.value)}
        className="flex-1 bg-dark border border-edge-bone text-bone rounded px-2 py-1 font-garamond text-sm cursor-pointer focus:border-gold outline-none"
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
