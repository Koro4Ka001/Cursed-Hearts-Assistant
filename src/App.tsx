// src/App.tsx
import { useEffect, useState } from 'react';
import OBR from '@owlbear-rodeo/sdk';
import { tokenBarService } from './services/tokenBarService';

export function App() {
  const [message, 
