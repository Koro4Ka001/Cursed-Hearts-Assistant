export interface RokEffect {
  id: number;
  name: string;
  description: string;
  additionalRolls?: string[];
  requiresSuccessCheck?: boolean;
}

export const ROK_EFFECTS: RokEffect[] = [
  { id: 1, name: 'Стихийный удар', description: 'Накидывает эффект элемента (d12). Огонь поджигает, тьма слепит.', additionalRolls: ['d12'] },
  { id: 2, name: 'Элементальный барьер', description: 'Блокирует ВЕСЬ урон от случайного элемента (d12) на 1 раунд.', additionalRolls: ['d12'] },
  { id: 3, name: 'Архитектор хаоса', description: 'Создаёт постройку, размер по d6.', additionalRolls: ['d6'] },
  { id: 4, name: 'Целительный поток', description: 'd4, каждая единица = +d12 HP.', additionalRolls: ['d4'] },
  { id: 5, name: 'Восстание мёртвых', description: 'Призывает БЕСКОНТРОЛЬНУЮ нежить! Атакует ВСЕХ! Сила: d20.', additionalRolls: ['d20'] },
  { id: 6, name: 'Чистое разрушение', description: 'd4, каждая единица = +d12 чистого урона.', additionalRolls: ['d4'] },
  { id: 7, name: 'Инверсия удачи', description: '1=удача, 20=неудача. 8 раундов на ВСЕХ!' },
  { id: 8, name: 'Зеркальный двойник', description: 'Копия цели. Проверка d20 > 11.', requiresSuccessCheck: true },
  { id: 9, name: 'Нестабильная аура', description: '5 раундов. d4: 1-взрыв предметов, 2-+2 силы, 3-удар 2d20, 4-союзник.', additionalRolls: ['d4'] },
  { id: 10, name: 'Магический хаос', description: 'Случайное заклинание (d10).', additionalRolls: ['d10'] },
  { id: 11, name: 'Метка смерти', description: 'Следующий урон по цели УДВАИВАЕТСЯ. 1 раунд.' },
  { id: 12, name: 'Червоточина', description: 'Открывается червоточина.' },
  { id: 13, name: 'Рикошет неудачи', description: 'Летит в БЛИЖАЙШЕЕ существо. НОВЫЙ бросок d20 на эффект.' },
  { id: 14, name: 'Временной щит', description: 'ОТМЕНЯЕТ весь урон этого раунда.' },
  { id: 15, name: 'Мутация', description: 'Характеристика (d6): d20<11 = -10, ≥11 = +10. 3 раунда.', additionalRolls: ['d6'], requiresSuccessCheck: true },
  { id: 16, name: 'Боевая ярость', description: '+20 урон, +40 HP.' },
  { id: 17, name: 'Раздвоение', description: 'Бросить ещё 2 карты БЕЗ траты ресурса!' },
  { id: 18, name: 'Портал измерений', description: 'd8: 1-Ад, 2-Пустота, 3-Лёд, 4-Эфир, 5-Мёртвые, 6-Кошмары, 7-Скверна, 8-Облачность.', additionalRolls: ['d8'] },
  { id: 19, name: 'Ужас', description: 'Цель пытается сбежать (если поддаётся страху).' },
  { id: 20, name: 'Обмен жизнями', description: 'Обмен HP на 6 раундов. Проверка d20 > 11.', requiresSuccessCheck: true },
];

export function getRokEffect(id: number): RokEffect {
  return ROK_EFFECTS.find(e => e.id === id) || ROK_EFFECTS[0];
}
