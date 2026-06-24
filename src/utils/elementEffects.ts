import type { CastContext } from '../types';

export interface ElementEffectResult {
  triggered: boolean;
  element: string;
  effectName: string;
  description: string;
  icon: string;
  stackable: boolean;
  bonusDamage?: number;
  special?: string;
}

export interface SpellElementEffects {
  castRollRaw: number;
  effects: ElementEffectResult[];
  totalBonusDamage: number;
  manaCostModifier: number;
}

function getRawD20(context: CastContext): number {
  const castRoll = context.rolls.find(r => r.formula.includes('d20'));
  return castRoll?.rawD20 ?? 0;
}

function hasElement(spellElements: string[], element: string): boolean {
  return spellElements.some(e => e.toLowerCase() === element.toLowerCase());
}

export function evaluateElementEffects(
  spellElements: string[],
  context: CastContext
): SpellElementEffects {
  const rawD20 = getRawD20(context);
  const effects: ElementEffectResult[] = [];

  if (hasElement(spellElements, 'огонь')) {
    effects.push({
      triggered: true,
      element: 'огонь',
      effectName: 'Поджигание',
      description: 'Цель горит: 8d4 каждый ход',
      icon: '🔥',
      stackable: false,
    });
  }

  if (hasElement(spellElements, 'вода')) {
    effects.push({
      triggered: true,
      element: 'вода',
      effectName: 'Растворение брони',
      description: 'Броня цели −8',
      icon: '💧',
      stackable: true,
    });
  }

  if (hasElement(spellElements, 'земля')) {
    effects.push({
      triggered: true,
      element: 'земля',
      effectName: 'Сотрясение',
      description: '+15 урона по наземным целям',
      icon: '🪨',
      stackable: true,
      bonusDamage: 15,
    });
  }

  if (hasElement(spellElements, 'воздух')) {
    effects.push({
      triggered: true,
      element: 'воздух',
      effectName: 'Ураган',
      description: '+15 урона по воздушным целям',
      icon: '💨',
      stackable: true,
      bonusDamage: 15,
    });
  }

  if (hasElement(spellElements, 'свет')) {
    effects.push({
      triggered: true,
      element: 'свет',
      effectName: 'Освящение',
      description: '+15 урона по нежити',
      icon: '✨',
      stackable: true,
      bonusDamage: 15,
    });
  }

  if (hasElement(spellElements, 'пространство')) {
    effects.push({
      triggered: true,
      element: 'пространство',
      effectName: 'Сквозная проекция',
      description: 'Атаки проходят сквозь твёрдую поверхность',
      icon: '🌀',
      stackable: false,
    });
  }

  if (hasElement(spellElements, 'астрал')) {
    const triggered = rawD20 > 18;
    effects.push({
      triggered,
      element: 'астрал',
      effectName: 'Астральный резонанс',
      description: triggered
        ? 'Чистая прокидка >18: половина цены заклинания'
        : `Прокидка ${rawD20} (нужно >18)`,
      icon: '🌟',
      stackable: false,
      special: triggered ? 'half_cost' : undefined,
    });
  }

  if (hasElement(spellElements, 'скверна')) {
    effects.push({
      triggered: true,
      element: 'скверна',
      effectName: 'Заражение',
      description: 'Атака противника −15',
      icon: '☠️',
      stackable: true,
    });
  }

  if (hasElement(spellElements, 'электричество')) {
    effects.push({
      triggered: true,
      element: 'электричество',
      effectName: 'Миозит',
      description: 'Входящий урон от других источников +15',
      icon: '⚡',
      stackable: true,
    });
  }

  if (hasElement(spellElements, 'тьма')) {
    effects.push({
      triggered: true,
      element: 'тьма',
      effectName: 'Ослабление',
      description: '+15 урона по светлым сущностям',
      icon: '🌑',
      stackable: true,
      bonusDamage: 15,
    });
  }

  if (hasElement(spellElements, 'пустота')) {
    const triggered = rawD20 > 18;
    effects.push({
      triggered,
      element: 'пустота',
      effectName: 'Поглощение',
      description: triggered
        ? 'Чистая прокидка >18: отмена всех действий цели'
        : `Прокидка ${rawD20} (нужно >18)`,
      icon: '🕳️',
      stackable: false,
      special: triggered ? 'cancel_actions' : undefined,
    });
  }

  if (hasElement(spellElements, 'жизнь')) {
    const triggered = rawD20 > 16;
    effects.push({
      triggered,
      element: 'жизнь',
      effectName: 'Восстановление',
      description: triggered
        ? 'Чистая прокидка >16: восстановление d8 HP владельцу'
        : `Прокидка ${rawD20} (нужно >16)`,
      icon: '💚',
      stackable: false,
      special: triggered ? 'heal_d8' : undefined,
    });
  }

  if (hasElement(spellElements, 'природа')) {
    const triggered = rawD20 > 17;
    effects.push({
      triggered,
      element: 'природа',
      effectName: 'Опутывание',
      description: triggered
        ? 'Чистая прокидка >17: цель опутана корнями на 1 раунд'
        : `Прокидка ${rawD20} (нужно >17)`,
      icon: '🌿',
      stackable: false,
      special: triggered ? 'root_1_round' : undefined,
    });
  }

  if (hasElement(spellElements, 'смерть')) {
    effects.push({
      triggered: true,
      element: 'смерть',
      effectName: 'Некротическая волна',
      description: '+20 урона по живым существам',
      icon: '💀',
      stackable: true,
      bonusDamage: 20,
    });
  }

  const triggeredEffects = effects.filter(e => e.triggered);
  const totalBonusDamage = triggeredEffects.reduce((sum, e) => sum + (e.bonusDamage ?? 0), 0);

  let manaCostModifier = 0;
  if (hasElement(spellElements, 'астрал') && rawD20 > 18) {
    manaCostModifier = -0.5;
  }

  return {
    castRollRaw: rawD20,
    effects,
    totalBonusDamage,
    manaCostModifier,
  };
}

export function formatElementEffectLog(result: SpellElementEffects): string[] {
  const lines: string[] = [];
  const triggered = result.effects.filter(e => e.triggered);

  if (triggered.length === 0) return lines;

  for (const effect of triggered) {
    lines.push(`${effect.icon} **${effect.effectName}**: ${effect.description}`);
  }

  if (result.totalBonusDamage > 0) {
    lines.push(`📈 Суммарный доп. урон: +${result.totalBonusDamage}`);
  }

  if (result.manaCostModifier < 0) {
    lines.push(`💠 Стоимость снижена на 50% (астрал)`);
  }

  return lines;
}
