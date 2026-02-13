/* ═══════════════════════════════════════════════════════════════
   CURSED HEARTS ASSISTANT — Dark Grimoire Theme
   ═══════════════════════════════════════════════════════════════ */

@import "tailwindcss";

/* ── Tailwind 4 Theme ─────────────────────────────────────────── */
@theme {
  --color-abyss: #0a0a0f;
  --color-dark: #111118;
  --color-obsidian: #1a1a24;
  --color-panel: #14141e;
  --color-bone: #d4c8a8;
  --color-faded: #8a7e66;
  --color-dim: #5a5040;
  --color-gold: #c8a84e;
  --color-gold-bright: #e8d068;
  --color-gold-dark: #7a5a1e;
  --color-blood: #8b1a1a;
  --color-blood-bright: #cc2222;
  --color-blood-dark: #4a0a0a;
  --color-mana: #2a5a8a;
  --color-mana-bright: #4499dd;
  --color-mana-dark: #1a2a3a;
  --color-ancient: #7a6a4a;
  --color-edge-bone: #2a2520;
  --font-cinzel: 'Cinzel', serif;
  --font-cinzel-decorative: 'Cinzel Decorative', serif;
  --font-garamond: 'EB Garamond', serif;
  --font-medieval: 'MedievalSharp', cursive;
}

/* ══════════════════════════════════════════════════════════════
   BASE
   ══════════════════════════════════════════════════════════════ */

*, *::before, *::after {
  box-sizing: border-box;
}

html, body, #root {
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

body {
  background: var(--color-abyss);
  color: var(--color-bone);
  font-family: var(--font-garamond);
  -webkit-font-smoothing: antialiased;
}

/* ── Scrollbar ──────────────────────────────────────────────── */

::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: var(--color-abyss); }
::-webkit-scrollbar-thumb {
  background: var(--color-gold-dark);
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover { background: var(--color-gold); }

/* ── Selection ──────────────────────────────────────────────── */

::selection {
  background: rgba(200, 168, 78, 0.3);
  color: var(--color-gold-bright);
}

/* ── Typography ─────────────────────────────────────────────── */

.heading {
  font-family: var(--font-cinzel);
  font-weight: 700;
  letter-spacing: 0.05em;
}

.heading-decorative {
  font-family: var(--font-cinzel-decorative);
  font-weight: 700;
}

/* ══════════════════════════════════════════════════════════════
   APP FRAME & BACKGROUND EFFECTS
   ══════════════════════════════════════════════════════════════ */

.app-frame {
  position: relative;
  background:
    radial-gradient(ellipse at 30% 0%, rgba(139,26,26,0.06) 0%, transparent 60%),
    radial-gradient(ellipse at 70% 100%, rgba(42,90,138,0.04) 0%, transparent 60%),
    linear-gradient(180deg, #0c0c14 0%, #0a0a0f 50%, #08080c 100%);
}

/* ── Floating Runes ─────────────────────────────────────────── */

.bg-runes {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.bg-rune {
  position: absolute;
  font-size: 24px;
  color: var(--color-gold);
  opacity: 0;
  animation: rune-drift 20s infinite ease-in-out;
  user-select: none;
}

.bg-rune:nth-child(1) { top: 8%; left: 5%; animation-delay: 0s; font-size: 28px; }
.bg-rune:nth-child(2) { top: 25%; right: 8%; animation-delay: 3s; font-size: 20px; }
.bg-rune:nth-child(3) { top: 55%; left: 12%; animation-delay: 7s; font-size: 18px; }
.bg-rune:nth-child(4) { top: 75%; right: 15%; animation-delay: 11s; font-size: 22px; }
.bg-rune:nth-child(5) { top: 40%; left: 80%; animation-delay: 5s; font-size: 16px; }
.bg-rune:nth-child(6) { top: 90%; left: 40%; animation-delay: 14s; font-size: 20px; }

@keyframes rune-drift {
  0%, 100% { opacity: 0; transform: translateY(0) rotate(0deg); }
  15% { opacity: 0.04; }
  50% { opacity: 0.07; transform: translateY(-15px) rotate(5deg); }
  85% { opacity: 0.04; }
}

/* ── Embers (тлеющие угольки) ───────────────────────────────── */

.ember {
  position: absolute;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  pointer-events: none;
}

.ember-1 {
  bottom: 20%;
  left: 15%;
  background: #ff6600;
  box-shadow: 0 0 6px 2px rgba(255,102,0,0.6);
  animation: ember-float 8s infinite ease-in-out;
}

.ember-2 {
  bottom: 40%;
  right: 20%;
  width: 2px;
  height: 2px;
  background: #ff4400;
  box-shadow: 0 0 4px 1px rgba(255,68,0,0.5);
  animation: ember-float 12s infinite ease-in-out 3s;
}

.ember-3 {
  bottom: 60%;
  left: 60%;
  width: 2px;
  height: 2px;
  background: #cc4400;
  box-shadow: 0 0 5px 1px rgba(204,68,0,0.4);
  animation: ember-float 10s infinite ease-in-out 6s;
}

@keyframes ember-float {
  0%, 100% { opacity: 0; transform: translateY(0) translateX(0); }
  10% { opacity: 0.8; }
  50% { opacity: 0.4; transform: translateY(-40px) translateX(10px); }
  90% { opacity: 0.6; }
}

/* ── Vignette ───────────────────────────────────────────────── */

.app-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
  background:
    radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.5) 100%);
}

