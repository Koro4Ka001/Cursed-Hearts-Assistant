import { useGameStore } from '../stores/useGameStore';
import { Button } from './ui';

export function UnitSelector() {
  const {
    units,
    selectedUnitId,
    selectUnit,
    isSyncing,
    syncFromDocs
  } = useGameStore();
  
  const selectedUnit = units.find(u => u.id === selectedUnitId);
  
  const handleSync = async () => {
    if (selectedUnitId) {
      await syncFromDocs(selectedUnitId);
    }
  };
  
  if (units.length === 0) {
    return (
      <div className="flex items-center justify-center h-10 px-3 bg-obsidian border-b border-edge-bone">
        <span className="text-faded text-sm font-garamond">
          Создайте персонажа в настройках →
        </span>
      </div>
    );
  }
  
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
        disabled={!selectedUnit?.googleDocsHeader}
        title={selectedUnit?.googleDocsHeader ? 'Синхронизировать с Google Docs' : 'Нет привязки к Google Docs'}
      >
        🔄
      </Button>
    </div>
  );
}
