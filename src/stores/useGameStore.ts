// src/stores/useGameStore.ts

// ... остальные импорты
import { tokenBarService } from "@/services/tokenBarService";

// ... остальной код store

export const useGameStore = create(
  // ... persist config
  (set, get) => ({
    // ... другие поля

    setHP: (unitId: string, current: number) => {
      set((state) => {
        const unit = state.units.find(u => u.id === unitId);
        if (!unit) return {};
        const newUnit = { ...unit, health: { ...unit.health, current } };
        const units = state.units.map(u => u.id === unitId ? newUnit : u);
        
        // Обновляем бар на сцене
        if (state.settings.showTokenBars && newUnit.owlbearTokenId) {
          tokenBarService.updateBars(newUnit);
        }

        return { units };
      });
    },

    setMana: (unitId: string, current: number) => {
      set((state) => {
        const unit = state.units.find(u => u.id === unitId);
        if (!unit) return {};
        const newUnit = { ...unit, mana: { ...unit.mana, current } };
        const units = state.units.map(u => u.id === unitId ? newUnit : u);
        
        if (state.settings.showTokenBars && newUnit.owlbearTokenId) {
          tokenBarService.updateBars(newUnit);
        }

        return { units };
      });
    },

    updateUnit: (unit: Unit) => {
      set((state) => {
        const units = state.units.map(u => u.id === unit.id ? unit : u);
        
        if (state.settings.showTokenBars && unit.owlbearTokenId) {
          tokenBarService.updateBars(unit);
        }

        return { units };
      });
    },

    deleteUnit: (unitId: string) => {
      set((state) => {
        const unit = state.units.find(u => u.id === unitId);
        if (unit && state.settings.showTokenBars && unit.owlbearTokenId) {
          tokenBarService.deleteBars(unitId);
        }
        return {
          units: state.units.filter(u => u.id !== unitId),
        };
      });
    },

    updateSettings: (newSettings: Partial<Settings>) => {
      set((state) => {
        const settings = { ...state.settings, ...newSettings };
        
        // Если выключили showTokenBars — удаляем все бары
        if (newSettings.showTokenBars === false) {
          state.units.forEach(unit => {
            if (unit.owlbearTokenId) {
              tokenBarService.deleteBars(unit.id);
            }
          });
        }
        // Если включили — создаём бары для всех
        else if (newSettings.showTokenBars === true) {
          state.units.forEach(unit => {
            if (unit.owlbearTokenId) {
              tokenBarService.createOrUpdateBars(unit);
            }
          });
        }

        return { settings };
      });
    },

    // ... остальные методы
  })
);