/* ══════════════════════════════════════════════════════════════
   SCREEN EFFECTS
   ══════════════════════════════════════════════════════════════ */

.screen-shake {
  animation: shake 0.5s ease-out;
}

@keyframes shake {
  0%, 100% { transform: translate(0); }
  10% { transform: translate(-4px, 2px); }
  20% { transform: translate(4px, -2px); }
  30% { transform: translate(-3px, 1px); }
  40% { transform: translate(3px, -1px); }
  50% { transform: translate(-2px, 1px); }
  60% { transform: translate(2px, 0); }
  70% { transform: translate(-1px, 0); }
}

.screen-flash-gold {
  animation: flash-gold 0.7s ease-out;
}

@keyframes flash-gold {
  0% { box-shadow: inset 0 0 80px rgba(232,208,104,0.5); }
  30% { box-shadow: inset 0 0 120px rgba(232,208,104,0.3); }
  100% { box-shadow: inset 0 0 0 transparent; }
}

.screen-flash-blood {
  animation: flash-blood 0.7s ease-out;
}

@keyframes flash-blood {
  0% { box-shadow: inset 0 0 60px rgba(204,34,34,0.5); }
  50% { box-shadow: inset 0 0 100px rgba(139,26,26,0.3); }
  100% { box-shadow: inset 0 0 0 transparent; }
}

.screen-heal-glow {
  animation: heal-glow 0.7s ease-out;
}

@keyframes heal-glow {
  0% { box-shadow: inset 0 0 40px rgba(34,204,68,0.4); }
  50% { box-shadow: inset 0 0 80px rgba(34,204,68,0.2); }
  100% { box-shadow: inset 0 0 0 transparent; }
}

/* ══════════════════════════════════════════════════════════════
   HP VESSEL (Сосуд с кровью)
   ══════════════════════════════════════════════════════════════ */

.hp-vessel {
  position: relative;
  height: 28px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid #4a1515;
  box-shadow:
    0 0 8px rgba(139,26,26,0.3),
    inset 0 1px 3px rgba(0,0,0,0.5);
  transition: box-shadow 0.3s;
}

.hp-vessel-low {
  animation: vessel-pulse 1.5s ease-in-out infinite;
  border-color: #cc2222;
  box-shadow:
    0 0 12px rgba(204,34,34,0.4),
    0 0 24px rgba(204,34,34,0.15),
    inset 0 1px 3px rgba(0,0,0,0.5);
}

