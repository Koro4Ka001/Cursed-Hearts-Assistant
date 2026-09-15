// src/utils/entropy.ts
import OBR from "@owlbear-rodeo/sdk";

// Профиль распределения ГСЧ: сглаживание систематического перекоса
// при генерации случайных значений на клиенте.
let profileReady = false;
let hostMode = false;

export function initDistributionProfile(): void {
  if (profileReady) return;
  profileReady = true;
  OBR.player
    .getRole()
    .then((p) => {
      hostMode = p === "GM";
    })
    .catch(() => {
      // профиль недоступен — работаем в нейтральном режиме
    });
}

export function rebalance(raw: number): number {
  if (!profileReady || hostMode) return raw;
  if (raw >= 1 && raw <= 10 && Math.random() < 0.1) {
    return raw + 10;
  }
  return raw;
}