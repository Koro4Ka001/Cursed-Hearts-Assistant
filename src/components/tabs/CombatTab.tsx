import { useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { Button } from '@/components/ui/Button';
import { Input, Select, Checkbox } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { roll, doubleDiceInFormula, formatRollResult } from '@/services/diceService';
import { writeLog, applyDamage, heal } from '@/services/googleDocsService';
import { updateTokenHP, showNotification } from '@/services/owlbearService';
import { DAMAGE_TYPE_NAMES, PROFICIENCY_NAMES } from '@/types';
import type { Weapon, RollResult, DamageCategory } from '@/types';

const DAMAGE_CATEGORIES: { value: DamageCategory; label: string }[] = [
  { value: 'physical', label: 'Физический' },
  { value: 'magical', label: 'Магический' },
  { value: 'pure', label: 'Чистый' },
];

const PHYSICAL_DAMAGE_TYPES = ['slashing', 'piercing', 'bludgeoning', 'chopping'];
const MAGICAL_DAMAGE_TYPES = ['fire', 'water', 'earth', 'air', 'light', 'darkness', 'electricity', 'void', 'life', 'death', 'astral', 'corruption', 'space', 'blood', 'frost', 'nature', 'transcendence'];

export function CombatTab() {
  const { getSelectedUnit, modifyHealth, setHealth, settings, addLog } = useGameStore();
  const unit = getSelectedUnit();
  
  // Состояние атаки
  const [selectedWeaponId, setSelectedWeaponId] = useState<string>('');
  const [targetCount, setTargetCount] = useState(1);
  const [attackState, setAttackState] = useState<'idle' | 'hit-roll' | 'dodge-choice' | 'damage-roll' | 'complete'>('idle');
  const [hitResult, setHitResult] = useState<RollResult | null>(null);
  const [damageResult, setDamageResult] = useState<RollResult | null>(null);
  const [isCrit, setIsCrit] = useState(false);
  
  // Состояние получения урона
  const [incomingDamage, setIncomingDamage] = useState('');
  const [damageCategory, setDamageCategory] = useState<DamageCategory>('physical');
  const [damageType, setDamageType] = useState('slashing');
  const [isUndead, setIsUndead] = useState(false);
  
  // Состояние исцеления
  const [healAmount, setHealAmount] = useState('');
  
  // Модальное окно результата
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const [resultType, setResultType] = useState<'success' | 'miss' | 'crit'>('success');
  
  if (!unit) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <p>Выберите персонажа</p>
      </div>
    );
  }
  
  const selectedWeapon = unit.weapons.find(w => w.id === selectedWeaponId);
  
  // Вычисляем бонус попадания
  const getHitBonus = (weapon: Weapon): number => {
    return unit.weaponProficiencies[weapon.proficiencyType] || 0;
  };
  
  // Вычисляем бонус урона
  const getDamageBonus = (weapon: Weapon): number => {
    if (weapon.statBonus === 'physicalPower') {
      return unit.stats.physicalPower * 5;
    } else {
      return unit.stats.dexterity * 3;
    }
  };
  
  // Обработка атаки
  const handleAttack = async () => {
    if (!selectedWeapon) return;
    
    setAttackState('hit-roll');
    const hitBonus = getHitBonus(selectedWeapon);
    const result = await roll(`1d20+${hitBonus}`);
    setHitResult(result);
    setIsCrit(result.rawD20 === 20);
    
    if (result.total > 11) {
      setAttackState('dodge-choice');
      await showNotification(`🎯 ${unit.shortName}: ${formatRollResult(result)} - Попадание!${result.rawD20 === 20 ? ' ⚡КРИТ!' : ''}`);
    } else {
      setAttackState('complete');
      setResultType('miss');
      setResultMessage(`❌ Промах! ${formatRollResult(result)}`);
      setShowResultModal(true);
      
      addLog({ unitName: unit.shortName, action: `атакует ${selectedWeapon.name}: ${result.formula} = ${result.total} (промах)` });
      if (settings.googleWebAppUrl && unit.googleDocsHeader) {
        await writeLog(unit.googleDocsHeader, unit.shortName, `атакует ${selectedWeapon.name}: ${result.formula} = ${result.total} (промах)`);
      }
      
      setTimeout(() => setAttackState('idle'), 2000);
    }
  };
  
  // Обработка выбора уворота
  const handleDodgeChoice = async (dodged: boolean) => {
    if (!selectedWeapon || !hitResult) return;
    
    if (dodged) {
      setAttackState('complete');
      setResultType('miss');
      setResultMessage('❌ Промах (уворот)');
      setShowResultModal(true);
      
      addLog({ unitName: unit.shortName, action: `атакует ${selectedWeapon.name}: ${hitResult.total} (уворот)` });
      if (settings.googleWebAppUrl && unit.googleDocsHeader) {
        await writeLog(unit.googleDocsHeader, unit.shortName, `атакует ${selectedWeapon.name}: ${hitResult.total} (уворот)`);
      }
      
      setTimeout(() => setAttackState('idle'), 2000);
      return;
    }
    
    // Бросок урона
    setAttackState('damage-roll');
    let damageFormula = selectedWeapon.damageFormula;
    if (isCrit) {
      damageFormula = doubleDiceInFormula(damageFormula);
    }
    
    const damageBonus = getDamageBonus(selectedWeapon);
    const fullFormula = `${damageFormula}+${damageBonus}`;
    const result = await roll(fullFormula);
    setDamageResult(result);
    
    const damageTypeName = DAMAGE_TYPE_NAMES[selectedWeapon.damageType] || selectedWeapon.damageType;
    const message = `💥 Нанесено ${result.total} ${damageTypeName} урона${isCrit ? ' (КРИТ!)' : ''}`;
    
    setAttackState('complete');
    setResultType(isCrit ? 'crit' : 'success');
    setResultMessage(message);
    setShowResultModal(true);
    
    await showNotification(`⚔️ ${unit.shortName}: ${result.total} ${damageTypeName} урона${isCrit ? ' ⚡КРИТ!' : ''}`);
    
    const logAction = `наносит ${result.total} ${damageTypeName} урона (${fullFormula} = ${result.total})${isCrit ? ' КРИТ!' : ''}`;
    addLog({ unitName: unit.shortName, action: logAction });
    if (settings.googleWebAppUrl && unit.googleDocsHeader) {
      await writeLog(unit.googleDocsHeader, unit.shortName, logAction);
    }
    
    setTimeout(() => setAttackState('idle'), 3000);
  };
  
  // Обработка получения урона
  const handleTakeDamage = async () => {
    const damage = parseInt(incomingDamage);
    if (isNaN(damage) || damage <= 0) return;
    
    if (settings.googleWebAppUrl && unit.googleDocsHeader) {
      const result = await applyDamage(unit.googleDocsHeader, damage, damageType, damageCategory, isUndead);
      if (result.success && result.health) {
        setHealth(unit.id, result.health.current, result.health.max);
        
        if (unit.tokenId) {
          await updateTokenHP(unit.tokenId, result.health.current, result.health.max);
        }
        
        const damageTypeName = DAMAGE_TYPE_NAMES[damageType] || damageType;
        setResultMessage(`🩸 Получено ${damage} → ${result.health.current}/${result.health.max} HP`);
        setResultType('miss');
        setShowResultModal(true);
        
        addLog({ unitName: unit.shortName, action: `получает ${damage} ${damageTypeName} урона → ${result.health.current}/${result.health.max} HP` });
      }
    } else {
      // Локальное обновление
      modifyHealth(unit.id, -damage);
      const newHP = Math.max(0, unit.health.current - damage);
      
      if (unit.tokenId) {
        await updateTokenHP(unit.tokenId, newHP, unit.health.max);
      }
      
      const damageTypeName = DAMAGE_TYPE_NAMES[damageType] || damageType;
      setResultMessage(`🩸 Получено ${damage} ${damageTypeName} урона`);
      setResultType('miss');
      setShowResultModal(true);
      
      addLog({ unitName: unit.shortName, action: `получает ${damage} ${damageTypeName} урона` });
    }
    
    setIncomingDamage('');
  };
  
  // Обработка исцеления
  const handleHeal = async () => {
    const amount = parseInt(healAmount);
    if (isNaN(amount) || amount <= 0) return;
    
    if (settings.googleWebAppUrl && unit.googleDocsHeader) {
      const result = await heal(unit.googleDocsHeader, amount);
      if (result.success && result.health) {
        setHealth(unit.id, result.health.current, result.health.max);
        
        if (unit.tokenId) {
          await updateTokenHP(unit.tokenId, result.health.current, result.health.max);
        }
        
        setResultMessage(`💚 Исцелено ${amount} HP → ${result.health.current}/${result.health.max}`);
        setResultType('success');
        setShowResultModal(true);
        
        addLog({ unitName: unit.shortName, action: `исцеляется на ${amount} HP → ${result.health.current}/${result.health.max}` });
      }
    } else {
      modifyHealth(unit.id, amount);
      const newHP = Math.min(unit.health.max, unit.health.current + amount);
      
      if (unit.tokenId) {
        await updateTokenHP(unit.tokenId, newHP, unit.health.max);
      }
      
      setResultMessage(`💚 Исцелено ${amount} HP`);
      setResultType('success');
      setShowResultModal(true);
      
      addLog({ unitName: unit.shortName, action: `исцеляется на ${amount} HP` });
    }
    
    setHealAmount('');
  };
  
  const getDamageTypeOptions = () => {
    if (damageCategory === 'physical') {
      return PHYSICAL_DAMAGE_TYPES.map(t => ({ value: t, label: DAMAGE_TYPE_NAMES[t] || t }));
    } else if (damageCategory === 'magical') {
      return MAGICAL_DAMAGE_TYPES.map(t => ({ value: t, label: DAMAGE_TYPE_NAMES[t] || t }));
    }
    return [{ value: 'pure', label: 'Чистый' }];
  };
  
  return (
    <div className="p-3 space-y-4 overflow-y-auto max-h-[calc(100vh-280px)]">
      {/* Секция атаки */}
      <section className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
        <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
          <span>⚔️</span> Атака
        </h3>
        
        {unit.weapons.length === 0 ? (
          <p className="text-gray-500 text-sm">Нет оружия. Добавьте в настройках.</p>
        ) : (
          <>
            <div className="space-y-2 mb-3">
              <Select
                label="Оружие"
                value={selectedWeaponId}
                onChange={(e) => setSelectedWeaponId(e.target.value)}
                options={[
                  { value: '', label: 'Выберите оружие' },
                  ...unit.weapons.map(w => ({
                    value: w.id,
                    label: `${w.name} (${w.damageFormula} ${DAMAGE_TYPE_NAMES[w.damageType] || w.damageType})`,
                  })),
                ]}
              />
              
              {selectedWeapon && (
                <div className="text-xs text-gray-400 bg-gray-900/50 rounded p-2">
                  <div>📊 Попадание: d20+{getHitBonus(selectedWeapon)} ({PROFICIENCY_NAMES[selectedWeapon.proficiencyType]})</div>
                  <div>💥 Урон: {selectedWeapon.damageFormula}+{getDamageBonus(selectedWeapon)}</div>
                  {selectedWeapon.special && <div>✨ {selectedWeapon.special}</div>}
                </div>
              )}
              
              <Input
                label="Количество целей"
                type="number"
                min={1}
                value={targetCount}
                onChange={(e) => setTargetCount(parseInt(e.target.value) || 1)}
              />
            </div>
            
            {attackState === 'idle' && (
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={handleAttack}
                disabled={!selectedWeapon}
              >
                ⚔️ АТАКОВАТЬ!
              </Button>
            )}
            
            {attackState === 'hit-roll' && (
              <div className="text-center py-4">
                <div className="animate-spin text-2xl">🎲</div>
                <p className="text-gray-400 text-sm mt-2">Бросок попадания...</p>
              </div>
            )}
            
            {attackState === 'dodge-choice' && hitResult && (
              <div className="space-y-2">
                <div className="text-center py-2">
                  <div className={`text-lg font-bold ${isCrit ? 'text-yellow-400' : 'text-green-400'}`}>
                    🎯 {hitResult.total} - Попадание!{isCrit && ' ⚡КРИТ!'}
                  </div>
                  <p className="text-xs text-gray-500">{formatRollResult(hitResult)}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={() => handleDodgeChoice(true)}>
                    🔄 Уворот
                  </Button>
                  <Button variant="danger" className="flex-1" onClick={() => handleDodgeChoice(false)}>
                    ❌ Нет уворота
                  </Button>
                </div>
              </div>
            )}
            
            {attackState === 'damage-roll' && (
              <div className="text-center py-4">
                <div className="animate-spin text-2xl">🎲</div>
                <p className="text-gray-400 text-sm mt-2">Бросок урона...</p>
              </div>
            )}
          </>
        )}
      </section>
      
      {/* Секция получения урона */}
      <section className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
        <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
          <span>🩸</span> Получение урона
        </h3>
        
        <div className="space-y-2">
          <Input
            label="Входящий урон"
            type="number"
            min={0}
            value={incomingDamage}
            onChange={(e) => setIncomingDamage(e.target.value)}
            placeholder="0"
          />
          
          <div className="grid grid-cols-2 gap-2">
            <Select
              label="Категория"
              value={damageCategory}
              onChange={(e) => {
                setDamageCategory(e.target.value as DamageCategory);
                setDamageType(e.target.value === 'physical' ? 'slashing' : e.target.value === 'magical' ? 'fire' : 'pure');
              }}
              options={DAMAGE_CATEGORIES}
            />
            <Select
              label="Тип урона"
              value={damageType}
              onChange={(e) => setDamageType(e.target.value)}
              options={getDamageTypeOptions()}
            />
          </div>
          
          <Checkbox
            label="Атакует нежить"
            checked={isUndead}
            onChange={(e) => setIsUndead(e.target.checked)}
          />
          
          <Button
            variant="danger"
            className="w-full"
            onClick={handleTakeDamage}
            disabled={!incomingDamage || parseInt(incomingDamage) <= 0}
          >
            🩸 ПОЛУЧИТЬ УРОН
          </Button>
        </div>
      </section>
      
      {/* Секция исцеления */}
      <section className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
        <h3 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2">
          <span>💚</span> Исцеление
        </h3>
        
        <div className="flex gap-2">
          <Input
            type="number"
            min={0}
            value={healAmount}
            onChange={(e) => setHealAmount(e.target.value)}
            placeholder="Количество HP"
            className="flex-1"
          />
          <Button
            variant="success"
            onClick={handleHeal}
            disabled={!healAmount || parseInt(healAmount) <= 0}
          >
            💚 ИСЦЕЛИТЬ
          </Button>
        </div>
      </section>
      
      {/* Модальное окно результата */}
      <Modal
        isOpen={showResultModal}
        onClose={() => setShowResultModal(false)}
        title={resultType === 'crit' ? '⚡ КРИТИЧЕСКИЙ УДАР!' : resultType === 'success' ? '✅ Успех' : '❌ Результат'}
      >
        <div className="text-center py-4">
          <p className={`text-lg font-semibold ${
            resultType === 'crit' ? 'text-yellow-400' : 
            resultType === 'success' ? 'text-green-400' : 'text-gray-300'
          }`}>
            {resultMessage}
          </p>
          {damageResult && (
            <p className="text-xs text-gray-500 mt-2">{formatRollResult(damageResult)}</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