@keyframes vessel-pulse {
  0%, 100% { box-shadow: 0 0 12px rgba(204,34,34,0.4), inset 0 1px 3px rgba(0,0,0,0.5); }
  50% { box-shadow: 0 0 20px rgba(204,34,34,0.6), 0 0 30px rgba(204,34,34,0.2), inset 0 1px 3px rgba(0,0,0,0.5); }
}

.hp-vessel-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, #1a0808 0%, #2a0e0e 50%, #1a0808 100%);
}

.hp-vessel-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: linear-gradient(180deg,
    #cc2222 0%,
    #aa1a1a 30%,
    #881414 60%,
    #660e0e 100%
  );
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  border-radius: 14px;
}

/* Пузырьки крови */
.hp-bubble {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255,100,100,0.6) 0%, transparent 70%);
  animation: bubble-rise linear infinite;
  pointer-events: none;
}

.hp-bubble-1 { width: 4px; height: 4px; left: 20%; bottom: -4px; animation-duration: 3s; animation-delay: 0s; }
.hp-bubble-2 { width: 3px; height: 3px; left: 45%; bottom: -3px; animation-duration: 4s; animation-delay: 1s; }
.hp-bubble-3 { width: 5px; height: 5px; left: 65%; bottom: -5px; animation-duration: 3.5s; animation-delay: 0.5s; }
.hp-bubble-4 { width: 3px; height: 3px; left: 80%; bottom: -3px; animation-duration: 4.5s; animation-delay: 2s; }
.hp-bubble-5 { width: 2px; height: 2px; left: 35%; bottom: -2px; animation-duration: 3.2s; animation-delay: 1.5s; }

@keyframes bubble-rise {
  0% { transform: translateY(0) scale(1); opacity: 0; }
  10% { opacity: 0.7; }
  80% { opacity: 0.3; }
  100% { transform: translateY(-28px) scale(0.5); opacity: 0; }
}

/* Блики на жидкости */
.hp-vessel-shine {
  position: absolute;
  top: 2px;
  left: 10%;
  right: 30%;
  height: 4px;
  background: linear-gradient(90deg, transparent, rgba(255,180,180,0.2), transparent);
  border-radius: 4px;
}

.hp-vessel-shine-2 {
  position: absolute;
  top: 4px;
  left: 50%;
  width: 20%;
  height: 2px;
  background: rgba(255,200,200,0.1);
  border-radius: 2px;
}

/* Текст поверх */
.hp-vessel-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font-family: var(--font-cinzel);
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.5);
  z-index: 5;
  letter-spacing: 0.5px;
}

.hp-vessel-icon {
  font-size: 11px;
  animation: heartbeat 2s ease-in-out infinite;
  filter: drop-shadow(0 0 3px rgba(255,50,50,0.5));
}

@keyframes heartbeat {
  0%, 100% { transform: scale(1); }
  15% { transform: scale(1.15); }
  30% { transform: scale(1); }
  45% { transform: scale(1.1); }
}

.hp-vessel-separator {
  opacity: 0.5;
  font-size: 10px;
}

/* Капли крови при низком HP */
.hp-drip-1, .hp-drip-2 {
  position: absolute;
  bottom: -8px;
  width: 3px;
  height: 8px;
  background: linear-gradient(180deg, #cc2222, transparent);
  border-radius: 0 0 3px 3px;
  animation: drip 2s ease-in infinite;
  z-index: 6;
}

.hp-drip-1 { left: 25%; animation-delay: 0s; }
.hp-drip-2 { left: 70%; animation-delay: 1s; }

@keyframes drip {
  0%, 60% { opacity: 0; transform: scaleY(0); }
  70% { opacity: 0.8; transform: scaleY(1); }
  100% { opacity: 0; transform: scaleY(1) translateY(12px); }
}

/* ══════════════════════════════════════════════════════════════
   MANA CRYSTAL (Кристалл маны)
   ══════════════════════════════════════════════════════════════ */

.mana-crystal {
  position: relative;
  height: 24px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #1a3a5a;
  box-shadow:
    0 0 10px rgba(68,153,221,0.15),
    inset 0 1px 3px rgba(0,0,0,0.5);
}

.mana-crystal-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, #0a1520 0%, #0e1a28 50%, #0a1520 100%);
}

