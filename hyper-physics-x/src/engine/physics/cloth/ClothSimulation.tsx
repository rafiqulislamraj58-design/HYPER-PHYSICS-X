// src/engine/physics/cloth/ClothSimulation.tsx
'use client';

import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulationStore, CLOTH_PRESETS } from '@/store/useSimulationStore';

interface Constraint {
  p1: number;
  p2: number;
  restDist: number;
  active: boolean;
}

export default function ClothSimulation({
  onInteractChange,
}: {
  onInteractChange?: (interacting: boolean) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const {
    isPlaying,
    timeScale,
    gravity,
    quality,
    clothPreset,
    clothTool,
    windStrength,
    resetCounter,
  } = useSimulationStore();

  const preset = CLOTH_PRESETS[clothPreset];

  // PC Load অনুযায়ী কাপড়ের গ্রিড রেজোলিউশন নির্ধারণ
  const segments = quality === 'low' ? 24 : quality === 'medium' ? 32 : 42;
  const width = 7;
  const height = 5.5;

  const [draggedVertex, setDraggedVertex] = useState<number | null>(null);
  const isPointerDown = useRef(false);

  // 
  const clothData = useMemo(() => {
    const cols = segments + 1;
    const rows = segments + 1;
    const numParticles = cols * rows;

    const positions = new Float32Array(numParticles * 3);
    const prevPositions = new Float32Array(numParticles * 3);
    const pinned = new Uint8Array(numParticles);
    const uvs = new Float32Array(numParticles * 2);

    const restDx = width / segments;
    const restDy = height / segments;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const px = (x / segments - 0.5) * width;
        const py = 6.2 - (y / segments) * height;
        const pz = (Math.sin(x * 0.4) * 0.05); // 

        positions[i * 3] = px;
        positions[i * 3 + 1] = py;
        positions[i * 3 + 2] = pz;

        prevPositions[i * 3] = px;
        prevPositions[i * 3 + 1] = py;
        prevPositions[i * 3 + 2] = pz;

        uvs[i * 2] = x / segments;
        uvs[i * 2 + 1] = 1 - y / segments;

        // 
        if (y === 0 && (x % 3 === 0 || x === segments)) {
          pinned[i] = 1;
        }
      }
    }

    // Structural & Shear Constraints
    const constraints: Constraint[] = [];
    const edgeMap = new Set<string>();

    const addConstraint = (a: number, b: number, dist: number) => {
      constraints.push({ p1: a, p2: b, restDist: dist, active: true });
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      edgeMap.add(key);
    };

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        if (x < segments) addConstraint(i, i + 1, restDx);
        if (y < segments) addConstraint(i, i + cols, restDy);
      }
    }

    return {
      cols,
      rows,
      numParticles,
      positions,
      prevPositions,
      pinned,
      uvs,
      constraints,
      edgeMap,
      restDx,
    };
  }, [segments, resetCounter]);

  // (Triangles) 
  const rebuildIndices = (geometry: THREE.BufferGeometry) => {
    const { cols, edgeMap } = clothData;
    const indices: number[] = [];

    const hasEdge = (a: number, b: number) => {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      return edgeMap.has(key);
    };

    for (let y = 0; y < segments; y++) {
      for (let x = 0; x < segments; x++) {
        const i00 = y * cols + x;
        const i10 = i00 + 1;
        const i01 = (y + 1) * cols + x;
        const i11 = i01 + 1;

        const top = hasEdge(i00, i10);
        const left = hasEdge(i00, i01);
        const right = hasEdge(i10, i11);
        const bottom = hasEdge(i01, i11);

        if (top && left) indices.push(i00, i01, i10);
        if (right && bottom) indices.push(i10, i01, i11);
      }
    }

    geometry.setIndex(indices);
  };

  // 
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(clothData.positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(clothData.uvs, 2));
    rebuildIndices(geo);
    geo.computeVertexNormals();
    return geo;
  }, [clothData]);

  useEffect(() => {
    const handleUp = () => {
      isPointerDown.current = false;
      setDraggedVertex(null);
      onInteractChange?.(false);
    };
    window.addEventListener('pointerup', handleUp);
    return () => window.removeEventListener('pointerup', handleUp);
  }, [onInteractChange]);

  // 
  const findClosestVertex = (point: THREE.Vector3, maxRadius = 0.5) => {
    const { positions, numParticles } = clothData;
    let bestIdx = -1;
    let minDistSq = maxRadius * maxRadius;

    for (let i = 0; i < numParticles; i++) {
      const dx = positions[i * 3] - point.x;
      const dy = positions[i * 3 + 1] - point.y;
      const dz = positions[i * 3 + 2] - point.z;
      const dSq = dx * dx + dy * dy + dz * dz;
      if (dSq < minDistSq) {
        minDistSq = dSq;
        bestIdx = i;
      }
    }
    return bestIdx;
  };

  //
  const cutClothAtPoint = (point: THREE.Vector3, radius = 0.38) => {
    const { positions, constraints, edgeMap } = clothData;
    let tornAny = false;
    const rSq = radius * radius;

    for (let i = 0; i < constraints.length; i++) {
      const c = constraints[i];
      if (!c.active) continue;

      const mx = (positions[c.p1 * 3] + positions[c.p2 * 3]) * 0.5;
      const my = (positions[c.p1 * 3 + 1] + positions[c.p2 * 3 + 1]) * 0.5;
      const mz = (positions[c.p1 * 3 + 2] + positions[c.p2 * 3 + 2]) * 0.5;

      const dx = mx - point.x;
      const dy = my - point.y;
      const dz = mz - point.z;

      if (dx * dx + dy * dy + dz * dz < rSq) {
        c.active = false;
        const key = c.p1 < c.p2 ? `${c.p1}_${c.p2}` : `${c.p2}_${c.p1}`;
        edgeMap.delete(key);
        tornAny = true;
      }
    }

    if (tornAny) {
      rebuildIndices(geometry);
    }
  };

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    isPointerDown.current = true;
    onInteractChange?.(true);

    if (clothTool === 'cut') {
      cutClothAtPoint(e.point);
    } else if (clothTool === 'pin') {
      const idx = findClosestVertex(e.point, 0.5);
      if (idx !== -1) {
        clothData.pinned[idx] = clothData.pinned[idx] ? 0 : 1;
      }
    } else {
      const idx = findClosestVertex(e.point, 0.65);
      if (idx !== -1) {
        setDraggedVertex(idx);
      }
    }
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isPointerDown.current) return;
    e.stopPropagation();

    if (clothTool === 'cut') {
      cutClothAtPoint(e.point);
    } else if (clothTool === 'grab' && draggedVertex !== null) {
      const { positions, prevPositions } = clothData;
      positions[draggedVertex * 3] = e.point.x;
      positions[draggedVertex * 3 + 1] = e.point.y;
      positions[draggedVertex * 3 + 2] = e.point.z;

      prevPositions[draggedVertex * 3] = e.point.x;
      prevPositions[draggedVertex * 3 + 1] = e.point.y;
      prevPositions[draggedVertex * 3 + 2] = e.point.z;
    }
  };

  //  (Verlet + Constraint Relaxation)
  useFrame((state, delta) => {
    if (!isPlaying) return;

    const dt = Math.min(delta, 0.018) * timeScale;
    const { numParticles, positions, prevPositions, pinned, constraints, edgeMap } = clothData;
    const damping = preset.damping;
    const time = state.clock.elapsedTime;

    // ১. Verlet Integration + Gravity + Wind Turbulence
    for (let i = 0; i < numParticles; i++) {
      if (pinned[i] || i === draggedVertex) continue;

      const idx = i * 3;
      const px = positions[idx];
      const py = positions[idx + 1];
      const pz = positions[idx + 2];

      const vx = (px - prevPositions[idx]) * damping;
      const vy = (py - prevPositions[idx + 1]) * damping;
      const vz = (pz - prevPositions[idx + 2]) * damping;

      prevPositions[idx] = px;
      prevPositions[idx + 1] = py;
      prevPositions[idx + 2] = pz;

      // (Wind Wave)
      const windWave =
        Math.sin(time * 2.5 + px * 0.6 + py * 0.4) * windStrength +
        Math.cos(time * 1.3 + py * 0.8) * (windStrength * 0.4);

      positions[idx] = px + vx + windWave * 0.25 * dt * dt;
      positions[idx + 1] = py + vy - gravity * dt * dt;
      positions[idx + 2] = pz + vz + windWave * dt * dt;

      //  (Floor Collision)
      if (positions[idx + 1] < 0.05) {
        positions[idx + 1] = 0.05;
      }
    }

    // ২. PBD Constraint Solving & Automatic Strain Tearing
    const iterations = quality === 'low' ? 4 : 6;
    const stiffness = preset.stiffness;
    const maxTearDist = clothData.restDx * preset.tearThreshold;
    let meshTorn = false;

    for (let iter = 0; iter < iterations; iter++) {
      for (let i = 0; i < constraints.length; i++) {
        const c = constraints[i];
        if (!c.active) continue;

        const i1 = c.p1 * 3;
        const i2 = c.p2 * 3;

        const dx = positions[i2] - positions[i1];
        const dy = positions[i2 + 1] - positions[i1 + 1];
        const dz = positions[i2 + 2] - positions[i1 + 2];

        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist === 0) continue;

        // (Constraint Tearing)
        if (dist > maxTearDist) {
          c.active = false;
          const key = c.p1 < c.p2 ? `${c.p1}_${c.p2}` : `${c.p2}_${c.p1}`;
          edgeMap.delete(key);
          meshTorn = true;
          continue;
        }

        const diff = ((dist - c.restDist) / dist) * 0.5 * stiffness;
        const ox = dx * diff;
        const oy = dy * diff;
        const oz = dz * diff;

        const pin1 = pinned[c.p1] || c.p1 === draggedVertex;
        const pin2 = pinned[c.p2] || c.p2 === draggedVertex;

        if (!pin1 && !pin2) {
          positions[i1] += ox;
          positions[i1 + 1] += oy;
          positions[i1 + 2] += oz;
          positions[i2] -= ox;
          positions[i2 + 1] -= oy;
          positions[i2 + 2] -= oz;
        } else if (!pin1) {
          positions[i1] += ox * 2;
          positions[i1 + 1] += oy * 2;
          positions[i1 + 2] += oz * 2;
        } else if (!pin2) {
          positions[i2] -= ox * 2;
          positions[i2 + 1] -= oy * 2;
          positions[i2 + 2] -= oz * 2;
        }
      }
    }

    if (meshTorn) {
      rebuildIndices(geometry);
    }

    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();
  });

  return (
    <group>
      
      <mesh position={[0, 6.25, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, width + 0.6, 16]} />
        <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
      </mesh>

      <mesh
        ref={meshRef}
        geometry={geometry}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
      >
        <meshStandardMaterial
          color={preset.color}
          roughness={preset.roughness}
          metalness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}