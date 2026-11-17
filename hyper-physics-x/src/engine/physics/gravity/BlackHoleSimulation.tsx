
'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulationStore } from '@/store/useSimulationStore';


const AccretionShaderMaterial = {
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vPos;
    void main() {
      vUv = uv;
      vPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform float uLensing;
    varying vec2 vUv;

    void main() {
      vec2 centered = vUv * 2.0 - 1.0;
      float r = length(centered);
      float angle = atan(centered.y, centered.x);


      if (r < 0.24 || r > 0.98) discard;

     
      float spiral = sin(angle * 5.0 - r * 18.0 + uTime * 4.5);
      float bands = cos(r * 35.0 - uTime * 6.0) * 0.5 + 0.5;
      float intensity = smoothstep(0.24, 0.38, r) * (1.0 - smoothstep(0.55, 0.98, r));
      intensity *= (0.65 + 0.35 * spiral * bands) * uLensing;

      
      vec3 innerColor = vec3(1.0, 0.92, 0.8);
      vec3 midColor = vec3(0.98, 0.45, 0.08);
      vec3 outerColor = vec3(0.55, 0.15, 0.85);

      vec3 col = mix(innerColor, midColor, smoothstep(0.25, 0.55, r));
      col = mix(col, outerColor, smoothstep(0.55, 0.92, r));

      gl_FragColor = vec4(col * intensity * 1.8, clamp(intensity, 0.0, 0.92));
    }
  `,
};

export default function BlackHoleSimulation() {
  const pointsRef = useRef<THREE.Points>(null);
  const bh1Ref = useRef<THREE.Group>(null);
  const bh2Ref = useRef<THREE.Group>(null);
  const shaderRef1 = useRef<THREE.ShaderMaterial>(null);
  const shaderRef2 = useRef<THREE.ShaderMaterial>(null);

  const {
    isPlaying,
    timeScale,
    quality,
    blackHoleMass,
    lensingIntensity,
    binarySystem,
    resetCounter,
  } = useSimulationStore();

  const { pointer, viewport } = useThree();

  // PC Load অনুযায়ী অরবিটাল স্টার/পার্টিকেল সংখ্যা
  const starCount = quality === 'low' ? 2500 : quality === 'medium' ? 6000 : 12000;

  // পার্টিকেল অরবিটাল বাফার ইনিশিয়ালাইজেশন
  const particleData = useMemo(() => {
    const positions = new Float32Array(starCount * 3);
    const velocities = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    const colorNear = new THREE.Color('#f97316');
    const colorMid = new THREE.Color('#38bdf8');
    const colorFar = new THREE.Color('#a855f7');
    const tempColor = new THREE.Color();

    const spawnParticle = (i: number, minR = 1.4, maxR = 9.5) => {
      const r = minR + Math.random() * (maxR - minR);
      const theta = Math.random() * Math.PI * 2;
      const ySpread = (Math.random() - 0.5) * 0.45 * (r / maxR);

      const x = Math.cos(theta) * r;
      const y = 3.0 + ySpread;
      const z = Math.sin(theta) * r;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // নিউটনিয়ান অরবিটাল ভেলোসিটি v = sqrt(GM / r)
      const speed = Math.sqrt(18.0 / r) * (0.92 + Math.random() * 0.15);
      velocities[i * 3] = -Math.sin(theta) * speed;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.2;
      velocities[i * 3 + 2] = Math.cos(theta) * speed;

      const t = (r - minR) / (maxR - minR);
      if (t < 0.4) {
        tempColor.lerpColors(colorNear, colorMid, t / 0.4);
      } else {
        tempColor.lerpColors(colorMid, colorFar, (t - 0.4) / 0.6);
      }

      colors[i * 3] = tempColor.r;
      colors[i * 3 + 1] = tempColor.g;
      colors[i * 3 + 2] = tempColor.b;
    };

    for (let i = 0; i < starCount; i++) {
      spawnParticle(i);
    }

    return { positions, velocities, colors, spawnParticle };
  }, [starCount, resetCounter]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uLensing: { value: lensingIntensity },
    }),
    []
  );

  useFrame((state, delta) => {
    if (!isPlaying) return;

    const dt = Math.min(delta, 0.02) * timeScale;
    const elapsed = state.clock.elapsedTime;

    if (shaderRef1.current) {
      shaderRef1.current.uniforms.uTime.value = elapsed;
      shaderRef1.current.uniforms.uLensing.value = lensingIntensity;
    }
    if (shaderRef2.current) {
      shaderRef2.current.uniforms.uTime.value = elapsed;
      shaderRef2.current.uniforms.uLensing.value = lensingIntensity;
    }

    // ব্ল্যাক হোল পজিশন নির্ধারণ (সিঙ্গেল অথবা বাইনারি অরবিট)
    let bh1X = 0,
      bh1Y = 3.0,
      bh1Z = 0;
    let bh2X = 0,
      bh2Y = 3.0,
      bh2Z = 0;

    if (binarySystem) {
      const orbitRadius = 2.4;
      const orbitAngle = elapsed * 0.9 * timeScale;
      bh1X = Math.cos(orbitAngle) * orbitRadius;
      bh1Z = Math.sin(orbitAngle) * orbitRadius;
      bh2X = -bh1X;
      bh2Z = -bh1Z;
    }

    if (bh1Ref.current) bh1Ref.current.position.set(bh1X, bh1Y, bh1Z);
    if (bh2Ref.current) bh2Ref.current.position.set(bh2X, bh2Y, bh2Z);

    // মাউস গ্র্যাভিটি অ্যাট্রাক্টর (ক্লিক না করেও মাউস নাড়ালে মহাকর্ষীয় টান তৈরি হবে)
    const mouseX = (pointer.x * viewport.width) / 2;
    const mouseY = Math.max(0.5, (pointer.y * viewport.height) / 2 + 3.0);

    const { positions, velocities, spawnParticle } = particleData;
    const eventHorizonSq = 0.65 * 0.65;

    for (let i = 0; i < starCount; i++) {
      const idx = i * 3;
      const px = positions[idx];
      const py = positions[idx + 1];
      const pz = positions[idx + 2];

      // প্রাইমারি ব্ল্যাক হোলের গ্র্যাভিটি
      const dx1 = bh1X - px;
      const dy1 = bh1Y - py;
      const dz1 = bh1Z - pz;
      const distSq1 = dx1 * dx1 + dy1 * dy1 + dz1 * dz1;

      // ইভেন্ট হরাইজনে ঢুকে গেলে আবার আউটার অরবিটে রিস্পন করা (Particle Capture)
      if (distSq1 < eventHorizonSq) {
        spawnParticle(i, 6.5, 9.8);
        continue;
      }

      const dist1 = Math.sqrt(distSq1);
      const force1 = (blackHoleMass / (distSq1 + 0.15)) * dt;
      velocities[idx] += (dx1 / dist1) * force1;
      velocities[idx + 1] += (dy1 / dist1) * force1;
      velocities[idx + 2] += (dz1 / dist1) * force1;

    
      if (binarySystem) {
        const dx2 = bh2X - px;
        const dy2 = bh2Y - py;
        const dz2 = bh2Z - pz;
        const distSq2 = dx2 * dx2 + dy2 * dy2 + dz2 * dz2;

        if (distSq2 < eventHorizonSq) {
          spawnParticle(i, 6.5, 9.8);
          continue;
        }

        const dist2 = Math.sqrt(distSq2);
        const force2 = ((blackHoleMass * 0.85) / (distSq2 + 0.15)) * dt;
        velocities[idx] += (dx2 / dist2) * force2;
        velocities[idx + 1] += (dy2 / dist2) * force2;
        velocities[idx + 2] += (dz2 / dist2) * force2;
      }

      // মাউসের হালকা মহাকর্ষীয় প্রভাব
      const dxM = mouseX - px;
      const dyM = mouseY - py;
      const distSqM = dxM * dxM + dyM * dyM + pz * pz;
      if (distSqM < 6.0 && distSqM > 0.1) {
        const fM = (3.5 / distSqM) * dt;
        velocities[idx] += dxM * fM;
        velocities[idx + 1] += dyM * fM;
      }

      // সামান্য স্পাইরাল ড্র্যাগ যাতে পার্টিকেলগুলো ধীরে ধীরে ভেতরের দিকে পেঁচিয়ে ঢোকে
      velocities[idx] *= 0.9992;
      velocities[idx + 1] *= 0.995;
      velocities[idx + 2] *= 0.9992;

      positions[idx] += velocities[idx] * dt;
      positions[idx + 1] += velocities[idx + 1] * dt;
      positions[idx + 2] += velocities[idx + 2] * dt;

      // বেশি দূরে ছিটকে গেলে রিস্পন
      if (distSq1 > 160) {
        spawnParticle(i, 4.0, 8.5);
      }
    }

    if (pointsRef.current) {
      const posAttr = pointsRef.current.geometry.getAttribute(
        'position'
      ) as THREE.BufferAttribute;
      posAttr.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* প্রাইমারি ব্ল্যাক হোল */}
      <group ref={bh1Ref} position={[0, 3.0, 0]}>
        {/* Event Horizon (কৃষ্ণগহ্বর কোর) */}
        <mesh>
          <sphereGeometry args={[0.62, 32, 32]} />
          <meshBasicMaterial color="#000000" />
        </mesh>

        {/* Photon Ring / Gravitational Lensing Halo */}
        <mesh>
          <sphereGeometry args={[0.76 * Math.max(0.8, lensingIntensity * 0.85), 32, 32]} />
          <meshBasicMaterial
            color="#c084fc"
            transparent
            opacity={0.22 * lensingIntensity}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>

        {/* Relativistic Accretion Disk Shader */}
        <mesh rotation={[Math.PI / 2.15, 0, 0]}>
          <planeGeometry args={[5.2, 5.2]} />
          <shaderMaterial
            ref={shaderRef1}
            vertexShader={AccretionShaderMaterial.vertexShader}
            fragmentShader={AccretionShaderMaterial.fragmentShader}
            uniforms={uniforms}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>

      {/* সেকেন্ডারি ব্ল্যাক হোল (Binary Mode চালু থাকলে) */}
      {binarySystem && (
        <group ref={bh2Ref} position={[2.4, 3.0, 0]}>
          <mesh>
            <sphereGeometry args={[0.52, 28, 28]} />
            <meshBasicMaterial color="#000000" />
          </mesh>
          <mesh rotation={[-Math.PI / 2.2, 0, 0]}>
            <planeGeometry args={[4.2, 4.2]} />
            <shaderMaterial
              ref={shaderRef2}
              vertexShader={AccretionShaderMaterial.vertexShader}
              fragmentShader={AccretionShaderMaterial.fragmentShader}
              uniforms={uniforms}
              transparent
              depthWrite={false}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>
      )}

      {/* অরবিটাল স্টার ও প্লাজমা পার্টিকেল ভর্টেক্স */}
      <points ref={pointsRef} key={starCount}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={starCount}
            array={particleData.positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={starCount}
            array={particleData.colors}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.08}
          vertexColors
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  );
}