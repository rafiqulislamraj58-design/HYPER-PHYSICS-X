
'use client';

import React, { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import {
  useSimulationStore,
  FLUID_PRESETS,
} from '@/store/useSimulationStore';

const OCEAN_SIZE = 14;
const BASE_HEIGHT = 1.2;

const FIXED_STEP = 1 / 60;
const MAX_SUBSTEPS = 3;

const WAVE_SPEED = 0.18;
const WAVE_DAMPING = 0.012;

const RIPPLE_RADIUS = 4;

type WaveBuffers = {
  current: Float32Array;
  previous: Float32Array;
  next: Float32Array;
};

type BuoyConfig = {
  x: number;
  z: number;
  offset: number;
  rotationSpeed: number;
};

const BUOYS: BuoyConfig[] = [
  {
    x: -2.5,
    z: 1.5,
    offset: 0.15,
    rotationSpeed: 2.2,
  },
  {
    x: 2.8,
    z: -1.8,
    offset: 0.15,
    rotationSpeed: 2.5,
  },
];

export default function OceanSimulation() {
  const meshRef = useRef<THREE.Mesh>(null);

  const buoy1Ref = useRef<THREE.Mesh>(null);
  const buoy2Ref = useRef<THREE.Mesh>(null);

  const elapsedRef = useRef(0);
  const accumulatorRef = useRef(0);
  const frameCounterRef = useRef(0);

  const lastPointerCellRef = useRef({
    x: -100,
    z: -100,
  });

  const {
    isPlaying = true,
    timeScale = 1,
    quality = 'low',
    fluidPreset = 'water',
    waveIntensity = 1,
    resetCounter = 0,
  } = useSimulationStore();

  const preset =
    FLUID_PRESETS[fluidPreset] || FLUID_PRESETS.water;

  // --------------------------------------------------
  // 1. QUALITY SETTINGS
  // --------------------------------------------------

  const gridSize =
    quality === 'low'
      ? 48
      : quality === 'medium'
        ? 64
        : 80;

  const vertexCount = gridSize * gridSize;

  // --------------------------------------------------
  // 2. WAVE BUFFERS
  // --------------------------------------------------

  const waveData = useMemo<WaveBuffers>(() => {
    const current = new Float32Array(vertexCount);
    const previous = new Float32Array(vertexCount);
    const next = new Float32Array(vertexCount);

    // Initial soft wave
    const center = Math.floor(gridSize / 2);

    for (let z = -5; z <= 5; z++) {
      for (let x = -5; x <= 5; x++) {
        const distanceSquared = x * x + z * z;

        const index =
          (center + z) * gridSize + (center + x);

        if (index >= 0 && index < vertexCount) {
          current[index] =
            0.45 * Math.exp(-distanceSquared / 8);
        }
      }
    }

    return {
      current,
      previous,
      next,
    };
  }, [gridSize, vertexCount, resetCounter]);

  // --------------------------------------------------
  // 3. GEOMETRY
  // --------------------------------------------------

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(
      OCEAN_SIZE,
      OCEAN_SIZE,
      gridSize - 1,
      gridSize - 1
    );

    geo.rotateX(-Math.PI / 2);

    const positions = geo.attributes.position as THREE.BufferAttribute;

    const colors = new Float32Array(vertexCount * 3);

    const baseColor = new THREE.Color(preset.color);

    const baseX = new Float32Array(vertexCount);
    const baseZ = new Float32Array(vertexCount);

    for (let i = 0; i < vertexCount; i++) {
      baseX[i] = positions.getX(i);
      baseZ[i] = positions.getZ(i);

      colors[i * 3] = baseColor.r;
      colors[i * 3 + 1] = baseColor.g;
      colors[i * 3 + 2] = baseColor.b;
    }

    geo.setAttribute(
      'color',
      new THREE.BufferAttribute(colors, 3)
    );

    geo.userData.baseX = baseX;
    geo.userData.baseZ = baseZ;

    return geo;
  }, [gridSize, vertexCount, preset.color]);

  // --------------------------------------------------
  // 4. COLORS
  // --------------------------------------------------

  const colors = useMemo(() => {
    return {
      base: new THREE.Color(preset.color),
      foam: new THREE.Color(preset.foamColor),
      temp: new THREE.Color(),
    };
  }, [preset.color, preset.foamColor]);

  // --------------------------------------------------
  // 5. RIPPLE DISTURBANCE
  // --------------------------------------------------

  const createRippleAtPoint = (
    point: THREE.Vector3,
    strength = 0.7
  ) => {
    const half = OCEAN_SIZE / 2;

    const gx = Math.round(
      ((point.x + half) / OCEAN_SIZE) * (gridSize - 1)
    );

    const gz = Math.round(
      ((point.z + half) / OCEAN_SIZE) * (gridSize - 1)
    );

    const intensity = THREE.MathUtils.clamp(
      waveIntensity,
      0,
      2.5
    );

    const radius = RIPPLE_RADIUS;

    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = gx + dx;
        const nz = gz + dz;

        if (
          nx <= 0 ||
          nx >= gridSize - 1 ||
          nz <= 0 ||
          nz >= gridSize - 1
        ) {
          continue;
        }

        const distanceSquared = dx * dx + dz * dz;

        if (distanceSquared > radius * radius) {
          continue;
        }

        const index = nz * gridSize + nx;

        const falloff = Math.exp(
          -distanceSquared / 5
        );

        const impulse = strength * intensity * falloff;

        waveData.current[index] += impulse;
      }
    }
  };

  // --------------------------------------------------
  // 6. POINTER INTERACTION
  // --------------------------------------------------

  const getLocalPoint = (
    event: ThreeEvent<PointerEvent>
  ) => {
    if (!meshRef.current) return null;

    const point = event.point.clone();

    meshRef.current.worldToLocal(point);

    return point;
  };

  const handlePointerMove = (
    event: ThreeEvent<PointerEvent>
  ) => {
    const point = getLocalPoint(event);

    if (!point) return;

    const half = OCEAN_SIZE / 2;

    const gx = Math.round(
      ((point.x + half) / OCEAN_SIZE) * (gridSize - 1)
    );

    const gz = Math.round(
      ((point.z + half) / OCEAN_SIZE) * (gridSize - 1)
    );

    const last = lastPointerCellRef.current;

    const dx = gx - last.x;
    const dz = gz - last.z;

    // Avoid too many disturbances from pointer movement
    if (dx * dx + dz * dz < 4) return;

    lastPointerCellRef.current = {
      x: gx,
      z: gz,
    };

    createRippleAtPoint(point, 0.16);
  };

  const handlePointerDown = (
    event: ThreeEvent<PointerEvent>
  ) => {
    event.stopPropagation();

    const point = getLocalPoint(event);

    if (!point) return;

    createRippleAtPoint(point, 0.85);
  };

  // --------------------------------------------------
  // 7. WAVE PHYSICS SOLVER
  // --------------------------------------------------

  const simulateWaveStep = () => {
    const { current, previous, next } = waveData;

    const damping = WAVE_DAMPING;
    const speed = WAVE_SPEED;

    for (let z = 1; z < gridSize - 1; z++) {
      const row = z * gridSize;

      for (let x = 1; x < gridSize - 1; x++) {
        const i = row + x;

        const center = current[i];

        const laplacian =
          current[i - 1] +
          current[i + 1] +
          current[i - gridSize] +
          current[i + gridSize] -
          4 * center;

        const velocity = center - previous[i];

        next[i] =
          2 * center -
          previous[i] +
          speed * laplacian -
          damping * velocity;
      }
    }

    // Fixed boundaries
    for (let x = 0; x < gridSize; x++) {
      next[x] = 0;
      next[(gridSize - 1) * gridSize + x] = 0;
    }

    for (let z = 0; z < gridSize; z++) {
      next[z * gridSize] = 0;
      next[z * gridSize + gridSize - 1] = 0;
    }

    // Buffer rotation
    waveData.previous = current;
    waveData.current = next;
    waveData.next = previous;
  };

  // --------------------------------------------------
  // 8. BUOY HEIGHT SAMPLING
  // --------------------------------------------------

  const sampleWaveHeight = (
    worldX: number,
    worldZ: number,
    elapsed: number
  ) => {
    const half = OCEAN_SIZE / 2;

    const gx = THREE.MathUtils.clamp(
      ((worldX + half) / OCEAN_SIZE) * (gridSize - 1),
      0,
      gridSize - 1
    );

    const gz = THREE.MathUtils.clamp(
      ((worldZ + half) / OCEAN_SIZE) * (gridSize - 1),
      0,
      gridSize - 1
    );

    const x0 = Math.floor(gx);
    const z0 = Math.floor(gz);

    const x1 = Math.min(x0 + 1, gridSize - 1);
    const z1 = Math.min(z0 + 1, gridSize - 1);

    const tx = gx - x0;
    const tz = gz - z0;

    const current = waveData.current;

    const h00 = current[z0 * gridSize + x0];
    const h10 = current[z0 * gridSize + x1];
    const h01 = current[z1 * gridSize + x0];
    const h11 = current[z1 * gridSize + x1];

    const h0 = THREE.MathUtils.lerp(h00, h10, tx);
    const h1 = THREE.MathUtils.lerp(h01, h11, tx);

    const ripple = THREE.MathUtils.lerp(h0, h1, tz);

    const ambient =
      (
        Math.sin(worldX * 0.6 + elapsed * 1.5) * 0.16 +
        Math.cos(worldZ * 0.5 + elapsed * 1.2) * 0.13
      ) * waveIntensity;

    return BASE_HEIGHT + ripple + ambient;
  };

  // --------------------------------------------------
  // 9. BUOY UPDATE
  // --------------------------------------------------

  const updateBuoy = (
    mesh: THREE.Mesh | null,
    config: BuoyConfig,
    elapsed: number
  ) => {
    if (!mesh) return;

    const surfaceHeight = sampleWaveHeight(
      config.x,
      config.z,
      elapsed
    );

    mesh.position.set(
      config.x,
      surfaceHeight + config.offset,
      config.z
    );

    mesh.rotation.z =
      Math.sin(elapsed * config.rotationSpeed) * 0.12;

    mesh.rotation.x =
      Math.cos(elapsed * config.rotationSpeed * 0.8) * 0.1;
  };

  // --------------------------------------------------
  // 10. MAIN RENDER LOOP
  // --------------------------------------------------

  useFrame((state, delta) => {
    if (!isPlaying) return;

    const safeTimeScale = THREE.MathUtils.clamp(
      timeScale,
      0.1,
      2
    );

    const frameDelta = Math.min(delta, 0.05);

    elapsedRef.current += frameDelta * safeTimeScale;

    // Fixed timestep accumulator
    accumulatorRef.current +=
      frameDelta * safeTimeScale;

    let steps = 0;

    while (
      accumulatorRef.current >= FIXED_STEP &&
      steps < MAX_SUBSTEPS
    ) {
      simulateWaveStep();

      accumulatorRef.current -= FIXED_STEP;

      steps++;
    }

    // Prevent excessive catch-up work
    if (steps === MAX_SUBSTEPS) {
      accumulatorRef.current = Math.min(
        accumulatorRef.current,
        FIXED_STEP
      );
    }

    const elapsed = elapsedRef.current;

    const positions =
      geometry.attributes.position.array as Float32Array;

    const vertexColors =
      geometry.attributes.color.array as Float32Array;

    const baseX = geometry.userData.baseX as Float32Array;
    const baseZ = geometry.userData.baseZ as Float32Array;

    const current = waveData.current;

    const intensity = waveIntensity;

    // Update surface vertices
    for (let i = 0; i < vertexCount; i++) {
      const x = baseX[i];
      const z = baseZ[i];

      const ripple = current[i];

      // Ambient ocean swell
      const ambient =
        (
          Math.sin(x * 0.6 + elapsed * 1.5) * 0.16 +
          Math.cos(z * 0.5 + elapsed * 1.2) * 0.13
        ) * intensity;

      const finalHeight =
        BASE_HEIGHT + ripple + ambient;

      positions[i * 3 + 1] = finalHeight;

      // Foam shading
      const crest = THREE.MathUtils.clamp(
        (finalHeight - BASE_HEIGHT - 0.02) * 1.8,
        0,
        0.85
      );

      colors.temp.lerpColors(
        colors.base,
        colors.foam,
        crest
      );

      const colorIndex = i * 3;

      vertexColors[colorIndex] = colors.temp.r;
      vertexColors[colorIndex + 1] = colors.temp.g;
      vertexColors[colorIndex + 2] = colors.temp.b;
    }

    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;

    // Recalculate normals every second frame
    frameCounterRef.current++;

    if (frameCounterRef.current % 2 === 0) {
      geometry.computeVertexNormals();
    }

    // Floating objects
    updateBuoy(buoy1Ref.current, BUOYS[0], elapsed);
    updateBuoy(buoy2Ref.current, BUOYS[1], elapsed);
  });

  // --------------------------------------------------
  // 11. RENDER
  // --------------------------------------------------

  return (
    <group>
      {/* Ocean Surface */}
      <mesh
        ref={meshRef}
        geometry={geometry}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
      >
        <meshStandardMaterial
          vertexColors
          roughness={preset.roughness}
          metalness={preset.metalness}
          emissive={preset.emissive}
          emissiveIntensity={
            fluidPreset === 'lava' ? 0.45 : 0
          }
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Floating Buoy 1 */}
      <mesh
        ref={buoy1Ref}
        position={[-2.5, BASE_HEIGHT, 1.5]}
      >
        <sphereGeometry args={[0.4, 16, 12]} />

        <meshStandardMaterial
          color="#f43f5e"
          roughness={0.3}
          metalness={0.35}
        />
      </mesh>

      {/* Floating Buoy 2 */}
      <mesh
        ref={buoy2Ref}
        position={[2.8, BASE_HEIGHT, -1.8]}
      >
        <boxGeometry args={[0.65, 0.65, 0.65]} />

        <meshStandardMaterial
          color="#facc15"
          roughness={0.3}
          metalness={0.3}
        />
      </mesh>
    </group>
  );
}
