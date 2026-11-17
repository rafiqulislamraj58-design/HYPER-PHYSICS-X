// src/store/useSimulationStore.ts
import { create } from 'zustand';

export type QualityPreset = 'low' | 'medium' | 'high';
// নতুন 'thermal' ল্যাব যুক্ত করা হলো
export type PhysicsLab = 'fluid' | 'ocean' | 'cloth' | 'gravity' | 'unified' | 'thermal';
export type FluidPreset = 'water' | 'mercury' | 'lava' | 'honey' | 'oil';
export type FluidTool = 'push' | 'vortex' | 'attract';
export type ClothPreset = 'silk' | 'cotton' | 'denim' | 'rubber' | 'polyester';
export type ClothTool = 'grab' | 'cut' | 'pin';

export interface FluidMaterialConfig {
  name: string;
  color: string;
  foamColor: string;
  emissive: string;
  viscosity: number;
  restDensity: number;
  stiffness: number;
  roughness: number;
  metalness: number;
}

export interface ClothMaterialConfig {
  name: string;
  color: string;
  stiffness: number;
  tearThreshold: number;
  damping: number;
  roughness: number;
}

export const FLUID_PRESETS: Record<FluidPreset, FluidMaterialConfig> = {
  water: { name: 'Water', color: '#06b6d4', foamColor: '#e0f2fe', emissive: '#000000', viscosity: 0.12, restDensity: 1.0, stiffness: 1.2, roughness: 0.1, metalness: 0.1 },
  mercury: { name: 'Mercury', color: '#94a3b8', foamColor: '#f8fafc', emissive: '#000000', viscosity: 0.08, restDensity: 2.2, stiffness: 2.0, roughness: 0.05, metalness: 0.95 },
  lava: { name: 'Lava', color: '#ea580c', foamColor: '#fef08a', emissive: '#dc2626', viscosity: 0.65, restDensity: 1.6, stiffness: 0.9, roughness: 0.4, metalness: 0.2 },
  honey: { name: 'Honey', color: '#eab308', foamColor: '#fef9c3', emissive: '#000000', viscosity: 0.85, restDensity: 1.4, stiffness: 0.8, roughness: 0.15, metalness: 0.1 },
  oil: { name: 'Oil', color: '#3b82f6', foamColor: '#93c5fd', emissive: '#000000', viscosity: 0.35, restDensity: 0.85, stiffness: 1.0, roughness: 0.2, metalness: 0.3 },
};

export const CLOTH_PRESETS: Record<ClothPreset, ClothMaterialConfig> = {
  silk: { name: 'Silk', color: '#ec4899', stiffness: 0.85, tearThreshold: 2.1, damping: 0.99, roughness: 0.2 },
  cotton: { name: 'Cotton', color: '#38bdf8', stiffness: 0.92, tearThreshold: 2.5, damping: 0.98, roughness: 0.7 },
  denim: { name: 'Denim', color: '#3b82f6', stiffness: 0.98, tearThreshold: 3.4, damping: 0.96, roughness: 0.85 },
  rubber: { name: 'Rubber', color: '#10b981', stiffness: 0.45, tearThreshold: 4.5, damping: 0.95, roughness: 0.4 },
  polyester: { name: 'Polyester', color: '#a855f7', stiffness: 0.9, tearThreshold: 2.8, damping: 0.985, roughness: 0.35 },
};

export interface ExperimentSnapshot {
  activeLab: PhysicsLab;
  gravity: number;
  timeScale: number;
  fluidPreset: FluidPreset;
  viscosity: number;
  clothPreset: ClothPreset;
  windStrength: number;
  blackHoleMass: number;
  lensingIntensity: number;
  binarySystem: boolean;
  unifiedSingularity: boolean;
  clothWetnessFactor: number;
  temperature: number;
}

interface SimulationState {
  isPlaying: boolean;
  timeScale: number;
  gravity: number;
  quality: QualityPreset;
  activeLab: PhysicsLab;
  particleCount: number;
  fluidPreset: FluidPreset;
  fluidTool: FluidTool;
  fluidEmitter: boolean;
  fluidObstacle: boolean;
  waveIntensity: number;
  viscosity: number;
  clothPreset: ClothPreset;
  clothTool: ClothTool;
  windStrength: number;
  blackHoleMass: number;
  lensingIntensity: number;
  binarySystem: boolean;
  unifiedSingularity: boolean;
  clothWetnessFactor: number;
  // Thermal Lab Controls
  temperature: number;
  stepTrigger: number;
  savedSnapshot: ExperimentSnapshot | null;
  resetCounter: number;