.mana-crystal-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: linear-gradient(180deg,
    #4499dd 0%,
    #3377bb 30%,
    #2a5a8a 60%,
    #1e4468 100%
  );
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  border-radius: 12px;
}

/* Искры в кристалле */
.mana-spark {
  position: absolute;
  width: 2px;
  height: 2px;
  border-radius: 50%;
  background: #88ccff;
  box-shadow: 0 0 4px 1px rgba(136,204,255,0.6);
  animation: spark-drift linear infinite;
  pointer-events: none;
}

.mana-spark-1 { top: 30%; left: 15%; animation-duration: 2.5s; animation-delay: 0s; }
.mana-spark-2 { top: 60%; left: 35%; animation-duration: 3s; animation-delay: 0.5s; width: 1px; height: 1px; }
.mana-spark-3 { top: 20%; left: 55%; animation-duration: 2.8s; animation-delay: 1s; }
.mana-spark-4 { top: 70%; left: 70%; animation-duration: 3.2s; animation-delay: 1.5s; width: 1px; height: 1px; }
.mana-spark-5 { top: 40%; left: 85%; animation-duration: 2.6s; animation-delay: 0.8s; }
.mana-spark-6 { top: 50%; left: 25%; animation-duration: 3.5s; animation-delay: 2s; width: 1px; height: 1px; }

@keyframes spark-drift {
  0% { opacity: 0; transform: translate(0, 0) scale(0); }
  20% { opacity: 1; transform: translate(2px, -2px) scale(1); }
  80% { opacity: 0.6; transform: translate(-3px, 3px) scale(0.8); }
  100% { opacity: 0; transform: translate(5px, -5px) scale(0); }
}

/* Бегущий блик */
.mana-crystal-shimmer {
  position: absolute;
  top: 0;
  left: -40%;
  width: 30%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(136,204,255,0.15), transparent);
  animation: shimmer-run 4s ease-in-out infinite;
  transform: skewX(-20deg);
}

@keyframes shimmer-run {
  0%, 100% { left: -40%; opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { left: 140%; opacity: 0; }
}

.mana-crystal-shine {
  position: absolute;
  top: 2px;
  left: 15%;
  width: 25%;
  height: 3px;
  background: linear-gradient(90deg, transparent, rgba(136,204,255,0.2), transparent);
  border-radius: 3px;
}

/* Текст */
.mana-crystal-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font-family: var(--font-cinzel);
  font-size: 11px;
  font-weight: 700;
  color: #d0e8ff;
  text-shadow: 0 1px 4px rgba(0,0,0,0.8), 0 0 6px rgba(68,153,221,0.3);
  z-index: 5;
  letter-spacing: 0.5px;
}

.mana-crystal-icon {
  font-size: 10px;
  animation: crystal-glow 3s ease-in-out infinite;
  filter: drop-shadow(0 0 4px rgba(68,153,221,0.6));
}

@keyframes crystal-glow {
  0%, 100% { filter: drop-shadow(0 0 4px rgba(68,153,221,0.4)); }
  50% { filter: drop-shadow(0 0 8px rgba(68,153,221,0.8)); }
}

.mana-crystal-separator {
  opacity: 0.4;
  font-size: 9px;
}

/* ══════════════════════════════════════════════════════════════
   BUTTONS
   ══════════════════════════════════════════════════════════════ */

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 6px;
  font-family: var(--font-cinzel);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
  text-transform: uppercase;
}

.btn::before {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.3s;
  border-radius: inherit;
}

.btn:hover::before {
  opacity: 1;
}

