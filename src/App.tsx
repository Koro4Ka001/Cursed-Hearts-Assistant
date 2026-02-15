// src/App.tsx
import { useEffect, useState } from 'react';
import OBR from '@owlbear-rodeo/sdk';
import { tokenBarService } from './services/tokenBarService';

export function App() {
  const [message, setMessage] = useState('Загрузка...');

  useEffect(() => {
    const init = async () => {
      try {
        // Ждём готовности OBR
        await OBR.scene.isReady();
        setMessage('OBR готов!');
        
        // Создаём тестовый бар
        const items = await OBR.scene.items.getItems();
        const tokens = items.filter(item => item.type === 'TOKEN');
        
        if (tokens.length > 0) {
          const tokenId = tokens[0].id;
          await tokenBarService.createBars(tokenId, 50, 100, 30, 50, false);
          setMessage('Бары созданы над первым токеном!');
        } else {
          setMessage('Нет токенов на сцене');
        }
      } catch (error) {
        console.error('Ошибка:', error);
        setMessage('Ошибка: ' + (error as Error).message);
      }
    };

    OBR.onReady(init);
  }, []);

  return (
    <div style={{
      padding: '20px',
      color: 'white',
      backgroundColor: 'black',
      fontFamily: 'Arial',
      minHeight: '100vh'
    }}>
      <h1>Тест баров</h1>
      <p>{message}</p>
      <button 
        onClick={async () => {
          try {
            const items = await OBR.scene.items.getItems();
            const tokens = items.filter(item => item.type === 'TOKEN');
            if (tokens.length > 0) {
              const tokenId = tokens[0].id;
              await tokenBarService.createBars(tokenId, 75, 100, 40, 50, false);
              setMessage('Бары обновлены!');
            }
          } catch (error) {
            console.error('Кнопка ошибка:', error);
          }
        }}
        style={{
          padding: '10px 20px',
          backgroundColor: '#cc2222',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Обновить бары
      </button>
    </div>
  );
}
