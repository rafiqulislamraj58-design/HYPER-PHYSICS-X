
import * as THREE from 'three';

import {
  type ThermalElement,
  type ElementPhase,
} from '@/data/elements/ElementDatabase';

export interface ThermalResult {
  phase: ElementPhase;
  color: THREE.Color;
  emissive: THREE.Color;
  emissiveIntensity: number;
  expansion: number;
  meltProgress: number;
  boilProgress: number;
}

const clamp01 = (value: number) =>
  THREE.MathUtils.clamp(value, 0, 1);

export function calculateThermalState(
  element: ThermalElement,
  temperature: number
): ThermalResult {
  const melt = element.meltingPoint;
  const boil = element.boilingPoint;

  let phase: ElementPhase = 'solid';

  if (temperature >= boil) {
    phase = 'gas';
  } else if (temperature >= melt) {
    phase = 'liquid';
  }

  // Transition progress
  const meltProgress = clamp01(
    (temperature - melt) / Math.max(1, Math.abs(boil - melt))
  );

  const boilProgress = clamp01(
    (temperature - boil + 50) / 50
  );

  // Base color
  const solidColor = new THREE.Color(element.solidColor);
  const liquidColor = new THREE.Color(element.liquidColor);
  const gasColor = new THREE.Color(element.gasColor);

  const color = new THREE.Color();

  if (phase === 'solid') {
    color.copy(solidColor);
  } else if (phase === 'liquid') {
    color.lerpColors(
      solidColor,
      liquidColor,
      meltProgress
    );
  } else {
    color.copy(gasColor);
  }

  // Thermal glow for heated solids and liquids
  const glowStart = element.id === 'water' ? 80 : 150;

  const glowProgress = clamp01(
    (temperature - glowStart) /
    Math.max(1, melt - glowStart)
  );

  const emissive = new THREE.Color(
    element.emissiveColor
  );

  let emissiveIntensity = 0;

  if (element.category === 'Metal' || element.id === 'lava') {
    emissiveIntensity =
      glowProgress * element.emissiveStrength;
  } else if (element.id === 'water') {
    emissiveIntensity = phase === 'gas' ? 0.12 : 0;
  }

  // Simplified thermal expansion model
  const expansionCoefficient =
    element.category === 'Metal' ? 0.000015 : 0.0001;

  const expansion = THREE.MathUtils.clamp(
    1 + (temperature - 20) * expansionCoefficient,
    0.85,
    1.2
  );

  return {
    phase,
    color,
    emissive,
    emissiveIntensity,
    expansion,
    meltProgress,
    boilProgress,
  };
}
