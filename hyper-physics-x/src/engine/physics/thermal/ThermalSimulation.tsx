
'use client';

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { useThermalStore } from '@/store/useThermalStore';

import {
  ELEMENT_DATABASE,
} from '@/data/elements/ElementDatabase';

import {
  calculateThermalState,
} from './ThermalSolver';

const PARTICLE_COUNT = 160;

export default function ThermalSimulation() {
  const meshRef = useRef<THREE.Mesh>(null);
  const particleRef = useRef<THREE.Points>(null);

  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const particleMaterialRef = useRef<THREE.PointsMaterial>(null);

  const {
    selectedElement,
    temperature,
    isPlaying,
    showParticles,
  } = useThermalStore();

  const element =
    ELEMENT_DATABASE[selectedElement] ||
    ELEMENT_DATABASE.water;

  const thermal = useMemo(
    () => calculateThermalState(element, temperature),
    [element, temperature]
  );

  const particleGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();

    const positions = new Float32Array(
      PARTICLE_COUNT * 3
    );

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 1.5;
      positions[i * 3 + 1] = Math.random() * 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
    }

    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3)
    );

    return geometry;
  }, []);

  const particleSpeeds = useMemo(() => {
    const speeds = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      speeds[i] = 0.3 + Math.random() * 0.8;
    }

    return speeds;
  }, []);

  useFrame((state, delta) => {
    if (!isPlaying) return;

    const dt = Math.min(delta, 0.04);
    const elapsed = state.clock.elapsedTime;

    const mesh = meshRef.current;

    if (mesh) {
      mesh.rotation.y += dt * 0.25;

      const targetScale = thermal.expansion;

      mesh.scale.lerp(
        new THREE.Vector3(
          targetScale,
          targetScale,
          targetScale
        ),
        1 - Math.exp(-dt * 5)
      );

      if (thermal.phase === 'liquid') {
        mesh.position.y =
          0.15 + Math.sin(elapsed * 2) * 0.025;
      } else {
        mesh.position.y = 0.15;
      }

      if (thermal.phase === 'gas') {
        mesh.visible = false;
      } else {
        mesh.visible = true;
      }
    }

    if (materialRef.current) {
      materialRef.current.color.copy(thermal.color);
      materialRef.current.emissive.copy(thermal.emissive);

      materialRef.current.emissiveIntensity =
        thermal.emissiveIntensity;
    }

    const particles = particleRef.current;

    if (particles) {
      const visible =
        thermal.phase === 'gas' && showParticles;

      particles.visible = visible;

      if (visible) {
        const position = particleGeometry.attributes
          .position as THREE.BufferAttribute;

        const array = position.array as Float32Array;

        const temperatureFactor = THREE.MathUtils.clamp(
          (temperature - element.boilingPoint) / 500,
          0.2,
          3
        );

        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const yIndex = i * 3 + 1;

          array[yIndex] +=
            dt * particleSpeeds[i] * temperatureFactor;

          array[i * 3] +=
            Math.sin(elapsed + i) * dt * 0.08;

          if (array[yIndex] > 3.5) {
            array[yIndex] = 0.25;
            array[i * 3] =
              (Math.random() - 0.5) * 1.5;
          }
        }

        position.needsUpdate = true;

        particleGeometry.computeBoundingSphere();
      }
    }

    if (particleMaterialRef.current) {
      particleMaterialRef.current.color.set(
        element.gasColor
      );
    }
  });

  const isGas = thermal.phase === 'gas';

  return (
    <group position={[0, 0, 0]}>
      {/* Main material object */}
      {!isGas && (
        <mesh
          ref={meshRef}
          position={[0, 0.15, 0]}
          castShadow
          receiveShadow
        >
          {selectedElement === 'water' ||
          selectedElement === 'mercury' ||
          selectedElement === 'lava' ? (
            <sphereGeometry args={[0.9, 32, 24]} />
          ) : (
            <boxGeometry args={[1.3, 1.3, 1.3, 4, 4, 4]} />
          )}

          <meshStandardMaterial
            ref={materialRef}
            color={thermal.color}
            emissive={thermal.emissive}
            emissiveIntensity={thermal.emissiveIntensity}
            roughness={
              selectedElement === 'mercury' ? 0.12 : 0.45
            }
            metalness={
              element.category === 'Metal' ? 0.8 : 0.05
            }
          />
        </mesh>
      )}

      {/* Gas / Vapor particles */}
      <points
        ref={particleRef}
        geometry={particleGeometry}
        visible={isGas && showParticles}
      >
        <pointsMaterial
          ref={particleMaterialRef}
          color={element.gasColor}
          size={0.075}
          transparent
          opacity={0.65}
          depthWrite={false}
          sizeAttenuation
        />
      </points>

      {/* Ground shadow */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -1.1, 0]}
      >
        <circleGeometry args={[2.2, 32]} />

        <meshStandardMaterial
          color="#242b38"
          roughness={0.9}
        />
      </mesh>
    </group>
  );
}
