
'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  useSimulationStore,
  FLUID_PRESETS,
  CLOTH_PRESETS,
} from '@/store/useSimulationStore';

interface Constraint {
  p1: number;
  p2: number;
  restDist: number;
  active: boolean;
}

export default function UnifiedSimulation() {
  const fluidMeshRef = useRef<THREE.InstancedMesh>(null);
  const clothMeshRef = useRef<THREE.Mesh>(null);
  const lastStepRef = useRef(0);

  const {
    isPlaying = true,
    timeScale = 1.0,
    gravity = 9.81,
    quality = 'low',
    fluidPreset = 'water',
    clothPreset = 'silk',
    windStrength = 2.5,
    blackHoleMass = 18.0,
    unifiedSingularity = false,
    clothWetnessFactor = 1.5,
    stepTrigger = 0,
    resetCounter = 0,
  } = useSimulationStore();

  const { pointer, viewport } = useThree();
  const fPreset = FLUID_PRESETS[fluidPreset] || FLUID_PRESETS.water;
  const cPreset = CLOTH_PRESETS[clothPreset] || CLOTH_PRESETS.silk;

  // PC Load অনুযায়ী অপটিমাইজড পার্টিকেল ও ক্লথ গ্রিড
  const numFluid = quality === 'low' ? 450 : quality === 'medium' ? 900 : 1600;
  const segments = quality === 'low' ? 18 : quality === 'medium' ? 24 : 30;
  const clothSize = 6.0;

  const dummy = useMemo(() => new THREE.Object3D(), []);

  // কাপড় (Horizontal Safety Net / Trampoline) এবং ফ্লুইড বাফার ইনিশিয়ালাইজেশন
  const simData = useMemo(() => {
    const cols = segments + 1;
    const numClothNodes = cols * cols;

    const cPos = new Float32Array(numClothNodes * 3);
    const cPrev = new Float32Array(numClothNodes * 3);
    const cPinned = new Uint8Array(numClothNodes);
    const cWetness = new Float32Array(numClothNodes);

    const stepDist = clothSize / segments;

    for (let z = 0; z < cols; z++) {
      for (let x = 0; x < cols; x++) {
        const i = z * cols + x;
        const px = (x / segments - 0.5) * clothSize;
        const py = 2.6;
        const pz = (z / segments - 0.5) * clothSize;

        cPos[i * 3] = px;
        cPos[i * 3 + 1] = py;
        cPos[i * 3 + 2] = pz;

        cPrev[i * 3] = px;
        cPrev[i * 3 + 1] = py;
        cPrev[i * 3 + 2] = pz;

        // চার কোণা এবং বর্ডারের কিছু পয়েন্ট পিন করে ট্রামপোলিনের মতো ঝুলিয়ে রাখা
        const isEdgeX = x === 0 || x === segments;
        const isEdgeZ = z === 0 || z === segments;
        if ((isEdgeX && z % 3 === 0) || (isEdgeZ && x % 3 === 0)) {
          cPinned[i] = 1;
        }
      }
    }

    const constraints: Constraint[] = [];
    const edgeMap = new Set<string>();
    const addC = (a: number, b: number, d: number) => {
      constraints.push({ p1: a, p2: b, restDist: d, active: true });
      edgeMap.add(a < b ? `${a}_${b}` : `${b}_${a}`);
    };

    for (let z = 0; z < cols; z++) {
      for (let x = 0; x < cols; x++) {
        const i = z * cols + x;
        if (x < segments) addC(i, i + 1, stepDist);
        if (z < segments) addC(i, i + cols, stepDist);
      }
    }

    // ফ্লুইড পার্টিকেল বাফার (উপর থেকে ফোয়ারার মতো কাপড়ের ওপর পড়বে)
    const fPos = new Float32Array(numFluid * 3);
    const fVel = new Float32Array(numFluid * 3);

    const respawnDrop = (i: number, randomHeight = false) => {
      const angle = Math.random() * Math.PI * 2;
      const rad = Math.random() * 1.4;
      fPos[i * 3] = Math.cos(angle) * rad;
      fPos[i * 3 + 1] = randomHeight ? 3.2 + Math.random() * 4.5 : 6.2 + Math.random() * 1.2;
      fPos[i * 3 + 2] = Math.sin(angle) * rad;

      fVel[i * 3] = (Math.random() - 0.5) * 0.6;
      fVel[i * 3 + 1] = -0.5 - Math.random();
      fVel[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
    };

    for (let i = 0; i < numFluid; i++) {
      respawnDrop(i, true);
    }

    return {
      cols,
      numClothNodes,
      stepDist,
      cPos,
      cPrev,
      cPinned,
      cWetness,
      constraints,
      edgeMap,
      fPos,
      fVel,
      respawnDrop,
    };
  }, [segments, numFluid, resetCounter]);

  const rebuildClothIndices = (geo: THREE.BufferGeometry) => {
    const { cols, edgeMap } = simData;
    const indices: number[] = [];
    const hasEdge = (a: number, b: number) =>
      edgeMap.has(a < b ? `${a}_${b}` : `${b}_${a}`);

    for (let z = 0; z < segments; z++) {
      for (let x = 0; x < segments; x++) {
        const i00 = z * cols + x;
        const i10 = i00 + 1;
        const i01 = (z + 1) * cols + x;
        const i11 = i01 + 1;

        if (hasEdge(i00, i10) && hasEdge(i00, i01)) indices.push(i00, i01, i10);
        if (hasEdge(i10, i11) && hasEdge(i01, i11)) indices.push(i10, i01, i11);
      }
    }
    geo.setIndex(indices);
  };

  const clothGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(simData.cPos, 3));
    rebuildClothIndices(geo);
    geo.computeVertexNormals();
    return geo;
  }, [simData]);

  useFrame((state, delta) => {
    const shouldStep = stepTrigger !== lastStepRef.current;
    if (shouldStep) lastStepRef.current = stepTrigger;

    if (!isPlaying && !shouldStep) return;

    const dt = Math.min(delta, 0.018) * (shouldStep ? 0.6 : timeScale);
    const {
      cols,
      numClothNodes,
      stepDist,
      cPos,
      cPrev,
      cPinned,
      cWetness,
      constraints,
      edgeMap,
      fPos,
      fVel,
      respawnDrop,
    } = simData;

    const bhX = 0,
      bhY = 4.6,
      bhZ = 0;
    const mouseX = ((pointer.x || 0) * (viewport.width || 10)) / 2;
    const mouseY = Math.max(0.5, ((pointer.y || 0) * (viewport.height || 10)) / 2 + 2.5);

    // ১. কাপড়ের ফিজিক্স আপডেট (Gravity + Wetness Mass + Wind + Singularity Pull)
    for (let i = 0; i < numClothNodes; i++) {
      if (cPinned[i]) continue;
      const idx = i * 3;
      const px = cPos[idx];
      const py = cPos[idx + 1];
      const pz = cPos[idx + 2];

      const vx = (px - cPrev[idx]) * cPreset.damping;
      const vy = (py - cPrev[idx + 1]) * cPreset.damping;
      const vz = (pz - cPrev[idx + 2]) * cPreset.damping;

      cPrev[idx] = px;
      cPrev[idx + 1] = py;
      cPrev[idx + 2] = pz;

      // কাপড় ভিজলে তার ওজন বাড়ে (FR-12 Fluid + Cloth Wetness)
      const wetMultiplier = 1.0 + cWetness[i] * clothWetnessFactor;
      cWetness[i] = Math.max(0, cWetness[i] - dt * 0.15); // ধীরে ধীরে শুকানো

      let fx = Math.sin(state.clock.elapsedTime * 2.0 + px) * windStrength * 0.15;
      let fy = -gravity * wetMultiplier;
      let fz = Math.cos(state.clock.elapsedTime * 1.5 + pz) * windStrength * 0.15;

      // ব্ল্যাক হোল গ্র্যাভিটি চালু থাকলে কাপড়ের ভার্টেক্সকে উপরের দিকে টানবে
      if (unifiedSingularity) {
        const dx = bhX - px;
        const dy = bhY - py;
        const dz = bhZ - pz;
        const dSq = dx * dx + dy * dy + dz * dz + 0.4;
        const f = (blackHoleMass * 1.2) / dSq;
        fx += dx * f;
        fy += dy * f;
        fz += dz * f;
      }

      cPos[idx] = px + vx + fx * dt * dt;
      cPos[idx + 1] = Math.max(0.05, py + vy + fy * dt * dt);
      cPos[idx + 2] = pz + vz + fz * dt * dt;
    }

    // ২. ফ্লুইড পার্টিকেল আপডেট এবং কাপড়ের সাথে রিয়েল-টাইম কলিশন (Fluid <-> Cloth Coupling)
    const halfSize = clothSize * 0.5;
    for (let i = 0; i < numFluid; i++) {
      const idx = i * 3;
      let px = fPos[idx];
      let py = fPos[idx + 1];
      let pz = fPos[idx + 2];

      fVel[idx + 1] -= gravity * dt;

      // ব্ল্যাক হোল সিঙ্গুলারিটি চালু থাকলে ফ্লুইড পার্টিকেল স্পাইরাল হয়ে ব্ল্যাক হোলে ঢুকবে
      if (unifiedSingularity) {
        const dx = bhX - px;
        const dy = bhY - py;
        const dz = bhZ - pz;
        const dSq = dx * dx + dy * dy + dz * dz + 0.15;
        if (dSq < 0.35) {
          respawnDrop(i, false);
          continue;
        }
        const f = (blackHoleMass / dSq) * dt;
        fVel[idx] += dx * f - dz * 0.8 * dt;
        fVel[idx + 1] += dy * f;
        fVel[idx + 2] += dz * f + dx * 0.8 * dt;
      }

      // মাউস ইন্টারেকশন
      const dxM = px - mouseX;
      const dyM = py - mouseY;
      const dSqM = dxM * dxM + dyM * dyM + pz * pz;
      if (dSqM < 1.8 && dSqM > 0.01) {
        fVel[idx] += dxM * 12 * dt;
        fVel[idx + 1] += dyM * 12 * dt;
      }

      px += fVel[idx] * dt;
      py += fVel[idx + 1] * dt;
      pz += fVel[idx + 2] * dt;

      // কাপড়ের গ্রিড সেলের সাথে ফ্লুইড পার্টিকেলের কলিশন চেক
      if (Math.abs(px) < halfSize && Math.abs(pz) < halfSize) {
        const gx = Math.round(((px + halfSize) / clothSize) * segments);
        const gz = Math.round(((pz + halfSize) / clothSize) * segments);

        if (gx >= 0 && gx <= segments && gz >= 0 && gz <= segments) {
          const cIdx = gz * cols + gx;
          const cy = cPos[cIdx * 3 + 1];

          // ওই পয়েন্টের কাপড় ছিঁড়ে গেছে কি না চেক করা
          const hasSupport =
            simData.edgeMap.has(`${cIdx}_${cIdx + 1}`) ||
            simData.edgeMap.has(`${cIdx - 1}_${cIdx}`);

          if (hasSupport && py < cy + 0.16 && py > cy - 0.35 && fVel[idx + 1] < 0) {
            // পার্টিকেল কাপড়ের ওপর বাউন্স করবে এবং কাপড়কে নিচের দিকে ধাক্কা দেবে
            py = cy + 0.16;
            fVel[idx + 1] *= -0.35;
            fVel[idx] += (Math.random() - 0.5) * 1.5;
            fVel[idx + 2] += (Math.random() - 0.5) * 1.5;

            if (!cPinned[cIdx]) {
              cPos[cIdx * 3 + 1] -= 0.035 * fPreset.restDensity;
              cWetness[cIdx] = Math.min(3.0, cWetness[cIdx] + 0.35);
            }
          }
        }
      }

      // মেঝেতে পড়লে আবার উপর থেকে ফোয়ারার মতো রিস্পন হওয়া
      if (py < 0.1 || py > 10 || Math.abs(px) > 7 || Math.abs(pz) > 7) {
        respawnDrop(i, false);
      } else {
        fPos[idx] = px;
        fPos[idx + 1] = py;
        fPos[idx + 2] = pz;
      }

      if (fluidMeshRef.current) {
        dummy.position.set(fPos[idx], fPos[idx + 1], fPos[idx + 2]);
        dummy.updateMatrix();
        fluidMeshRef.current.setMatrixAt(i, dummy.matrix);
      }
    }

    // ৩. কাপড়ের কনস্ট্রেইন্ট সলভার এবং পানির ভারে ছিঁড়ে যাওয়া (Tearing)
    let torn = false;
    const maxTear = stepDist * cPreset.tearThreshold;

    for (let iter = 0; iter < 4; iter++) {
      for (let i = 0; i < constraints.length; i++) {
        const c = constraints[i];
        if (!c.active) continue;

        const i1 = c.p1 * 3;
        const i2 = c.p2 * 3;
        const dx = cPos[i2] - cPos[i1];
        const dy = cPos[i2 + 1] - cPos[i1 + 1];
        const dz = cPos[i2 + 2] - cPos[i1 + 2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist === 0) continue;

        if (dist > maxTear) {
          c.active = false;
          edgeMap.delete(c.p1 < c.p2 ? `${c.p1}_${c.p2}` : `${c.p2}_${c.p1}`);
          torn = true;
          continue;
        }

        const diff = ((dist - c.restDist) / dist) * 0.5 * cPreset.stiffness;
        const ox = dx * diff;
        const oy = dy * diff;
        const oz = dz * diff;

        if (!cPinned[c.p1]) {
          cPos[i1] += ox;
          cPos[i1 + 1] += oy;
          cPos[i1 + 2] += oz;
        }
        if (!cPinned[c.p2]) {
          cPos[i2] -= ox;
          cPos[i2 + 1] -= oy;
          cPos[i2 + 2] -= oz;
        }
      }
    }

    if (torn) rebuildClothIndices(clothGeometry);

    const posAttr = clothGeometry.getAttribute('position') as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
    clothGeometry.computeVertexNormals();

    if (fluidMeshRef.current) {
      fluidMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* ৪ কোণায় ৪টি সাপোর্ট পিলার */}
      {[
        [-3, 1.3, -3],
        [3, 1.3, -3],
        [-3, 1.3, 3],
        [3, 1.3, 3],
      ].map((pos, idx) => (
        <mesh key={idx} position={pos as [number, number, number]}>
          <cylinderGeometry args={[0.08, 0.08, 2.6, 12]} />
          <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}

      {/* কাপড়ের মেশ */}
      <mesh ref={clothMeshRef} geometry={clothGeometry}>
        <meshStandardMaterial
          color={cPreset.color}
          roughness={cPreset.roughness}
          metalness={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ফ্লুইড পার্টিকেলস */}
      <instancedMesh ref={fluidMeshRef} args={[undefined, undefined, numFluid]}>
        <sphereGeometry args={[0.13, 10, 10]} />
        <meshStandardMaterial
          color={fPreset.color}
          emissive={fPreset.emissive}
          emissiveIntensity={fluidPreset === 'lava' ? 0.8 : 0}
          roughness={fPreset.roughness}
          metalness={fPreset.metalness}
        />
      </instancedMesh>

      {/* অপশনাল গ্র্যাভিটি সিঙ্গুলারিটি (ব্ল্যাক হোল) */}
      {unifiedSingularity && (
        <group position={[0, 4.6, 0]}>
          <mesh>
            <sphereGeometry args={[0.5, 24, 24]} />
            <meshBasicMaterial color="#000000" />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.85, 0.08, 16, 48]} />
            <meshBasicMaterial color="#a855f7" />
          </mesh>
        </group>
      )}
    </group>
  );
}