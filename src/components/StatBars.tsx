import { useGameStore } from '../stores/useGameStore';

export function StatBars() {
  const { units, selectedUnitId } = useGameStore();
  const unit = units.find(u => u.id === selectedUnitId);

  if (!unit) {
    return (
      <div className="px-3 py-3 bg-dark border-b border-edge-bone relative overflow-hidden">
        <div className="text-center text-faded text-sm py-2 font-cinzel tracking-[3px] uppercase">
          ⟐ Выберите персонажа ⟐
        </div>
      </div>
    );
  }

  const hp = unit.health.current;
  const maxHp = unit.health.max || 1;
  const hpPct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const hpLow = hpPct < 25 && hpPct > 0;

  const mana = unit.mana.current;
  const maxMana = unit.mana.max || 1;
  const manaPct = Math.max(0, Math.min(100, (mana / maxMana) * 100));

  const hasRage = unit.hasRage ?? false;
  const rage = unit.rage?.current ?? 0;
  const maxRage = unit.rage?.max ?? unit.rageConfig?.max ?? 100;
  const ragePct = Math.max(0, Math.min(100, (rage / maxRage) * 100));

  return (
    <div className="px-3 py-3 bg-dark border-b border-edge-bone space-y-2.5 relative overflow-hidden">
      {/* Фоновые руны */}
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
        <span className="absolute top-0 left-2 text-[16px] opacity-[0.025] text-gold">ᚱ</span>
        <span className="absolute top-0 right-3 text-[14px] opacity-[0.02] text-gold">ᛟ</span>
        <span className="absolute bottom-0 left-[30%] text-[12px] opacity-[0.02] text-gold">ᚺ</span>
        <span className="absolute bottom-0 right-[20%] text-[10px] opacity-[0.015] text-gold">ᛉ</span>
      </div>

      {/* ═══ HP BAR ═══ */}
      {!unit.useManaAsHp && (
        <div className="relative">
          <div className={`hp-vessel ${hpLow ? 'hp-vessel-low' : ''}`}>
            <div className="hp-vessel-bg" />

            <div className="hp-vessel-fill" style={{ width: `${hpPct}%` }}>
              {/* Пузырьки крови */}
              <span className="hp-bubble hp-bubble-1" />
              <span className="hp-bubble hp-bubble-2" />
              <span className="hp-bubble hp-bubble-3" />
              <span className="hp-bubble hp-bubble-4" />
              <span className="hp-bubble hp-bubble-5" />

              {/* Блики на жидкости */}
              <span className="hp-vessel-shine" />
              <span className="hp-vessel-shine-2" />
            </div>

            {/* Текст */}
            <div className="hp-vessel-label">
              <span className="hp-vessel-icon">❤</span>
              <span>{hp}</span>
              <span className="hp-vessel-separator">/</span>
              <span>{maxHp}</span>
            </div>

            {/* Капли при низком HP */}
            {hpLow && (
              <>
                <span className="hp-drip-1" />
                <span className="hp-drip-2" />
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ MANA BAR ═══ */}
      <div className="relative">
        <div className="mana-crystal">
          <div className="mana-crystal-bg" />

          <div className="mana-crystal-fill" style={{ width: `${manaPct}%` }}>
            {/* Искры */}
            <span className="mana-spark mana-spark-1" />
            <span className="mana-spark mana-spark-2" />
            <span className="mana-spark mana-spark-3" />
            <span className="mana-spark mana-spark-4" />
            <span className="mana-spark mana-spark-5" />
            <span className="mana-spark mana-spark-6" />

            {/* Бегущий блик */}
            <span className="mana-crystal-shimmer" />

            {/* Статичный блик */}
            <span className="mana-crystal-shine" />
          </div>

          {/* Текст */}
          <div className="mana-crystal-label">
            <span className="mana-crystal-icon">💠</span>
            <span>{mana}</span>
            <span className="mana-crystal-separator">/</span>
            <span>{maxMana}</span>
          </div>
        </div>
      </div>

      {/* ═══ RAGE BAR ═══ */}
      {hasRage && (
        <div className="relative">
          <div className="mana-crystal" style={{ borderColor: '#4a2a2a' }}>
            <div className="mana-crystal-bg" style={{ background: 'linear-gradient(180deg, #1a0a0a 0%, #2d1f1f 50%, #1a0a0a 100%)' }} />

            <div
              className="mana-crystal-fill"
              style={{
                width: `${ragePct}%`,
                background: 'linear-gradient(180deg, #dc143c 0%, #8b0000 30%, #660000 60%, #440000 100%)'
              }}
            >
              <span className="mana-spark mana-spark-1" style={{ background: '#ff4500', boxShadow: '0 0 4px 1px rgba(255,69,0,0.6)' }} />
              <span className="mana-spark mana-spark-2" style={{ background: '#ff6600', boxShadow: '0 0 4px 1px rgba(255,102,0,0.6)' }} />
              <span className="mana-spark mana-spark-3" style={{ background: '#ff4500', boxShadow: '0 0 4px 1px rgba(255,69,0,0.6)' }} />
              <span className="mana-crystal-shimmer" />
            </div>

            <div className="mana-crystal-label" style={{ color: '#ffcccc' }}>
              <span className="mana-crystal-icon" style={{ filter: 'drop-shadow(0 0 4px rgba(255,50,50,0.6))' }}>🔥</span>
              <span>{rage}</span>
              <span className="mana-crystal-separator">/</span>
              <span>{maxRage}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
