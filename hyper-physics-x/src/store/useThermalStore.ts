
import { create } from 'zustand';
import {
  ELEMENT_DATABASE,
  type ThermalElement,
} from '@/data/elements/ElementDatabase';

interface ThermalState {
  selectedElement: string;
  temperature: number;
  isPlaying: boolean;
  showParticles: boolean;

  setElement: (id: string) => void;
  setTemperature: (temperature: number) => void;
  heat: (amount?: number) => void;
  cool: (amount?: number) => void;
  reset: () => void;
  togglePlaying: () => void;
  toggleParticles: () => void;
}

const DEFAULT_ELEMENT = 'water';

export const useThermalStore = create<ThermalState>((set) => ({
  selectedElement: DEFAULT_ELEMENT,
  temperature: 25,
  isPlaying: true,
  showParticles: true,

  setElement: (id) => {
    const element = ELEMENT_DATABASE[id];

    if (!element) return;

    set({
      selectedElement: id,
      temperature: 25,
    });
  },

  setTemperature: (temperature) => {
    set({
      temperature: Math.max(
        -273.15,
        Math.min(5000, temperature)
      ),
    });
  },

  heat: (amount = 10) => {
    set((state) => ({
      temperature: Math.min(
        5000,
        state.temperature + amount
      ),
    }));
  },

  cool: (amount = 10) => {
    set((state) => ({
      temperature: Math.max(
        -273.15,
        state.temperature - amount
      ),
    }));
  },

  reset: () => {
    set({
      temperature: 25,
      isPlaying: true,
    });
  },

  togglePlaying: () => {
    set((state) => ({
      isPlaying: !state.isPlaying,
    }));
  },

  toggleParticles: () => {
    set((state) => ({
      showParticles: !state.showParticles,
    }));
  },
}));
