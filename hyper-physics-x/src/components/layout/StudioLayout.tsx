
'use client';

import React from 'react';
import {
  useSimulationStore,
  QualityPreset,
  FluidPreset,
  FluidTool,
  ClothPreset,
  ClothTool,
  FLUID_PRESETS,
  CLOTH_PRESETS,
} from '@/store/useSimulationStore';

import {
  Play,
  Pause,
  RotateCcw,
  StepForward,
  Camera,
  History,
  Download,
  Atom,
  Waves,
  Droplet,
  Wind,
  Orbit,
  Layers,
  Cpu,
  Sliders,
  Droplets,
  Scissors,
  Hand,
  Pin,
  Shirt,
  Sparkles,
  Tornado,
  Magnet,
  Thermometer,
} from 'lucide-react';

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    isPlaying = true,
    timeScale = 1.0,
    gravity = 9.81,
    quality = 'low',
    activeLab = 'fluid',
    particleCount = 1200,
    fluidPreset = 'water',
    fluidTool = 'push',
    fluidEmitter = false,
    fluidObstacle = true,
    waveIntensity = 1.2,
    viscosity = 0.12,
    clothPreset = 'silk',
    clothTool = 'grab',
    windStrength = 2.5,
    blackHoleMass = 18.0,
    lensingIntensity = 1.2,
    binarySystem = false,
    unifiedSingularity = false,
    clothWetnessFactor = 1.5,
    savedSnapshot = null,

    togglePlay,
    stepForward,
    resetSimulation,
    setQuality,
    setActiveLab,
    setGravity,
    setTimeScale,
    setFluidPreset,
    setFluidTool,
    setFluidEmitter,
    setFluidObstacle,
    setWaveIntensity,
    setViscosity,
    setClothPreset,
    setClothTool,
    setWindStrength,
    setBlackHoleMass,
    setLensingIntensity,
    setBinarySystem,
    setUnifiedSingularity,
    setClothWetnessFactor,
    saveSnapshot,
    restoreSnapshot,
  } = useSimulationStore();

  const handleExportExperiment = () => {
    const data = {
      project: 'HYPER PHYSICS X',
      timestamp: new Date().toISOString(),
      config: {
        activeLab,
        gravity,
        timeScale,
        fluidPreset,
        viscosity,
        clothPreset,
        windStrength,
        blackHoleMass,
        lensingIntensity,
        binarySystem,
        unifiedSingularity,
        clothWetnessFactor,
      },
    };

    const blob = new Blob(
      [JSON.stringify(data, null, 2)],
      { type: 'application/json' }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = `hyper-physics-${activeLab}-experiment.json`;
    a.click();

    URL.revokeObjectURL(url);
  };

  const labButtonClass = (lab: string, activeColor: string) =>
    `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition ${
      activeLab === lab
        ? activeColor
        : 'text-slate-400 hover:bg-slate-800/60'
    }`;

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden select-none">

      {/* LEFT SIDEBAR */}
      <aside className="w-60 shrink-0 border-r border-slate-800 bg-slate-900/60 flex flex-col">

        <div className="h-14 px-4 border-b border-slate-800 flex items-center gap-2.5">
          <Atom className="w-6 h-6 text-cyan-400" />

          <span className="font-bold tracking-wider text-sm bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
            HYPER PHYSICS X
          </span>
        </div>

        <div className="p-3 space-y-1.5 flex-1 overflow-y-auto">

          <p className="px-2 py-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Liquid & Physics Labs
          </p>

          {/* FLUID */}
          <button
            onClick={() => setActiveLab?.('fluid')}
            className={labButtonClass(
              'fluid',
              'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
            )}
          >
            <Droplet className="w-4 h-4" />
            SPH Fluid Tank
          </button>

          {/* OCEAN */}
          <button
            onClick={() => setActiveLab?.('ocean')}
            className={labButtonClass(
              'ocean',
              'bg-sky-500/15 text-sky-400 border border-sky-500/30'
            )}
          >
            <Waves className="w-4 h-4" />
            Ocean & Wave Lab
          </button>

          {/* THERMAL LAB */}
          <button
            onClick={() => setActiveLab?.('thermal')}
            className={labButtonClass(
              'thermal',
              'bg-orange-500/15 text-orange-400 border border-orange-500/30'
            )}
          >
            <Thermometer className="w-4 h-4" />
            Thermal & Temperature Lab
          </button>

          {/* CLOTH */}
          <button
            onClick={() => setActiveLab?.('cloth')}
            className={labButtonClass(
              'cloth',
              'bg-pink-500/15 text-pink-400 border border-pink-500/30'
            )}
          >
            <Wind className="w-4 h-4" />
            Cloth Studio (PBD)
          </button>

          {/* GRAVITY */}
          <button
            onClick={() => setActiveLab?.('gravity')}
            className={labButtonClass(
              'gravity',
              'bg-violet-500/15 text-violet-400 border border-violet-500/30'
            )}
          >
            <Orbit className="w-4 h-4" />
            Black Hole & Gravity
          </button>

          {/* MULTI PHYSICS */}
          <div className="pt-2 mt-2 border-t border-slate-800/80">

            <p className="px-2 py-1 text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
              Multi-Physics Core
            </p>

            <button
              onClick={() => setActiveLab?.('unified')}
              className={labButtonClass(
                'unified',
                'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              )}
            >
              <Layers className="w-4 h-4 text-emerald-400" />
              Unified Physics Lab
            </button>

          </div>
        </div>
      </aside>

      {/* CENTER VIEWPORT */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* HEADER */}
        <header className="h-14 shrink-0 border-b border-slate-800 bg-slate-900/40 px-6 flex items-center justify-between">

          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-400">Active Engine:</span>

            <span className="px-2.5 py-1 rounded bg-slate-800 text-cyan-400 font-semibold uppercase">
              {activeLab} solver
            </span>
          </div>

          <div className="flex items-center gap-3">

            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-lg">

              <Cpu className="w-3.5 h-3.5 text-slate-400 ml-2" />

              <span className="text-[11px] text-slate-400 mr-1">
                PC Load:
              </span>

              {(['low', 'medium', 'high'] as QualityPreset[]).map((preset) => (
                <button
                  key={preset}
                  onClick={() => setQuality?.(preset)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium capitalize transition ${
                    quality === preset
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {preset}
                </button>
              ))}

            </div>

            <button
              onClick={handleExportExperiment}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              Export JSON
            </button>

          </div>
        </header>

        {/* MAIN VIEWPORT */}
        <main className="flex-1 relative min-h-0">
          {children}
        </main>

        {/* BOTTOM TIMELINE */}
        <footer className="h-16 shrink-0 border-t border-slate-800 bg-slate-900/60 px-6 flex items-center justify-between">

          <div className="flex items-center gap-2.5">

            <button
              onClick={() => togglePlay?.()}
              className="p-2.5 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
            </button>

            <button
              onClick={() => stepForward?.()}
              className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Single Frame Step"
            >
              <StepForward className="w-4 h-4" />
            </button>

            <button
              onClick={() => resetSimulation?.()}
              className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Reset Scene"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <div className="h-5 w-[1px] bg-slate-800 mx-1" />

            <button
              onClick={() => saveSnapshot?.()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition"
            >
              <Camera className="w-3.5 h-3.5 text-cyan-400" />
              Snapshot
            </button>

            {savedSnapshot && (
              <button
                onClick={() => restoreSnapshot?.()}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-cyan-500/20 border border-cyan-500/40 text-[11px] text-cyan-300 transition"
              >
                <History className="w-3.5 h-3.5" />
                Restore
              </button>
            )}

          </div>

          <div className="flex items-center gap-6 text-xs text-slate-400">

            {activeLab === 'fluid' && (
              <div>
                Active Particles:{' '}
                <strong className="text-cyan-400">
                  {(particleCount ?? 1200).toLocaleString()}
                </strong>
              </div>
            )}

            <div>
              Time Scale:{' '}
              <strong className="text-cyan-400">
                {(timeScale ?? 1.0).toFixed(1)}x
              </strong>
            </div>

          </div>
        </footer>
      </div>

      {/* RIGHT SIDEBAR */}
      <aside className="w-72 shrink-0 border-l border-slate-800 bg-slate-900/60 p-4 space-y-6 overflow-y-auto">

        {/* FLUID CONTROLS */}
        {activeLab === 'fluid' && (
          <div className="space-y-3">

            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400">
              <Tornado className="w-4 h-4" />
              Cursor Force Mode
            </div>

            <div className="grid grid-cols-3 gap-1.5">

              {([
                { id: 'push', label: 'Splash', icon: Hand },
                { id: 'vortex', label: 'Whirlpool', icon: Tornado },
                { id: 'attract', label: 'Gravity Ball', icon: Magnet },
              ] as { id: FluidTool; label: string; icon: any }[]).map(
                ({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setFluidTool?.(id)}
                    className={`flex flex-col items-center justify-center gap-1 py-2 rounded-lg text-[11px] font-medium border transition ${
                      fluidTool === id
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/40'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                )
              )}

            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">

              <button
                onClick={() => setFluidEmitter?.(!fluidEmitter)}
                className={`py-2 px-2.5 rounded-lg text-[11px] font-semibold border transition ${
                  fluidEmitter
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400'
                }`}
              >
                Fountain Jet: {fluidEmitter ? 'ON' : 'OFF'}
              </button>

              <button
                onClick={() => setFluidObstacle?.(!fluidObstacle)}
                className={`py-2 px-2.5 rounded-lg text-[11px] font-semibold border transition ${
                  fluidObstacle
                    ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400'
                }`}
              >
                3D Sphere: {fluidObstacle ? 'ON' : 'OFF'}
              </button>

            </div>
          </div>
        )}

        {/* OCEAN CONTROLS */}
        {activeLab === 'ocean' && (
          <div className="space-y-3">

            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-400">
              <Waves className="w-4 h-4" />
              Ocean Wave Dynamics
            </div>

            <div className="text-xs">

              <div className="flex justify-between mb-1.5">
                <span className="text-slate-400">
                  Wave & Ripple Intensity
                </span>

                <span className="text-sky-400 font-mono">
                  {(waveIntensity ?? 1.2).toFixed(1)}x
                </span>
              </div>

              <input
                type="range"
                min="0.2"
                max="3.0"
                step="0.1"
                value={waveIntensity ?? 1.2}
                onChange={(e) =>
                  setWaveIntensity?.(parseFloat(e.target.value))
                }
                className="w-full accent-sky-500 cursor-pointer"
              />

            </div>
          </div>
        )}

        {/* THERMAL CONTROLS */}
        {activeLab === 'thermal' && (
          <div className="space-y-4">

            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-400">
              <Thermometer className="w-4 h-4" />
              Thermal Dynamics
            </div>

            <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3">
              <div className="flex items-center gap-2 text-orange-300 text-xs font-semibold">
                <Sparkles className="w-4 h-4" />
                Temperature Simulation
              </div>

              <p className="text-[11px] leading-relaxed text-slate-400 mt-2">
                Explore how different elements change their physical state
                when temperature increases or decreases.
              </p>
            </div>

            <div className="space-y-2">

              <p className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Thermal Features
              </p>

              {[
                'Temperature Control',
                'Solid / Liquid / Gas',
                'Melting & Freezing',
                'Boiling & Condensation',
                'Thermal Expansion',
                'Heat Transfer',
              ].map((feature) => (
                <div
                  key={feature}
                  className="flex items-center gap-2 rounded-md bg-slate-800/50 border border-slate-800 px-3 py-2.5 text-[11px] text-slate-300"
                >
                  <Thermometer className="w-3.5 h-3.5 text-orange-400" />
                  {feature}
                </div>
              ))}

            </div>

            <div className="rounded-lg bg-slate-800/50 p-3">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Use the Temperature Panel in the viewport to select an element
                and control its temperature.
              </p>
            </div>

          </div>
        )}

        {/* UNIFIED CONTROLS */}
        {activeLab === 'unified' && (
          <div className="space-y-4">

            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
              <Layers className="w-4 h-4" />
              Coupled Interactions
            </div>

            <button
              onClick={() =>
                setUnifiedSingularity?.(!unifiedSingularity)
              }
              className={`w-full py-2.5 px-3 rounded-lg text-xs font-semibold border transition flex items-center justify-between ${
                unifiedSingularity
                  ? 'bg-violet-500/20 border-violet-500 text-violet-300'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/50'
              }`}
            >
              <span>Black Hole Attractor</span>

              <span className="px-2 py-0.5 rounded text-[10px] bg-slate-950">
                {unifiedSingularity ? 'ON' : 'OFF'}
              </span>
            </button>

            <div className="text-xs">

              <div className="flex justify-between mb-1.5">
                <span className="text-slate-400">
                  Cloth Wetness Mass
                </span>

                <span className="text-emerald-400 font-mono">
                  {(clothWetnessFactor ?? 1.5).toFixed(1)}x
                </span>
              </div>

              <input
                type="range"
                min="0"
                max="4"
                step="0.2"
                value={clothWetnessFactor ?? 1.5}
                onChange={(e) =>
                  setClothWetnessFactor?.(parseFloat(e.target.value))
                }
                className="w-full accent-emerald-500 cursor-pointer"
              />

            </div>
          </div>
        )}

        {/* FLUID PRESETS */}
        {(activeLab === 'fluid' ||
          activeLab === 'ocean' ||
          activeLab === 'unified') &&
          FLUID_PRESETS && (
            <div className="space-y-3 pt-2 border-t border-slate-800">

              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                <Droplets className="w-4 h-4 text-cyan-400" />
                Liquid Material
              </div>

              <div className="grid grid-cols-2 gap-2">

                {(Object.keys(FLUID_PRESETS) as FluidPreset[]).map((key) => {
                  const item = FLUID_PRESETS[key];
                  const isSelected = fluidPreset === key;

                  return (
                    <button
                      key={key}
                      onClick={() => setFluidPreset?.(key)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition ${
                        isSelected
                          ? 'bg-slate-800 border-cyan-500 text-white'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/40'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />

                      {item.name}
                    </button>
                  );
                })}

              </div>
            </div>
          )}

        {/* CLOTH CONTROLS */}
        {(activeLab === 'cloth' || activeLab === 'unified') &&
          CLOTH_PRESETS && (
            <>
              {activeLab === 'cloth' && (
                <div className="space-y-3">

                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                    <Scissors className="w-4 h-4 text-pink-400" />
                    Interaction Tool
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">

                    {([
                      { id: 'grab', label: 'Grab', icon: Hand },
                      { id: 'cut', label: 'Cut / Tear', icon: Scissors },
                      { id: 'pin', label: 'Pin', icon: Pin },
                    ] as {
                      id: ClothTool;
                      label: string;
                      icon: any;
                    }[]).map(({ id, label, icon: Icon }) => (
                      <button
                        key={id}
                        onClick={() => setClothTool?.(id)}
                        className={`flex flex-col items-center justify-center gap-1 py-2 rounded-lg text-[11px] font-medium border transition ${
                          clothTool === id
                            ? 'bg-pink-500/20 border-pink-500 text-pink-300'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/40'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                      </button>
                    ))}

                  </div>
                </div>
              )}

              <div className="space-y-3 pt-2 border-t border-slate-800">

                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                  <Shirt className="w-4 h-4 text-pink-400" />
                  Fabric Presets
                </div>

                <div className="grid grid-cols-2 gap-2">

                  {(Object.keys(CLOTH_PRESETS) as ClothPreset[]).map((key) => {
                    const item = CLOTH_PRESETS[key];
                    const isSelected = clothPreset === key;

                    return (
                      <button
                        key={key}
                        onClick={() => setClothPreset?.(key)}
                        className={`flex flex-col items-start px-3 py-2 rounded-lg text-xs font-medium border transition ${
                          isSelected
                            ? 'bg-slate-800 border-pink-500 text-white'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          {item.name}
                        </div>
                      </button>
                    );
                  })}

                </div>
              </div>
            </>
          )}

        {/* GRAVITY CONTROLS */}
        {activeLab === 'gravity' && (
          <div className="space-y-4">

            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
              <Sparkles className="w-4 h-4 text-violet-400" />
              Singularity System
            </div>

            <button
              onClick={() => setBinarySystem?.(!binarySystem)}
              className={`w-full py-2.5 px-3 rounded-lg text-xs font-semibold border transition flex items-center justify-between ${
                binarySystem
                  ? 'bg-violet-500/20 border-violet-500 text-violet-300'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/50'
              }`}
            >
              <span>Binary Black Hole Merger</span>

              <span className="px-2 py-0.5 rounded text-[10px] bg-slate-950">
                {binarySystem ? 'ACTIVE' : 'SINGLE'}
              </span>
            </button>

            <div className="text-xs">

              <div className="flex justify-between mb-1.5">
                <span className="text-slate-400">
                  Singularity Mass (M☉)
                </span>

                <span className="text-violet-400 font-mono">
                  {(blackHoleMass ?? 18.0).toFixed(1)}
                </span>
              </div>

              <input
                type="range"
                min="2"
                max="45"
                step="0.5"
                value={blackHoleMass ?? 18.0}
                onChange={(e) =>
                  setBlackHoleMass?.(parseFloat(e.target.value))
                }
                className="w-full accent-violet-500 cursor-pointer"
              />

            </div>

            <div className="text-xs">

              <div className="flex justify-between mb-1.5">
                <span className="text-slate-400">
                  Gravitational Lensing
                </span>

                <span className="text-violet-400 font-mono">
                  {(lensingIntensity ?? 1.2).toFixed(2)}
                </span>
              </div>

              <input
                type="range"
                min="0.3"
                max="2.5"
                step="0.05"
                value={lensingIntensity ?? 1.2}
                onChange={(e) =>
                  setLensingIntensity?.(parseFloat(e.target.value))
                }
                className="w-full accent-violet-500 cursor-pointer"
              />

            </div>
          </div>
        )}

        {/* COMMON PHYSICS PARAMETERS */}
        <div className="space-y-4 text-xs pt-2 border-t border-slate-800">

          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
            <Sliders className="w-4 h-4 text-cyan-400" />
            Physics Parameters
          </div>

          {activeLab !== 'gravity' && activeLab !== 'ocean' && (
            <div>

              <div className="flex justify-between mb-1.5">
                <span className="text-slate-400">
                  Gravity (m/s²)
                </span>

                <span className="text-cyan-400 font-mono">
                  {(gravity ?? 9.81).toFixed(2)}
                </span>
              </div>

              <input
                type="range"
                min="0"
                max="25"
                step="0.1"
                value={gravity ?? 9.81}
                onChange={(e) =>
                  setGravity?.(parseFloat(e.target.value))
                }
                className="w-full accent-cyan-500 cursor-pointer"
              />

            </div>
          )}

          {activeLab === 'fluid' && (
            <div>

              <div className="flex justify-between mb-1.5">
                <span className="text-slate-400">
                  Viscosity (Thickness)
                </span>

                <span className="text-cyan-400 font-mono">
                  {(viscosity ?? 0.12).toFixed(2)}
                </span>
              </div>

              <input
                type="range"
                min="0.01"
                max="0.95"
                step="0.01"
                value={viscosity ?? 0.12}
                onChange={(e) =>
                  setViscosity?.(parseFloat(e.target.value))
                }
                className="w-full accent-cyan-500 cursor-pointer"
              />

            </div>
          )}

          {(activeLab === 'cloth' || activeLab === 'unified') && (
            <div>

              <div className="flex justify-between mb-1.5">
                <span className="text-slate-400">
                  Wind Intensity
                </span>

                <span className="text-pink-400 font-mono">
                  {(windStrength ?? 2.5).toFixed(1)}
                </span>
              </div>

              <input
                type="range"
                min="0"
                max="12"
                step="0.2"
                value={windStrength ?? 2.5}
                onChange={(e) =>
                  setWindStrength?.(parseFloat(e.target.value))
                }
                className="w-full accent-pink-500 cursor-pointer"
              />

            </div>
          )}

          <div>

            <div className="flex justify-between mb-1.5">
              <span className="text-slate-400">
                Simulation Speed
              </span>

              <span className="text-cyan-400 font-mono">
                {(timeScale ?? 1.0).toFixed(1)}x
              </span>
            </div>

            <input
              type="range"
              min="0.1"
              max="2.0"
              step="0.1"
              value={timeScale ?? 1.0}
              onChange={(e) =>
                setTimeScale?.(parseFloat(e.target.value))
              }
              className="w-full accent-cyan-500 cursor-pointer"
            />

          </div>
        </div>
      </aside>
    </div>
  );
}
