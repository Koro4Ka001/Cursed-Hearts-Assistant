import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { EmptyState } from '../ui';

export function NotesTab() {
  const { units, selectedUnitId, setNotes } = useGameStore();
  const unit = units.find(u => u.id === selectedUnitId);
  
  const [localNotes, setLocalNotes] = useState('');
  const debounceRef = useRef<number | null>(null);
  
  // Синхронизируем локальное состояние с хранилищем при смене юнита
  useEffect(() => {
    if (unit) {
      setLocalNotes(unit.notes || '');
    }
  }, [unit?.id, unit?.notes]);
  
  // Debounced сохранение
  const handleNotesChange = (value: string) => {
    setLocalNotes(value);
    
    // Очищаем предыдущий таймер
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    // Сохраняем через 500ms после последнего изменения
    debounceRef.current = window.setTimeout(() => {
      if (unit) {
        setNotes(unit.id, value);
      }
    }, 500);
  };
  
  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);
  
  if (!unit) {
    return (
      <EmptyState
        icon="📝"
        title="Нет персонажа"
        description="Выберите персонажа для заметок"
      />
    );
  }
  
  return (
    <div className="flex flex-col h-full p-3">
      {/* Заголовок */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">📝</span>
        <h3 className="heading text-gold text-sm">
          Заметки: {unit.shortName}
        </h3>
      </div>
      
      {/* Текстовое поле на всю высоту */}
      <div className="flex-1 relative">
        <textarea
          value={localNotes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Записывайте планы, идеи, заметки...

• Важные NPC
• Квестовые цели
• Тактические заметки
• Предметы для покупки
• Что спросить у ГМа"
          className="w-full h-full resize-none p-3 rounded border border-edge-bone bg-obsidian text-bone font-garamond text-sm leading-relaxed focus:border-gold focus:shadow-[0_0_5px_var(--color-gold-dark)] outline-none"
          style={{ minHeight: '200px' }}
        />
        
        {/* Индикатор сохранения */}
        <div className="absolute bottom-2 right-2 text-xs text-faded">
          {localNotes !== (unit.notes || '') ? (
            <span className="text-gold animate-pulse">💾 Сохранение...</span>
          ) : localNotes.length > 0 ? (
            <span className="text-green-500">✓ Сохранено</span>
          ) : null}
        </div>
      </div>
      
      {/* Подсказка */}
      <div className="mt-2 text-xs text-faded text-center">
        Заметки сохраняются локально и НЕ синхронизируются с Google Docs
      </div>
      
      {/* Счётчик символов */}
      <div className="mt-1 text-xs text-dim text-center">
        {localNotes.length} символов
      </div>
    </div>
  );
}
