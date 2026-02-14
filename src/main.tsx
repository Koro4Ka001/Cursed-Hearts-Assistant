// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ToastOverlayApp } from './ToastOverlayApp';
import './index.css';

// Проверяем режим запуска
const params = new URLSearchParams(window.location.search);
const mode = params.get('mode');

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

createRoot(rootElement).render(
  <StrictMode>
    {mode === 'toast' ? <ToastOverlayApp /> : <App />}
  </StrictMode>
);