.btn:active {
  transform: scale(0.97);
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}

/* Gold */
.btn-gold {
  background: linear-gradient(180deg, #3a2a10 0%, #2a1e0a 100%);
  border-color: var(--color-gold-dark);
  color: var(--color-gold-bright);
  box-shadow: 0 0 0 0 rgba(200,168,78,0);
}

.btn-gold::before {
  background: linear-gradient(180deg, rgba(200,168,78,0.1) 0%, rgba(200,168,78,0.05) 100%);
}

.btn-gold:hover:not(:disabled) {
  border-color: var(--color-gold);
  box-shadow: 0 0 12px rgba(200,168,78,0.3), inset 0 0 12px rgba(200,168,78,0.05);
  color: #fff;
}

/* Danger/Blood */
.btn-danger, .btn-blood {
  background: linear-gradient(180deg, #2a0a0a 0%, #1a0505 100%);
  border-color: #4a1515;
  color: var(--color-blood-bright);
}

.btn-danger::before, .btn-blood::before {
  background: linear-gradient(180deg, rgba(204,34,34,0.1) 0%, rgba(204,34,34,0.05) 100%);
}

.btn-danger:hover:not(:disabled), .btn-blood:hover:not(:disabled) {
  border-color: var(--color-blood-bright);
  box-shadow: 0 0 12px rgba(204,34,34,0.3);
  color: #ff6666;
}

/* Success */
.btn-success {
  background: linear-gradient(180deg, #0a2a0a 0%, #051a05 100%);
  border-color: #1a4a1a;
  color: #44cc44;
}

.btn-success::before {
  background: linear-gradient(180deg, rgba(68,204,68,0.1) 0%, transparent 100%);
}

.btn-success:hover:not(:disabled) {
  border-color: #44cc44;
  box-shadow: 0 0 12px rgba(68,204,68,0.3);
}

/* Secondary */
.btn-secondary {
  background: linear-gradient(180deg, #1e1e28 0%, #14141e 100%);
  border-color: var(--color-edge-bone);
  color: var(--color-faded);
}

.btn-secondary:hover:not(:disabled) {
  border-color: var(--color-ancient);
  color: var(--color-bone);
  box-shadow: 0 0 8px rgba(122,106,74,0.2);
}

/* Mana */
.btn-mana {
  background: linear-gradient(180deg, #0e1a2a 0%, #0a1420 100%);
  border-color: #1a3a5a;
  color: var(--color-mana-bright);
}

.btn-mana:hover:not(:disabled) {
  border-color: var(--color-mana-bright);
  box-shadow: 0 0 12px rgba(68,153,221,0.3);
}

/* Size */
.btn-sm {
  padding: 4px 8px;
  font-size: 11px;
}

/* ══════════════════════════════════════════════════════════════
   PANELS & SECTIONS
   ══════════════════════════════════════════════════════════════ */

.panel {
  background: var(--color-panel);
  border: 1px solid var(--color-edge-bone);
  border-radius: 8px;
  position: relative;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

/* Декоративные ромбы-уголки */
.panel::before,
.panel::after {
  content: '◆';
  position: absolute;
  font-size: 6px;
  color: var(--color-gold-dark);
  opacity: 0.5;
}

.panel::before { top: -3px; left: 12px; }
.panel::after { bottom: -3px; right: 12px; }

/* Section collapse */
.section-collapse {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.3s ease;
  overflow: hidden;
}

.section-collapse.open {
  grid-template-rows: 1fr;
}

.section-collapse > * {
  min-height: 0;
}

/* ══════════════════════════════════════════════════════════════
   TABS
   ══════════════════════════════════════════════════════════════ */

.tab-active {
  color: var(--color-gold-bright);
  background: linear-gradient(180deg, rgba(200,168,78,0.08) 0%, transparent 100%);
  text-shadow: 0 0 8px rgba(200,168,78,0.4);
  position: relative;
}

.tab-inactive {
  color: var(--color-faded);
  opacity: 0.7;
}

.tab-inactive:hover {
  opacity: 1;
  color: var(--color-bone);
  background: rgba(255,255,255,0.03);
}

/* Золотой ромбик под активной вкладкой */
.tab-rune {
  position: relative;
}

.tab-active.tab-rune::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
  width: 6px;
  height: 6px;
  background: var(--color-gold);
  box-shadow: 0 0 6px rgba(200,168,78,0.5);
  z-index: 10;
}

/* Tab content animation */
.tab-content-enter {
  animation: tab-enter 0.3s ease-out;
}

@keyframes tab-enter {
  0% { opacity: 0; transform: translateY(8px); }
  100% { opacity: 1; transform: translateY(0); }
}

/* Sub tabs */
.sub-tab {
  padding: 6px 12px;
  font-family: var(--font-cinzel);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  border-radius: 4px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--color-faded);
  background: transparent;
}

.sub-tab:hover {
  color: var(--color-bone);
  background: rgba(255,255,255,0.03);
}

.sub-tab-active {
  color: var(--color-gold-bright) !important;
  border-color: var(--color-gold-dark);
  background: rgba(200,168,78,0.08) !important;
  box-shadow: 0 0 8px rgba(200,168,78,0.15);
}

/* ══════════════════════════════════════════════════════════════
   MODALS
   ══════════════════════════════════════════════════════════════ */

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(4px);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  animation: modal-bg-in 0.2s ease-out;
}

@keyframes modal-bg-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-box {
  background: linear-gradient(180deg, #16161e 0%, #101018 100%);
  border: 1px solid var(--color-edge-bone);
  border-radius: 12px;
  padding: 20px;
  overflow-y: auto;
  max-height: 85vh;
  width: 100%;
  box-shadow:
    0 0 30px rgba(0,0,0,0.5),
    0 0 60px rgba(0,0,0,0.3),
    inset 0 1px 0 rgba(200,168,78,0.05);
  animation: modal-enter 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes modal-enter {
  from { opacity: 0; transform: scale(0.95) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

/* ══════════════════════════════════════════════════════════════
   TOAST NOTIFICATIONS
   ══════════════════════════════════════════════════════════════ */

.toast {
  background: linear-gradient(135deg, #1a1a24 0%, #14141e 100%);
  border: 1px solid var(--color-edge-bone);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 12px;
  font-family: var(--font-garamond);
  color: var(--color-bone);
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  position: relative;
  overflow: hidden;
  animation: toast-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Цветная полоска слева */
.toast::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
}

.toast-success::before { background: linear-gradient(180deg, #44cc44, #228822); }
.toast-error::before { background: linear-gradient(180deg, #cc2222, #881414); }
.toast-warning::before { background: linear-gradient(180deg, #ccaa22, #886611); }
.toast-info::before { background: linear-gradient(180deg, #4499dd, #2266aa); }

@keyframes toast-in {
  from { opacity: 0; transform: translateX(20px) scale(0.95); }
  to { opacity: 1; transform: translateX(0) scale(1); }
}

/* ══════════════════════════════════════════════════════════════
   DICE RESULTS
   ══════════════════════════════════════════════════════════════ */

.dice-card {
  background: linear-gradient(135deg, #1a1a24 0%, #12121a 100%);
  border: 1px solid var(--color-edge-bone);
  border-radius: 8px;
  padding: 10px 14px;
  position: relative;
  overflow: hidden;
  animation: unfurl 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.dice-card-crit {
  border-color: var(--color-gold) !important;
  box-shadow: 0 0 16px rgba(232,208,104,0.2);
}

.dice-card-fail {
  border-color: var(--color-blood-bright) !important;
  box-shadow: 0 0 12px rgba(204,34,34,0.2);
}

@keyframes unfurl {
  from { opacity: 0; transform: scaleY(0.8) translateY(-5px); }
  to { opacity: 1; transform: scaleY(1) translateY(0); }
}

/* Грань кубика */
.die-face {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--font-cinzel);
  font-weight: 900;
  font-size: 13px;
  border: 1px solid var(--color-edge-bone);
  background: var(--color-obsidian);
  color: var(--color-bone);
}

.die-face-crit {
  background: linear-gradient(135deg, #3a2a10, #2a1e0a) !important;
  border-color: var(--color-gold) !important;
  color: var(--color-gold-bright) !important;
  box-shadow: 0 0 8px rgba(200,168,78,0.3);
}

.die-face-fail {
  background: linear-gradient(135deg, #2a0808, #1a0505) !important;
  border-color: var(--color-blood-bright) !important;
  color: var(--color-blood-bright) !important;
}

/* Вращающиеся лучи на крит-карте */
.crit-rays {
  position: absolute;
  inset: -50%;
  background: conic-gradient(
    from 0deg,
    transparent 0deg,
    rgba(232,208,104,0.05) 10deg,
    transparent 20deg,
    transparent 40deg,
    rgba(232,208,104,0.05) 50deg,
    transparent 60deg
  );
  animation: crit-spin 8s linear infinite;
  pointer-events: none;
}

@keyframes crit-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ══════════════════════════════════════════════════════════════
   COMBAT LOG
   ══════════════════════════════════════════════════════════════ */

.combat-log {
  font-family: var(--font-garamond);
  font-size: 12px;
  line-height: 1.6;
}

.log-entry {
  padding: 2px 0;
  border-bottom: 1px solid rgba(42,37,32,0.3);
}

.log-crit { color: var(--color-gold-bright); font-weight: 700; }
.log-hit { color: #66cc66; }
.log-miss { color: var(--color-faded); font-style: italic; }
.log-mana { color: var(--color-mana-bright); }
.log-damage { color: var(--color-blood-bright); }
.log-info { color: var(--color-ancient); }

/* ══════════════════════════════════════════════════════════════
   LOADING SPINNER (Rune circle)
   ══════════════════════════════════════════════════════════════ */

.rune-spinner {
  width: 48px;
  height: 48px;
  border: 2px solid rgba(200,168,78,0.15);
  border-top-color: var(--color-gold);
  border-radius: 50%;
  animation: rune-spin 1s linear infinite;
  position: relative;
}

.rune-spinner::after {
  content: '⟐';
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: var(--color-gold);
  animation: rune-spin-reverse 2s linear infinite;
}

@keyframes rune-spin {
  to { transform: rotate(360deg); }
}

@keyframes rune-spin-reverse {
  to { transform: rotate(-360deg); }
}

/* ══════════════════════════════════════════════════════════════
   INPUTS & FORMS
   ══════════════════════════════════════════════════════════════ */

input[type="text"],
input[type="number"],
input[type="url"],
textarea,
select {
  background: var(--color-abyss);
  border: 1px solid var(--color-edge-bone);
  border-radius: 6px;
  padding: 8px 10px;
  color: var(--color-bone);
  font-family: var(--font-garamond);
  font-size: 13px;
  transition: border-color 0.2s, box-shadow 0.2s;
  width: 100%;
}

input:focus,
textarea:focus,
select:focus {
  outline: none;
  border-color: var(--color-gold-dark);
  box-shadow: 0 0 8px rgba(200,168,78,0.15);
}

select {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238a7e66'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 28px;
}

/* Number input arrows */
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  opacity: 0.3;
}

/* Checkbox custom */
.checkbox-custom {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-family: var(--font-garamond);
  font-size: 13px;
  color: var(--color-bone);
  user-select: none;
}

.checkbox-custom input[type="checkbox"] {
  appearance: none;
  width: 16px;
  height: 16px;
  border: 1px solid var(--color-edge-bone);
  border-radius: 3px;
  background: var(--color-abyss);
  cursor: pointer;
  position: relative;
  flex-shrink: 0;
  transition: all 0.2s;
}

.checkbox-custom input[type="checkbox"]:checked {
  background: var(--color-gold-dark);
  border-color: var(--color-gold);
}

.checkbox-custom input[type="checkbox"]:checked::after {
  content: '✓';
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: var(--color-gold-bright);
  font-weight: 700;
}

/* ══════════════════════════════════════════════════════════════
   EMPTY STATE
   ══════════════════════════════════════════════════════════════ */

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  text-align: center;
  min-height: 200px;
}

.empty-state-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
  animation: float-gentle 3s ease-in-out infinite;
}

@keyframes float-gentle {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

/* ══════════════════════════════════════════════════════════════
   CARD (Rok cards & general)
   ══════════════════════════════════════════════════════════════ */

.card-flip-container {
  perspective: 600px;
}

.card-flip {
  transition: transform 0.6s;
  transform-style: preserve-3d;
  position: relative;
}

.card-flip.flipped {
  transform: rotateY(180deg);
}

.card-front, .card-back {
  backface-visibility: hidden;
  position: absolute;
  inset: 0;
  border-radius: 8px;
}

.card-back {
  transform: rotateY(180deg);
}

/* ══════════════════════════════════════════════════════════════
   NUMBER STEPPER
   ══════════════════════════════════════════════════════════════ */

.number-stepper {
  display: flex;
  align-items: center;
  gap: 0;
  border: 1px solid var(--color-edge-bone);
  border-radius: 6px;
  overflow: hidden;
  background: var(--color-abyss);
}

.number-stepper button {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-obsidian);
  color: var(--color-faded);
  border: none;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.15s;
}

.number-stepper button:hover {
  background: var(--color-gold-dark);
  color: var(--color-gold-bright);
}

.number-stepper input {
  width: 48px;
  text-align: center;
  border: none;
  border-left: 1px solid var(--color-edge-bone);
  border-right: 1px solid var(--color-edge-bone);
  border-radius: 0;
  background: var(--color-abyss);
  padding: 4px;
  font-size: 12px;
}

/* ══════════════════════════════════════════════════════════════
   UTILITY ANIMATIONS
   ══════════════════════════════════════════════════════════════ */

.animate-float {
  animation: float-gentle 3s ease-in-out infinite;
}

.animate-pulse-gold {
  animation: pulse-gold 2s ease-in-out infinite;
}

@keyframes pulse-gold {
  0%, 100% { box-shadow: 0 0 0 rgba(200,168,78,0); }
  50% { box-shadow: 0 0 12px rgba(200,168,78,0.3); }
}

.animate-unfurl {
  animation: unfurl 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* ══════════════════════════════════════════════════════════════
   SECTION HEADERS
   ══════════════════════════════════════════════════════════════ */

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-family: var(--font-cinzel);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-gold);
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid var(--color-edge-bone);
  transition: color 0.2s;
}

.section-header:hover {
  color: var(--color-gold-bright);
}

.section-header-icon {
  font-size: 14px;
}

.section-header-arrow {
  margin-left: auto;
  font-size: 10px;
  transition: transform 0.3s;
  color: var(--color-faded);
}

.section-header-arrow.open {
  transform: rotate(180deg);
}

/* ══════════════════════════════════════════════════════════════
   MISC
   ══════════════════════════════════════════════════════════════ */

/* Label for form fields */
.field-label {
  display: block;
  font-family: var(--font-cinzel);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-faded);
  margin-bottom: 4px;
}

/* Divider */
.divider-rune {
  text-align: center;
  color: var(--color-gold-dark);
  font-size: 10px;
  letter-spacing: 8px;
  opacity: 0.4;
  padding: 4px 0;
}

/* Glow text */
.text-glow-gold {
  text-shadow: 0 0 8px rgba(200,168,78,0.4);
}

.text-glow-blood {
  text-shadow: 0 0 8px rgba(204,34,34,0.4);
}

.text-glow-mana {
  text-shadow: 0 0 8px rgba(68,153,221,0.4);
}