  togglePlay: () => void;
  stepForward: () => void;
  resetSimulation: () => void;
  setQuality: (quality: QualityPreset) => void;
  setActiveLab: (lab: PhysicsLab) => void;
  setGravity: (val: number) => void;
  setTimeScale: (val: number) => void;
  setFluidPreset: (preset: FluidPreset) => void;
  setFluidTool: (tool: FluidTool) => void;
  setFluidEmitter: (val: boolean) => void;
  setFluidObstacle: (val: boolean) => void;
  setWaveIntensity: (val: number) => void;
  setViscosity: (val: number) => void;
  setClothPreset: (preset: ClothPreset) => void;
  setClothTool: (tool: ClothTool) => void;
  setWindStrength: (val: number) => void;
  setBlackHoleMass: (val: number) => void;
  setLensingIntensity: (val: number) => void;
  setBinarySystem: (val: boolean) => void;
  setUnifiedSingularity: (val: boolean) => void;
  setClothWetnessFactor: (val: number) => void;
  setTemperature: (val: number) => void;
  saveSnapshot: () => void;
  restoreSnapshot: () => void;
}

const QUALITY_PARTICLES: Record<QualityPreset, number> = {
  low: 1200,
  medium: 3000,
  high: 6000,
};

export const useSimulationStore = create<SimulationState>((set) => ({
  isPlaying: true,
  timeScale: 1.0,
  gravity: 9.81,
  quality: 'low',
  activeLab: 'fluid',
  particleCount: QUALITY_PARTICLES['low'],
  fluidPreset: 'water',
  fluidTool: 'push',
  fluidEmitter: false,
  fluidObstacle: true,
  waveIntensity: 1.2,
  viscosity: FLUID_PRESETS['water'].viscosity,
  clothPreset: 'silk',
  clothTool: 'grab',
  windStrength: 2.5,
  blackHoleMass: 18.0,
  lensingIntensity: 1.2,
  binarySystem: false,
  unifiedSingularity: false,
  clothWetnessFactor: 1.5,
  temperature: 298, // Room temperature (Kelvin) default
  stepTrigger: 0,
  savedSnapshot: null,
  resetCounter: 0,

  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  stepForward: () => set((state) => ({ isPlaying: false, stepTrigger: state.stepTrigger + 1 })),
  resetSimulation: () => set((state) => ({ resetCounter: state.resetCounter + 1, isPlaying: true })),
  setQuality: (quality) => set({ quality, particleCount: QUALITY_PARTICLES[quality] }),
  setActiveLab: (activeLab) => set({ activeLab }),
  setGravity: (gravity) => set({ gravity }),
  setTimeScale: (timeScale) => set({ timeScale }),
  setFluidPreset: (fluidPreset) => set({ fluidPreset, viscosity: FLUID_PRESETS[fluidPreset].viscosity }),
  setFluidTool: (fluidTool) => set({ fluidTool }),
  setFluidEmitter: (fluidEmitter) => set({ fluidEmitter }),
  setFluidObstacle: (fluidObstacle) => set({ fluidObstacle }),
  setWaveIntensity: (waveIntensity) => set({ waveIntensity }),
  setViscosity: (viscosity) => set({ viscosity }),
  setClothPreset: (clothPreset) => set({ clothPreset }),
  setClothTool: (clothTool) => set({ clothTool }),
  setWindStrength: (windStrength) => set({ windStrength }),
  setBlackHoleMass: (blackHoleMass) => set({ blackHoleMass }),
  setLensingIntensity: (lensingIntensity) => set({ lensingIntensity }),
  setBinarySystem: (binarySystem) => set({ binarySystem }),
  setUnifiedSingularity: (unifiedSingularity) => set({ unifiedSingularity }),
  setClothWetnessFactor: (clothWetnessFactor) => set({ clothWetnessFactor }),
  setTemperature: (temperature) => set({ temperature }),

  saveSnapshot: () =>
    set((state) => ({
      savedSnapshot: {
        activeLab: state.activeLab,
        gravity: state.gravity,
        timeScale: state.timeScale,
        fluidPreset: state.fluidPreset,
        viscosity: state.viscosity,
        clothPreset: state.clothPreset,
        windStrength: state.windStrength,
        blackHoleMass: state.blackHoleMass,
        lensingIntensity: state.lensingIntensity,
        binarySystem: state.binarySystem,
        unifiedSingularity: state.unifiedSingularity,
        clothWetnessFactor: state.clothWetnessFactor,
        temperature: state.temperature,
      },
    })),

  restoreSnapshot: () =>
    set((state) => {
      if (!state.savedSnapshot) return state;
      return {
        ...state.savedSnapshot,
        resetCounter: state.resetCounter + 1,
        isPlaying: true,
      };
    }),
}));