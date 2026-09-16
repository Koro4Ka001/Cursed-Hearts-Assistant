// src/components/BonusDamageField.tsx
// «Заряженный урон»: доп. урон к СЛЕДУЮЩЕЙ атаке/касту с уроном.
// Формула — как кубы (2d6), так и просто число (5). Поле очищается само.

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../stores/useGameStore';
import { Input, Select } from './ui';
import { PHYSICAL_DAMAGE_TYPES, MAGICAL_DAMAGE_TYPES, DAMAGE_TYPE_NAMES } from '../types';
import type { DamageType } from '../types';

type Category = 'pure' | 'physical' | 'magical';

export function BonusDamageField() {
  const pending = useGameStore(s => s.pendingBonusDamage);
  const setPendingBonusDamage = useGameStore(s => s.setPendingBonusDamage);

  const [formula, setFormula] = useState(pending?.formula ?? '');
  const [category, setCategory] = useState<Category>(
    pending
      ? pending.damageType === 'pure'
        ? 'pure'
        : PHYSICAL_DAMAGE_TYPES.includes(pending.damageType)
          ? 'physical'
          : 'magical'
      : 'pure'
  );
  const [subType, setSubType] = useState<DamageType>(
    pending && pending.damageType !== 'pure' ? pending.damageType : 'slashing'
  );

  // 🔧 Очищаем поле, когда заряд списан атакой/кастом (store → null)
  const hadPendingRef = useRef(false);
  useEffect(() => {
    if (pending) {
      hadPendingRef.current = true;
    } else if (hadPendingRef.current) {
      hadPendingRef.current = false;
      setFormula('');
      setCategory('pure');
    }
  }, [pending]);

  const commit = (f: string, cat: Category, sub: DamageType) => {
    const type: DamageType = cat === 'pure' ? 'pure' : sub;
    setPendingBonusDamage(f.trim() ? { formula: f.trim(), damageType: type } : null);
  };

  const typeLabel = (t: DamageType) => DAMAGE_TYPE_NAMES[t] ?? t;

  return (
    <div className="p-2 bg-obsidian rounded border border-edge-bone space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-ancient font-cinzel uppercase tracking-wider">💠 Урон на следующую атаку</span>
        {pending && (
          <button
            onClick={() => { setFormula(''); setPendingBonusDamage(null); }}
            className="text-xs text-faded hover:text-blood"
            title="Разрядить"
          >✕</button>
        )}
      </div>
      <Input
        label="Формула или число"
        value={formula}
        placeholder="2d6 или 5"
        onChange={(e) => { setFormula(e.target.value); commit(e.target.value, category, subType); }}
      />
      <Select
        label="Тип урона"
        value={category}
        onChange={(e) => {
          const cat = e.target.value as Category;
          setCategory(cat);
          const newSub: DamageType = cat === 'physical'
            ? PHYSICAL_DAMAGE_TYPES[0]!
            : cat === 'magical'
              ? MAGICAL_DAMAGE_TYPES[0]!
              : subType;
          if (cat !== 'pure') setSubType(newSub);
          commit(formula, cat, newSub);
        }}
        options={[
          { value: 'pure', label: '✦ Чистый' },
          { value: 'physical', label: '⚔️ Физический' },
          { value: 'magical', label: '✨ Магический' },
        ]}
      />
      {category !== 'pure' && (
        <Select
          label={category === 'physical' ? 'Вид (физ.)' : 'Стихия (маг.)'}
          value={subType}
          onChange={(e) => {
            const st = e.target.value as DamageType;
            setSubType(st);
            commit(formula, category, st);
          }}
          options={(category === 'physical' ? PHYSICAL_DAMAGE_TYPES : MAGICAL_DAMAGE_TYPES)
            .map(t => ({ value: t, label: typeLabel(t) }))}
        />
      )}
      {pending && (
        <div className="text-[11px] text-purple-400">
          ⚡ Заряжено: <strong>{pending.formula}</strong> ({typeLabel(pending.damageType)}) — сгорит на первой попытке атаки/каста, даже при промахе
        </div>
      )}
    </div>
  );
}
