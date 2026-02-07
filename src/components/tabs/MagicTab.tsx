import { useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { Button } from '@/components/ui/Button';
import { Input, Checkbox } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { roll, formatRollResult } from '@/services/diceService';
import { writeLog, modifyMana as syncMana } from '@/services/googleDocsService';
import { showNotification } from '@/services/owlbearService';
import { DAMAGE_TYPE_NAMES } from '@/types';
import type { Spell, RollResult } from '@/types';

export function MagicTab() {
  const { getSelectedUnit, modifyMana, setMana, settings, addLog } = useGameStore();
  const unit = getSelectedUnit();
  
  // Состояние каста
  const [selectedSpellId, setSelectedSpellId] = useState<string>('');
  const [isDoubleShot, setIsDoubleShot] = useState(false);
  const [castState, setCastState] = useState<'idle' | 'casting' | 'projectiles' | 'complete'>('idle');
  const [castResult, setCastResult] = useState<RollResult | null>(null);
  const [projectileResults, setProjectileResults] = useState<{ roll: RollResult; hit: boolean; dodged: boolean; damage: number }[]>([]);
  const [currentProjectile, setCurrentProjectile] = useState(0);
  const [waitingDodge, setWaitingDodge] = useState(false);
  const [totalDamage, setTotalDamage] = useState(0);
  
  // Модальное окно результата
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const [resultType, setResultType] = useState<'success' | 'fail' | 'damage'>('success');
  
  // Изменение маны вручную
  const [manaChange, setManaChange] = useState('');
  
  if (!unit) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <p>Выберите персонажа</p>
      </div>
    );
  }
  
  const selectedSpell = unit.spells.find(s => s.id === selectedSpellId);
  
  // Получаем максимальный бонус магии из элементов заклинания
  const getMagicBonus = (spell: Spell): number => {
    if (spell.elements.length === 0) return 0;
    return Math.max(...spell.elements.map(el => unit.magicBonuses[el] || 0));
  };
  
  // Бонус от интеллекта к урону
  const getIntBonus = (): number => {
    return unit.stats.intelligence * 3;
  };
  
  // Стоимость маны
  const getManaCost = (spell: Spell): number => {
    return isDoubleShot ? spell.manaCost * 2 : spell.manaCost;
  };
  
  // Обработка каста
  const handleCast = async () => {
    if (!selectedSpell) return;
    
    const manaCost = getManaCost(selectedSpell);
    if (unit.mana.current < manaCost) {
      setResultType('fail');
      setResultMessage('❌ Недостаточно маны!');
      setShowResultModal(true);
      return;
    }
    
    setCastState('casting');
    
    // Бросок каста
    const magicBonus = getMagicBonus(selectedSpell);
    const castRoll = await roll(`1d20+${magicBonus}`);
    setCastResult(castRoll);
    
    // Списываем ману (всегда!)
    if (settings.googleWebAppUrl && unit.googleDocsHeader) {
      const result = await syncMana(unit.googleDocsHeader, -manaCost);
      if (result.success && result.mana) {
        setMana(unit.id, result.mana.current, result.mana.max);
      }
    } else {
      modifyMana(unit.id, -manaCost);
    }
    
    // DoubleShot требует 18+ для успеха
    const successThreshold = isDoubleShot ? 18 : 12;
    
    if (castRoll.total >= successThreshold) {
      // Успешный каст
      await showNotification(`✨ ${unit.shortName}: ${formatRollResult(castRoll)} - Каст успешен!${isDoubleShot ? ' (ДаблШот)' : ''}`);
      
      if (selectedSpell.type === 'targeted' && selectedSpell.projectiles && selectedSpell.projectiles > 0) {
        // Множественные снаряды
        setCastState('projectiles');
        setProjectileResults([]);
        setCurrentProjectile(0);
        setTotalDamage(0);
        
        // Бросаем для первого снаряда
        await processProjectile(0, selectedSpell);
      } else if (selectedSpell.damageFormula) {
        // Одиночный урон (AoE и т.д.)
        const damageFormula = `${selectedSpell.damageFormula}+${getIntBonus()}`;
        const damageRoll = await roll(damageFormula);
        
        const damageTypeName = DAMAGE_TYPE_NAMES[selectedSpell.damageType || ''] || selectedSpell.damageType || 'магического';
        const message = `💥 Нанесено ${damageRoll.total} ${damageTypeName} урона`;
        
        setResultType('damage');
        setResultMessage(message);
        setShowResultModal(true);
        setCastState('complete');
        
        const logAction = `кастует ${selectedSpell.name} (-${manaCost} маны): наносит ${damageRoll.total} ${damageTypeName} урона`;
        addLog({ unitName: unit.shortName, action: logAction });
        if (settings.googleWebAppUrl && unit.googleDocsHeader) {
          await writeLog(unit.googleDocsHeader, unit.shortName, logAction);
        }
        
        setTimeout(() => setCastState('idle'), 3000);
      } else {
        // Заклинания без урона (self, summon)
        setResultType('success');
        setResultMessage(`✅ ${selectedSpell.name} применено!${selectedSpell.description ? '\n' + selectedSpell.description : ''}`);
        setShowResultModal(true);
        setCastState('complete');
        
        const logAction = `кастует ${selectedSpell.name} (-${manaCost} маны)`;
        addLog({ unitName: unit.shortName, action: logAction });
        if (settings.googleWebAppUrl && unit.googleDocsHeader) {
          await writeLog(unit.googleDocsHeader, unit.shortName, logAction);
        }
        
        setTimeout(() => setCastState('idle'), 2000);
      }
    } else {
      // Провал
      setCastState('complete');
      setResultType('fail');
      setResultMessage(`❌ Каст провален! (мана потрачена)\n${formatRollResult(castRoll)}`);
      setShowResultModal(true);
      
      await showNotification(`❌ ${unit.shortName}: Каст ${selectedSpell.name} провален`);
      
      const logAction = `пытается кастовать ${selectedSpell.name} (-${manaCost} маны): провал`;
      addLog({ unitName: unit.shortName, action: logAction });
      if (settings.googleWebAppUrl && unit.googleDocsHeader) {
        await writeLog(unit.googleDocsHeader, unit.shortName, logAction);
      }
      
      setTimeout(() => setCastState('idle'), 2000);
    }
  };
  
  // Обработка снаряда
  const processProjectile = async (index: number, spell: Spell) => {
    const magicBonus = getMagicBonus(spell);
    
    if (spell.canDodge) {
      // Нужен бросок попадания
      const hitRoll = await roll(`1d20+${magicBonus}`);
      
      if (hitRoll.total > 11) {
        // Попадание, ждём выбора уворота
        setWaitingDodge(true);
        setProjectileResults(prev => [...prev, { roll: hitRoll, hit: true, dodged: false, damage: 0 }]);
      } else {
        // Промах
        setProjectileResults(prev => [...prev, { roll: hitRoll, hit: false, dodged: false, damage: 0 }]);
        await processNextProjectile(index, spell, false);
      }
    } else {
      // Автопопадание
      setProjectileResults(prev => [...prev, { roll: { formula: 'auto', total: 0, diceResults: [] }, hit: true, dodged: false, damage: 0 }]);
      await rollProjectileDamage(index, spell);
    }
  };
  
  // Обработка выбора уворота для снаряда
  const handleProjectileDodge = async (dodged: boolean) => {
    if (!selectedSpell) return;
    
    setWaitingDodge(false);
    
    setProjectileResults(prev => {
      const updated = [...prev];
      updated[currentProjectile] = { ...updated[currentProjectile], dodged };
      return updated;
    });
    
    if (dodged) {
      await processNextProjectile(currentProjectile, selectedSpell, false);
    } else {
      await rollProjectileDamage(currentProjectile, selectedSpell);
    }
  };
  
  // Бросок урона снаряда
  const rollProjectileDamage = async (index: number, spell: Spell) => {
    if (!spell.damageFormula) {
      await processNextProjectile(index, spell, true);
      return;
    }
    
    const damageFormula = `${spell.damageFormula}+${getIntBonus()}`;
    const damageRoll = await roll(damageFormula);
    
    setProjectileResults(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], damage: damageRoll.total };
      return updated;
    });
    
    setTotalDamage(prev => prev + damageRoll.total);
    
    await processNextProjectile(index, spell, true);
  };
  
  // Переход к следующему снаряду
  const processNextProjectile = async (currentIndex: number, spell: Spell, wasHit: boolean) => {
    const nextIndex = currentIndex + 1;
    const totalProjectiles = spell.projectiles || 0;
    
    if (nextIndex < totalProjectiles) {
      setCurrentProjectile(nextIndex);
      await processProjectile(nextIndex, spell);
    } else {
      // Все снаряды обработаны
      finishProjectiles(spell, wasHit);
    }
  };
  
  // Завершение обработки снарядов
  const finishProjectiles = async (spell: Spell, _lastHit: boolean) => {
    setCastState('complete');
    
    const hits = projectileResults.filter(p => p.hit && !p.dodged).length + (_lastHit ? 1 : 0);
    const total = spell.projectiles || 0;
    const damageTypeName = DAMAGE_TYPE_NAMES[spell.damageType || ''] || spell.damageType || 'магического';
    
    // Пересчитываем общий урон из всех снарядов
    const finalDamage = projectileResults.reduce((sum, p) => sum + (p.hit && !p.dodged ? p.damage : 0), 0) + totalDamage;
    
    const message = `💥 Попало ${hits}/${total} снарядов\nНанесено ${finalDamage} ${damageTypeName} урона`;
    
    setResultType('damage');
    setResultMessage(message);
    setShowResultModal(true);
    
    const manaCost = getManaCost(spell);
    const logAction = `кастует ${spell.name} (-${manaCost} маны): попало ${hits}/${total} снарядов, ${finalDamage} ${damageTypeName} урона`;
    addLog({ unitName: unit.shortName, action: logAction });
    if (settings.googleWebAppUrl && unit.googleDocsHeader) {
      await writeLog(unit.googleDocsHeader, unit.shortName, logAction);
    }
    
    await showNotification(`✨ ${unit.shortName}: ${hits}/${total} попаданий, ${finalDamage} урона`);
    
    setTimeout(() => {
      setCastState('idle');
      setProjectileResults([]);
      setCurrentProjectile(0);
      setTotalDamage(0);
    }, 3000);
  };
  
  // Изменение маны вручную
  const handleManaChange = async (delta: number) => {
    if (settings.googleWebAppUrl && unit.googleDocsHeader) {
      const result = await syncMana(unit.googleDocsHeader, delta);
      if (result.success && result.mana) {
        setMana(unit.id, result.mana.current, result.mana.max);
      }
    } else {
      modifyMana(unit.id, delta);
    }
    setManaChange('');
  };
  
  return (
    <div className="p-3 space-y-4 overflow-y-auto max-h-[calc(100vh-280px)]">
      {/* Секция заклинаний */}
      <section className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
        <h3 className="text-sm font-semibold text-purple-400 mb-3 flex items-center gap-2">
          <span>✨</span> Заклинания
        </h3>
        
        {unit.spells.length === 0 ? (
          <p className="text-gray-500 text-sm">Нет заклинаний. Добавьте в настройках.</p>
        ) : (
          <>
            {/* Список заклинаний */}
            <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
              {unit.spells.map(spell => (
                <button
                  key={spell.id}
                  onClick={() => setSelectedSpellId(spell.id === selectedSpellId ? '' : spell.id)}
                  className={`w-full text-left p-2 rounded-lg border transition-all ${
                    spell.id === selectedSpellId
                      ? 'bg-purple-900/30 border-purple-500'
                      : 'bg-gray-900/50 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-gray-200">{spell.name}</span>
                    <span className="text-xs text-blue-400">💠 {spell.manaCost}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {spell.elements.join(', ')} • {spell.damageFormula || 'Нет урона'}
                    {spell.projectiles && ` • ${spell.projectiles} снаряд${spell.projectiles > 1 ? 'а' : ''}`}
                  </div>
                </button>
              ))}
            </div>
            
            {/* Детали выбранного заклинания */}
            {selectedSpell && (
              <div className="bg-gray-900/50 rounded-lg p-2 mb-3 text-xs">
                <div className="text-purple-300 font-medium mb-1">{selectedSpell.name}</div>
                <div className="text-gray-400 space-y-0.5">
                  <div>🎯 Каст: d20+{getMagicBonus(selectedSpell)}</div>
                  {selectedSpell.damageFormula && (
                    <div>💥 Урон: {selectedSpell.damageFormula}+{getIntBonus()}</div>
                  )}
                  {selectedSpell.projectiles && (
                    <div>🎯 Снаряды: {selectedSpell.projectiles} {selectedSpell.canDodge ? '(можно увернуться)' : '(автопопадание)'}</div>
                  )}
                  {selectedSpell.description && (
                    <div className="mt-1 italic text-gray-500">{selectedSpell.description}</div>
                  )}
                </div>
              </div>
            )}
            
            {/* DoubleShot и кнопка каста */}
            <div className="space-y-2">
              <Checkbox
                label={`ДаблШот (×2 мана, крит 18+)${selectedSpell ? ` = ${getManaCost(selectedSpell)} маны` : ''}`}
                checked={isDoubleShot}
                onChange={(e) => setIsDoubleShot(e.target.checked)}
              />
              
              {castState === 'idle' && (
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600"
                  onClick={handleCast}
                  disabled={!selectedSpell || unit.mana.current < getManaCost(selectedSpell!)}
                >
                  ✨ СОТВОРИТЬ!
                </Button>
              )}
              
              {castState === 'casting' && (
                <div className="text-center py-4">
                  <div className="animate-spin text-2xl">🎲</div>
                  <p className="text-gray-400 text-sm mt-2">Каст...</p>
                </div>
              )}
              
              {castState === 'projectiles' && (
                <div className="space-y-2">
                  <div className="text-center text-sm text-purple-300">
                    Снаряд {currentProjectile + 1}/{selectedSpell?.projectiles || 0}
                  </div>
                  
                  {waitingDodge ? (
                    <div className="space-y-2">
                      <div className="text-center text-green-400 font-medium">
                        🎯 Попадание! {projectileResults[currentProjectile]?.roll && formatRollResult(projectileResults[currentProjectile].roll)}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="secondary" className="flex-1" onClick={() => handleProjectileDodge(true)}>
                          🔄 Уворот
                        </Button>
                        <Button variant="danger" className="flex-1" onClick={() => handleProjectileDodge(false)}>
                          ❌ Нет уворота
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <div className="animate-spin text-2xl">🎲</div>
                    </div>
                  )}
                  
                  {/* Прогресс снарядов */}
                  <div className="flex gap-1 justify-center">
                    {projectileResults.map((p, i) => (
                      <div
                        key={i}
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                          p.hit && !p.dodged ? 'bg-green-600' : 
                          p.dodged ? 'bg-yellow-600' : 'bg-red-600'
                        }`}
                      >
                        {p.hit && !p.dodged ? '✓' : p.dodged ? '↩' : '✗'}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </section>
      
      {/* Секция управления маной */}
      <section className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
        <h3 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-2">
          <span>💠</span> Управление маной
        </h3>
        
        <div className="flex gap-2 items-end">
          <Input
            type="number"
            value={manaChange}
            onChange={(e) => setManaChange(e.target.value)}
            placeholder="+/- мана"
            className="flex-1"
          />
          <Button
            variant="secondary"
            onClick={() => handleManaChange(parseInt(manaChange) || 0)}
            disabled={!manaChange || parseInt(manaChange) === 0}
          >
            Применить
          </Button>
        </div>
        
        <div className="flex gap-2 mt-2">
          <Button variant="ghost" size="sm" onClick={() => handleManaChange(-10)}>-10</Button>
          <Button variant="ghost" size="sm" onClick={() => handleManaChange(-5)}>-5</Button>
          <Button variant="ghost" size="sm" onClick={() => handleManaChange(-1)}>-1</Button>
          <Button variant="ghost" size="sm" onClick={() => handleManaChange(1)}>+1</Button>
          <Button variant="ghost" size="sm" onClick={() => handleManaChange(5)}>+5</Button>
          <Button variant="ghost" size="sm" onClick={() => handleManaChange(10)}>+10</Button>
        </div>
      </section>
      
      {/* Модальное окно результата */}
      <Modal
        isOpen={showResultModal}
        onClose={() => setShowResultModal(false)}
        title={resultType === 'damage' ? '💥 Урон нанесён!' : resultType === 'success' ? '✅ Успех' : '❌ Результат'}
      >
        <div className="text-center py-4 whitespace-pre-line">
          <p className={`text-lg font-semibold ${
            resultType === 'damage' ? 'text-purple-400' : 
            resultType === 'success' ? 'text-green-400' : 'text-gray-300'
          }`}>
            {resultMessage}
          </p>
          {castResult && (
            <p className="text-xs text-gray-500 mt-2">{formatRollResult(castResult)}</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
