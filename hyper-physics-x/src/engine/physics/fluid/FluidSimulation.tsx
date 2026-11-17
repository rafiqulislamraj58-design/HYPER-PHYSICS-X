// src/engine/physics/fluid/FluidSimulation.tsx
'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulationStore, FLUID_PRESETS } from '@/store/useSimulationStore';

const BOUNDS = { x: 4.5, y: 6.0, z: 3.0 };
const PARTICLE_RADIUS = 0.14;
const INTERACTION_RADIUS = 0.36;
const OBSTACLE_RADIUS = 1.05;

export default function FluidSimulation() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const obstacleRef = useRef<THREE.Mesh>(null);

  const {
    isPlaying = true,
    timeScale = 1.0,
    gravity = 9.81,
    particleCount = 1200,
    fluidPreset = 'water',
    fluidTool = 'push',
    fluidEmitter = false,
    fluidObstacle = true,
    viscosity = 0.12,
    resetCounter = 0,
  } = useSimulationStore();

  const { pointer, viewport } = useThree();
  const preset = FLUID_PRESETS[fluidPreset] || FLUID_PRESETS.water;

  const baseColor = useMemo(() => new THREE.Color(preset.color), [preset.color]);
  const foamColor = useMemo(() => new THREE.Color(preset.foamColor), [preset.foamColor]);
  const tempColor = useMemo(() => new THREE.Color(), []);

  const buffers = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);

    const cols = Math.ceil(Math.cbrt(particleCount));
    const spacing = PARTICLE_RADIUS * 2.05;

    for (let i = 0; i < particleCount; i++) {
      const ix = i % cols;
      const iy = Math.floor(i / (cols * cols));
      const iz = Math.floor((i / cols) % cols);

      positions[i * 3] = -BOUNDS.x * 0.65 + ix * spacing + (Math.random() - 0.5) * 0.02;
      positions[i * 3 + 1] = 0.5 + iy * spacing;
      positions[i * 3 + 2] = -BOUNDS.z * 0.5 + iz * spacing + (Math.random() - 0.5) * 0.02;

      velocities[i * 3] = 0;
      velocities[i * 3 + 1] = 0;
      velocities[i * 3 + 2] = 0;
    }

    return { positions, velocities };
  }, [particleCount, resetCounter]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const spatialGrid = useMemo(() => new Map<number, number[]>(), []);
  const emitterCursor = useRef(0);

  useEffect(() => {
    if (!meshRef.current) return;
    const { positions } = buffers;
    for (let i = 0; i < particleCount; i++) {
      dummy.position.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      meshRef.current.setColorAt(i, baseColor);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [buffers, particleCount, dummy, baseColor]);

  useFrame((state, delta) => {
    if (!isPlaying || !meshRef.current) return;

    const dt = Math.min(delta, 0.02) * timeScale;
    const { positions, velocities } = buffers;
    const elapsed = state.clock.elapsedTime;

    // মাউস পজিশন
    const mouseX = ((pointer.x || 0) * (viewport.width || 10)) / 2;
    const mouseY = Math.max(0.4, ((pointer.y || 0) * (viewport.height || 10)) / 2 + 2.5);

    // কন্টিনিউয়াস ওয়াটার ফাউন্টেন / জেট স্ট্রিম (Fluid Emitter)
    if (fluidEmitter) {
      for (let s = 0; s < 6; s++) {
        const idx = (emitterCursor.current % particleCount) * 3;
        emitterCursor.current++;
        positions[idx] = -BOUNDS.x + 0.4;
        positions[idx + 1] = BOUNDS.y - 0.8 + (Math.random() - 0.5) * 0.25;
        positions[idx + 2] = (Math.random() - 0.5) * 0.6;

        velocities[idx] = 6.5 + Math.random() * 1.5;
        velocities[idx + 1] = 1.0 + (Math.random() - 0.5) * 0.5;
        velocities[idx + 2] = (Math.random() - 0.5) * 1.2;
      }
    }

    // মুভিং 3D Obstacle Sphere পজিশন
    const obsX = Math.sin(elapsed * 1.2 * timeScale) * 1.8;
    const obsY = 1.3;
    const obsZ = 0;
    if (obstacleRef.current) {
      obstacleRef.current.position.set(obsX, obsY, obsZ);
    }

    // ১. Spatial Grid & External Forces
    spatialGrid.clear();
    const cellSize = INTERACTION_RADIUS;

    for (let i = 0; i < particleCount; i++) {
      const idx = i * 3;
      velocities[idx + 1] -= gravity * dt;

      // মাউস ফোর্স মোড: Push / Whirlpool Vortex / Anti-Gravity Attract
      const dxM = positions[idx] - mouseX;
      const dyM = positions[idx + 1] - mouseY;
      const dzM = positions[idx + 2];
      const distSqM = dxM * dxM + dyM * dyM + dzM * dzM;

      if (distSqM < 3.2 && distSqM > 0.0001) {
        const distM = Math.sqrt(distSqM);
        const falloff = 1.0 - distM / 1.8;

        if (fluidTool === 'push') {
          const pushForce = falloff * 22.0 * dt;
          velocities[idx] += (dxM / distM) * pushForce;
          velocities[idx + 1] += (dyM / distM) * pushForce;
          velocities[idx + 2] += (dzM / distM) * pushForce;
        } else if (fluidTool === 'vortex') {
          // ঘূর্ণিপাক (Whirlpool Swirl around cursor)
          const swirlForce = falloff * 26.0 * dt;
          velocities[idx] += (-dyM / distM - (dxM / distM) * 0.35) * swirlForce;
          velocities[idx + 1] += (dxM / distM - (dyM / distM) * 0.2) * swirlForce;
          velocities[idx + 2] += Math.sin(elapsed * 5 + i) * 3.0 * dt;
        } else if (fluidTool === 'attract') {
          // চৌম্বকীয় বা অ্যান্টি-গ্র্যাভিটি ওয়াটার বল
          const pullForce = falloff * 24.0 * dt;
          velocities[idx] -= (dxM / distM) * pullForce;
          velocities[idx + 1] -= (dyM / distM) * pullForce;
          velocities[idx + 2] -= (dzM / distM) * pullForce;
        }
      }

      positions[idx] += velocities[idx] * dt;
      positions[idx + 1] += velocities[idx + 1] * dt;
      positions[idx + 2] += velocities[idx + 2] * dt;

      const gx = Math.floor(positions[idx] / cellSize);
      const gy = Math.floor(positions[idx + 1] / cellSize);
      const gz = Math.floor(positions[idx + 2] / cellSize);
      const hash = (gx * 73856093) ^ (gy * 19349663) ^ (gz * 83492791);

      let cell = spatialGrid.get(hash);
      if (!cell) {
        cell = [];
        spatialGrid.set(hash, cell);
      }
      cell.push(i);
    }

    // ২. SPH Pressure & Viscosity Solver
    const minRadiusSq = INTERACTION_RADIUS * INTERACTION_RADIUS;
    const stiffness = preset.stiffness;
    const minObsDist = OBSTACLE_RADIUS + PARTICLE_RADIUS;
    const minObsDistSq = minObsDist * minObsDist;

    for (let i = 0; i < particleCount; i++) {
      const idxA = i * 3;
      const px = positions[idxA];
      const py = positions[idxA + 1];
      const pz = positions[idxA + 2];

      const gx = Math.floor(px / cellSize);
      const gy = Math.floor(py / cellSize);
      const gz = Math.floor(pz / cellSize);

      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          for (let oz = -1; oz <= 1; oz++) {
            const hash =
              ((gx + ox) * 73856093) ^
              ((gy + oy) * 19349663) ^
              ((gz + oz) * 83492791);
            const cell = spatialGrid.get(hash);
            if (!cell) continue;

            for (let k = 0; k < cell.length; k++) {
              const j = cell[k];
              if (j <= i) continue;

              const idxB = j * 3;
              const dx = px - positions[idxB];
              const dy = py - positions[idxB + 1];
              const dz = pz - positions[idxB + 2];
              const distSq = dx * dx + dy * dy + dz * dz;

              if (distSq < minRadiusSq && distSq > 0.00001) {
                const dist = Math.sqrt(distSq);
                const overlap = (INTERACTION_RADIUS - dist) * 0.5 * stiffness;
                const nx = dx / dist;
                const ny = dy / dist;
                const nz = dz / dist;

                positions[idxA] += nx * overlap;
                positions[idxA + 1] += ny * overlap;
                positions[idxA + 2] += nz * overlap;

                positions[idxB] -= nx * overlap;
                positions[idxB + 1] -= ny * overlap;
                positions[idxB + 2] -= nz * overlap;

                const vxDiff = velocities[idxA] - velocities[idxB];
                const vyDiff = velocities[idxA + 1] - velocities[idxB + 1];
                const vzDiff = velocities[idxA + 2] - velocities[idxB + 2];

                const viscFactor = viscosity * 0.12;
                velocities[idxA] -= vxDiff * viscFactor;
                velocities[idxA + 1] -= vyDiff * viscFactor;
                velocities[idxA + 2] -= vzDiff * viscFactor;

                velocities[idxB] += vxDiff * viscFactor;
                velocities[idxB + 1] += vyDiff * viscFactor;
                velocities[idxB + 2] += vzDiff * viscFactor;
              }
            }
          }
        }
      }

      // ৩. 3D Obstacle Sphere Collision (FR-02 Fluid-to-Object Collision)
      if (fluidObstacle) {
        const odx = positions[idxA] - obsX;
        const ody = positions[idxA + 1] - obsY;
        const odz = positions[idxA + 2] - obsZ;
        const oDistSq = odx * odx + ody * ody + odz * odz;

        if (oDistSq < minObsDistSq && oDistSq > 0.0001) {
          const oDist = Math.sqrt(oDistSq);
          const onx = odx / oDist;
          const ony = ody / oDist;
          const onz = odz / oDist;
          const pushOut = minObsDist - oDist;

          positions[idxA] += onx * pushOut;
          positions[idxA + 1] += ony * pushOut;
          positions[idxA + 2] += onz * pushOut;

          // বলের গায়ে ধাক্কা লেগে ছিটকে যাওয়া
          velocities[idxA] += onx * 2.5;
          velocities[idxA + 1] += ony * 2.5;
          velocities[idxA + 2] += onz * 2.5;
        }
      }

      // ৪. ট্যাংক বাউন্ডারি কলিশন
      const damping = 0.45;
      if (positions[idxA] < -BOUNDS.x) {
        positions[idxA] = -BOUNDS.x;
        velocities[idxA] *= -damping;
      } else if (positions[idxA] > BOUNDS.x) {
        positions[idxA] = BOUNDS.x;
        velocities[idxA] *= -damping;
      }

      if (positions[idxA + 1] < PARTICLE_RADIUS) {
        positions[idxA + 1] = PARTICLE_RADIUS;
        velocities[idxA + 1] *= -damping;
        velocities[idxA] *= 0.96;
        velocities[idxA + 2] *= 0.96;
      } else if (positions[idxA + 1] > BOUNDS.y) {
        positions[idxA + 1] = BOUNDS.y;
        velocities[idxA + 1] *= -damping;
      }

      if (positions[idxA + 2] < -BOUNDS.z) {
        positions[idxA + 2] = -BOUNDS.z;
        velocities[idxA + 2] *= -damping;
      } else if (positions[idxA + 2] > BOUNDS.z) {
        positions[idxA + 2] = BOUNDS.z;
        velocities[idxA + 2] *= -damping;
      }

      // ৫. ডায়নামিক ফেনা ও স্প্ল্যাশ কালারিং (Velocity-based Foam Crest)
      const speedSq =
        velocities[idxA] * velocities[idxA] +
        velocities[idxA + 1] * velocities[idxA + 1] +
        velocities[idxA + 2] * velocities[idxA + 2];
      const foamMix = Math.min(1.0, speedSq / 32.0);
      tempColor.lerpColors(baseColor, foamColor, foamMix);

      dummy.position.set(positions[idxA], positions[idxA + 1], positions[idxA + 2]);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      meshRef.current.setColorAt(i, tempColor);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      {/* Glass Tank Container */}
      <mesh position={[0, BOUNDS.y / 2, 0]}>
        <boxGeometry args={[BOUNDS.x * 2 + 0.3, BOUNDS.y, BOUNDS.z * 2 + 0.3]} />
        <meshPhysicalMaterial
          color="#38bdf8"
          transparent
          opacity={0.1}
          roughness={0.1}
          transmission={0.6}
          side={THREE.BackSide}
        />
      </mesh>

      <lineSegments position={[0, BOUNDS.y / 2, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(BOUNDS.x * 2 + 0.3, BOUNDS.y, BOUNDS.z * 2 + 0.3)]} />
        <lineBasicMaterial color="#1e293b" />
      </lineSegments>

      {/* Interactive 3D Collider Sphere inside Tank */}
      {fluidObstacle && (
        <mesh ref={obstacleRef} position={[0, 1.3, 0]}>
          <sphereGeometry args={[OBSTACLE_RADIUS, 32, 32]} />
          <meshStandardMaterial color="#f43f5e" roughness={0.2} metalness={0.8} />
        </mesh>
      )}

      {/* Fluid Particles with Dynamic Foam Coloring */}
      <instancedMesh ref={meshRef} args={[undefined, undefined, particleCount]}>
        <sphereGeometry args={[PARTICLE_RADIUS, 10, 10]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={preset.emissive}
          emissiveIntensity={fluidPreset === 'lava' ? 0.8 : 0}
          roughness={preset.roughness}
          metalness={preset.metalness}
        />
      </instancedMesh>
    </group>
  );
}