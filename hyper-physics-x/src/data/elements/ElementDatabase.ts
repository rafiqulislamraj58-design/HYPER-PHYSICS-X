
export type ElementPhase = 'solid' | 'liquid' | 'gas';

export interface ThermalElement {
  id: string;
  name: string;
  category: string;

  meltingPoint: number;
  boilingPoint: number;

  solidColor: string;
  liquidColor: string;
  gasColor: string;

  density: number;
  specificHeat: number;
  thermalConductivity: number;

  emissiveColor: string;
  emissiveStrength: number;

  description: string;
}

export const ELEMENT_DATABASE: Record<string, ThermalElement> = {
  water: {
    id: 'water',
    name: 'Water',
    category: 'Compound',
    meltingPoint: 0,
    boilingPoint: 100,
    solidColor: '#b9e8ff',
    liquidColor: '#168bdb',
    gasColor: '#e8f7ff',
    density: 1000,
    specificHeat: 4186,
    thermalConductivity: 0.6,
    emissiveColor: '#60caff',
    emissiveStrength: 0,
    description: 'Water changes between ice, liquid and vapor.',
  },

  iron: {
    id: 'iron',
    name: 'Iron',
    category: 'Metal',
    meltingPoint: 1538,
    boilingPoint: 2862,
    solidColor: '#858b95',
    liquidColor: '#ff672e',
    gasColor: '#ffd5b5',
    density: 7874,
    specificHeat: 449,
    thermalConductivity: 80,
    emissiveColor: '#ff4b16',
    emissiveStrength: 1.5,
    description: 'Iron becomes incandescent and eventually molten.',
  },

  copper: {
    id: 'copper',
    name: 'Copper',
    category: 'Metal',
    meltingPoint: 1085,
    boilingPoint: 2562,
    solidColor: '#bd7444',
    liquidColor: '#ff762e',
    gasColor: '#ffe0c4',
    density: 8960,
    specificHeat: 385,
    thermalConductivity: 401,
    emissiveColor: '#ff571c',
    emissiveStrength: 1.3,
    description: 'Copper is a highly thermally conductive metal.',
  },

  gold: {
    id: 'gold',
    name: 'Gold',
    category: 'Metal',
    meltingPoint: 1064,
    boilingPoint: 2856,
    solidColor: '#e7b735',
    liquidColor: '#ff9e16',
    gasColor: '#ffe3a8',
    density: 19320,
    specificHeat: 129,
    thermalConductivity: 318,
    emissiveColor: '#ffad24',
    emissiveStrength: 1.4,
    description: 'Gold changes into molten metal when heated.',
  },

  mercury: {
    id: 'mercury',
    name: 'Mercury',
    category: 'Metal',
    meltingPoint: -38.83,
    boilingPoint: 356.73,
    solidColor: '#9b9da4',
    liquidColor: '#c5cbd4',
    gasColor: '#edf1f7',
    density: 13534,
    specificHeat: 140,
    thermalConductivity: 8.3,
    emissiveColor: '#dce7ff',
    emissiveStrength: 0.1,
    description: 'Mercury is liquid at normal room temperature.',
  },

  wax: {
    id: 'wax',
    name: 'Wax',
    category: 'Organic Material',
    meltingPoint: 45,
    boilingPoint: 370,
    solidColor: '#e9d8a5',
    liquidColor: '#f2bd4e',
    gasColor: '#fff1d3',
    density: 900,
    specificHeat: 2100,
    thermalConductivity: 0.25,
    emissiveColor: '#ffb43d',
    emissiveStrength: 0.2,
    description: 'Wax softens and melts when heated.',
  },

  lava: {
    id: 'lava',
    name: 'Lava',
    category: 'Molten Rock',
    meltingPoint: 700,
    boilingPoint: 3000,
    solidColor: '#403b38',
    liquidColor: '#ff4b12',
    gasColor: '#ffb18b',
    density: 2700,
    specificHeat: 1200,
    thermalConductivity: 1.5,
    emissiveColor: '#ff3500',
    emissiveStrength: 2.5,
    description: 'Simplified lava solidification and heating model.',
  },
};

export const ELEMENT_IDS = Object.keys(ELEMENT_DATABASE);
