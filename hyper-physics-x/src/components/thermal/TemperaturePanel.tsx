
'use client';

import React from 'react';

import { useThermalStore } from '@/store/useThermalStore';

import {
  ELEMENT_DATABASE,
  ELEMENT_IDS,
} from '@/data/elements/ElementDatabase';

import {
  calculateThermalState,
} from '@/engine/physics/thermal/ThermalSolver';

export default function TemperaturePanel() {
  const {
    selectedElement,
    temperature,
    isPlaying,
    showParticles,
    setElement,
    setTemperature,
    heat,
    cool,
    reset,
    togglePlaying,
    toggleParticles,
  } = useThermalStore();

  const element = ELEMENT_DATABASE[selectedElement];

  const thermal = calculateThermalState(
    element,
    temperature
  );

  const formatTemp = (value: number) =>
    `${value.toFixed(1)}°C`;

  return (
    <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-950/95 p-5 text-white shadow-2xl">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">
            Thermal Lab
          </h2>

          <p className="text-xs text-slate-400">
            Temperature & Material Physics
          </p>
        </div>

        <span className="rounded-lg bg-orange-500/15 px-3 py-2 text-orange-400">
          {thermal.phase.toUpperCase()}
        </span>
      </div>

      {/* Element selector */}
      <label className="mb-2 block text-xs font-semibold text-slate-400">
        SELECT ELEMENT
      </label>

      <select
        value={selectedElement}
        onChange={(e) => setElement(e.target.value)}
        className="mb-5 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm outline-none focus:border-blue-500"
      >
        {ELEMENT_IDS.map((id) => (
          <option key={id} value={id}>
            {ELEMENT_DATABASE[id].name}
          </option>
        ))}
      </select>

      {/* Temperature */}
      <div className="mb-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">
            Temperature
          </span>

          <span className="text-3xl font-bold tabular-nums text-orange-400">
            {formatTemp(temperature)}
          </span>
        </div>
      </div>

      <input
        type="range"
        min="-273"
        max="3000"
        step="1"
        value={temperature}
        onChange={(e) =>
          setTemperature(Number(e.target.value))
        }
        className="mb-5 w-full cursor-pointer accent-orange-500"
      />

      {/* Heat / Cool */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        <button
          onClick={() => heat(10)}
          className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold transition hover:bg-orange-400"
        >
          + Heat 10°C
        </button>

        <button
          onClick={() => cool(10)}
          className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold transition hover:bg-blue-500"
        >
          - Cool 10°C
        </button>
      </div>

      {/* Material properties */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/5 p-3">
          <p className="text-xs text-slate-400">
            Melting Point
          </p>

          <p className="mt-1 font-semibold">
            {formatTemp(element.meltingPoint)}
          </p>
        </div>

        <div className="rounded-xl bg-white/5 p-3">
          <p className="text-xs text-slate-400">
            Boiling Point
          </p>

          <p className="mt-1 font-semibold">
            {formatTemp(element.boilingPoint)}
          </p>
        </div>

        <div className="rounded-xl bg-white/5 p-3">
          <p className="text-xs text-slate-400">
            Density
          </p>

          <p className="mt-1 font-semibold">
            {element.density.toLocaleString()} kg/m³
          </p>
        </div>

        <div className="rounded-xl bg-white/5 p-3">
          <p className="text-xs text-slate-400">
            Specific Heat
          </p>

          <p className="mt-1 font-semibold">
            {element.specificHeat} J/kg·K
          </p>
        </div>
      </div>

      {/* Status */}
      <div className="mb-4 rounded-xl border border-white/10 bg-slate-900 p-3">
        <p className="text-xs text-slate-400">
          Current Material State
        </p>

        <p className="mt-1 text-lg font-bold capitalize">
          {thermal.phase}
        </p>

        <p className="mt-1 text-xs text-slate-400">
          {element.description}
        </p>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={togglePlaying}
          className="rounded-lg bg-slate-800 px-2 py-3 text-xs font-semibold hover:bg-slate-700"
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>

        <button
          onClick={toggleParticles}
          className="rounded-lg bg-slate-800 px-2 py-3 text-xs font-semibold hover:bg-slate-700"
        >
          {showParticles ? 'Hide Vapor' : 'Show Vapor'}
        </button>

        <button
          onClick={reset}
          className="rounded-lg bg-slate-800 px-2 py-3 text-xs font-semibold hover:bg-slate-700"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
