import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { Textarea, EmptyState } from '../ui';

export function NotesTab() {
  const { units, selectedUnitId, setNotes } = useGameStore();
  const unit = units.find(u => u.id === selectedUnitId);
  
  const [localNotes, setLocalNotes] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Синхронизируем локальное состояние с юнитом
  useEffect(() => {
    if (unit) {
      setLocalNotes(unit.notes ?? '');
    }
  }, [unit?.id, unit?.notes]);
  
  // Очистка debounce при размонтировании
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);
  
  // Защита от отсутствия юнита
  if (!unit) {
    return (
      <EmptyState
        icon="📝"
        title="Нет персонажа"
        description="Выберите персонажа для заметок"
      />
    );
  }
  
  // Обработчик изменения заметок с debounce
  const handleNotesChange = (value: string) => {
    setLocalNotes(value);
    
    // Отменяем предыдущий таймер
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    // Сохраняем через 500ms после последнего изменения
    debounceRef.current = setTimeout(() => {
      setNotes(unit.id, value);
    }, 500);
  };
  
  return (
    <div className="h-full flex flex-col p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="heading text-gold text-sm flex items-center gap-2">
          📝 Заметки — {unit.shortName}
        </h3>
        <span className="text-xs text-faded">
          {localNotes.length} символов
        </span>
      </div>
      
      <div className="flex-1 min-h-0">
        <Textarea
          value={localNotes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Записывайте планы, идеи, заметки...

• Цели на сессию
• Важные NPC
• Квесты
• Лут
• Идеи для отыгрыша"
          className="h-full text-sm"
        />
      </div>
      
      <div className="mt-2 text-xs text-faded text-center">
        💾 Автосохранение • Только локально
      </div>
    </div>
  );
}
