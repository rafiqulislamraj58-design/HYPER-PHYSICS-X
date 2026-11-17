// src/components/viewport/Viewport3D.tsx
'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  useSimulationStore,
  FLUID_PRESETS,
  CLOTH_PRESETS,
} from '@/store/useSimulationStore';

export default function Viewport3D() {
  const mountRef = useRef<HTMLDivElement>(null);
  const { activeLab = 'fluid', clothTool = 'grab', fluidTool = 'push' } = useSimulationStore();

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // =========================================================================
    // 1. PURE THREE.JS CORE SETUP (Scene, Camera, Renderer, Lights, Controls)
    // =========================================================================
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#020617');
    scene.fog = new THREE.FogExp2('#020617', 0.025);

    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 6.2, 13.0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 2.2, 0);

    // High-Quality Studio Lighting
    const ambientLight = new THREE.AmbientLight('#ffffff', 0.65);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight('#ffffff', 2.2);
    dirLight.position.set(10, 18, 12);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const rimLight1 = new THREE.PointLight('#38bdf8', 3.5, 25);
    rimLight1.position.set(-8, 6, -6);
    scene.add(rimLight1);

    const rimLight2 = new THREE.PointLight('#ec4899', 2.5, 25);
    rimLight2.position.set(8, 5, 6);
    scene.add(rimLight2);

    // Laboratory Floor Grid
    const gridHelper = new THREE.GridHelper(28, 28, '#334155', '#1e293b');
    scene.add(gridHelper);

    // Lab Scene Root Group
    const labGroup = new THREE.Group();
    scene.add(labGroup);

    // Raycaster & Mouse Tracking in 3D Space
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(-10, -10);
    const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const mouseWorld = new THREE.Vector3(0, -100, 0);
    let isPointerDown = false;
    let draggedClothIdx = -1;

    let disposables: { dispose: () => void }[] = [];
    const clearLabGroup = () => {
      while (labGroup.children.length > 0) {
        labGroup.remove(labGroup.children[0]);
      }
      disposables.forEach((d) => d.dispose());
      disposables = [];
    };

    // =========================================================================
    // 2. MODULAR PURE THREE.JS PHYSICS ENGINES
    // =========================================================================
    let updateCurrentLab: (dt: number, elapsed: number) => void = () => {};
    let currentLabKey = '';

    const buildActiveLab = () => {
      clearLabGroup();
      const state = useSimulationStore.getState();
      const lab = state.activeLab;
      const quality = state.quality;
      const fPreset = FLUID_PRESETS[state.fluidPreset] || FLUID_PRESETS.water;
      const cPreset = CLOTH_PRESETS[state.clothPreset] || CLOTH_PRESETS.silk;

      currentLabKey = `${lab}_${quality}_${state.resetCounter}`;

      // -----------------------------------------------------------------------
      // LAB A: SPH 3D FLUID TANK
      // -----------------------------------------------------------------------
      if (lab === 'fluid') {
        const count = quality === 'low' ? 1400 : quality === 'medium' ? 3000 : 5500;
        const radius = 0.16;
        const interactionRad = 0.38;
        const bounds = { x: 4.4, y: 5.8, z: 2.8 };

        const tankGeo = new THREE.BoxGeometry(bounds.x * 2 + 0.35, bounds.y, bounds.z * 2 + 0.35);
        const tankMat = new THREE.MeshPhysicalMaterial({
          color: '#38bdf8',
          transparent: true,
          opacity: 0.12,
          roughness: 0.05,
          metalness: 0.1,
          reflectivity: 0.9,
          side: THREE.BackSide,
        });
        const tankMesh = new THREE.Mesh(tankGeo, tankMat);
        tankMesh.position.set(0, bounds.y / 2, 0);
        labGroup.add(tankMesh);

        const edgesGeo = new THREE.EdgesGeometry(tankGeo);
        const edgesMat = new THREE.LineBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.45 });
        const edgesMesh = new THREE.LineSegments(edgesGeo, edgesMat);
        edgesMesh.position.copy(tankMesh.position);
        labGroup.add(edgesMesh);

        const obsRadius = 1.05;
        const obsGeo = new THREE.SphereGeometry(obsRadius, 32, 32);
        const obsMat = new THREE.MeshStandardMaterial({
          color: '#f43f5e',
          roughness: 0.18,
          metalness: 0.85,
        });
        const obsMesh = new THREE.Mesh(obsGeo, obsMat);
        obsMesh.position.set(0, 1.3, 0);
        labGroup.add(obsMesh);

        const ringGeo = new THREE.RingGeometry(0.45, 0.55, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: '#38bdf8',
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.75,
        });
        const cursorRing = new THREE.Mesh(ringGeo, ringMat);
        labGroup.add(cursorRing);

        const partGeo = new THREE.SphereGeometry(radius, 16, 16);
        const partMat = new THREE.MeshPhysicalMaterial({
          color: '#ffffff',
          roughness: fPreset.roughness,
          metalness: fPreset.metalness,
          clearcoat: 1.0,
          clearcoatRoughness: 0.1,
          emissive: new THREE.Color(fPreset.emissive),
          emissiveIntensity: state.fluidPreset === 'lava' ? 0.85 : 0,
        });
        const instancedMesh = new THREE.InstancedMesh(partGeo, partMat, count);
        instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        labGroup.add(instancedMesh);

        disposables.push(tankGeo, tankMat, edgesGeo, edgesMat, obsGeo, obsMat, ringGeo, ringMat, partGeo, partMat);

        const pos = new Float32Array(count * 3);
        const vel = new Float32Array(count * 3);
        const cols = Math.ceil(Math.cbrt(count));
        const spacing = radius * 2.02;

        const baseColor = new THREE.Color(fPreset.color);
        const foamColor = new THREE.Color(fPreset.foamColor || '#ffffff');
        const tempColor = new THREE.Color();
        const dummy = new THREE.Object3D();

        for (let i = 0; i < count; i++) {
          const ix = i % cols;
          const iy = Math.floor(i / (cols * cols));
          const iz = Math.floor((i / cols) % cols);

          pos[i * 3] = -bounds.x * 0.65 + ix * spacing + (Math.random() - 0.5) * 0.02;
          pos[i * 3 + 1] = 0.4 + iy * spacing;
          pos[i * 3 + 2] = -bounds.z * 0.55 + iz * spacing + (Math.random() - 0.5) * 0.02;

          dummy.position.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
          dummy.updateMatrix();
          instancedMesh.setMatrixAt(i, dummy.matrix);
          instancedMesh.setColorAt(i, baseColor);
        }

        const spatialGrid = new Map<number, number[]>();
        let emitCursor = 0;

        updateCurrentLab = (dt, elapsed) => {
          const st = useSimulationStore.getState();
          const curPreset = FLUID_PRESETS[st.fluidPreset] || FLUID_PRESETS.water;
          baseColor.set(curPreset.color);
          foamColor.set(curPreset.foamColor || '#ffffff');
          partMat.roughness = curPreset.roughness;
          partMat.metalness = curPreset.metalness;
          partMat.emissive.set(curPreset.emissive);
          partMat.emissiveIntensity = st.fluidPreset === 'lava' ? 0.85 : 0;

          cursorRing.position.set(
            THREE.MathUtils.clamp(mouseWorld.x, -bounds.x, bounds.x),
            THREE.MathUtils.clamp(mouseWorld.y, 0.5, bounds.y),
            0
          );
          ringMat.color.set(
            st.fluidTool === 'vortex' ? '#f43f5e' : st.fluidTool === 'attract' ? '#a855f7' : '#38bdf8'
          );

          obsMesh.visible = st.fluidObstacle;
          const obsX = Math.sin(elapsed * 1.25) * 1.8;
          const obsY = 1.25;
          obsMesh.position.set(obsX, obsY, 0);

          if (st.fluidEmitter) {
            for (let s = 0; s < 6; s++) {
              const idx = (emitCursor % count) * 3;
              emitCursor++;
              pos[idx] = -bounds.x + 0.35;
              pos[idx + 1] = bounds.y - 0.8 + (Math.random() - 0.5) * 0.25;
              pos[idx + 2] = (Math.random() - 0.5) * 0.5;
              vel[idx] = 7.2 + Math.random() * 1.2;
              vel[idx + 1] = 0.8;
              vel[idx + 2] = (Math.random() - 0.5) * 1.2;
            }
          }

          spatialGrid.clear();
          for (let i = 0; i < count; i++) {
            const idx = i * 3;
            vel[idx + 1] -= st.gravity * dt;

            const dxM = pos[idx] - cursorRing.position.x;
            const dyM = pos[idx + 1] - cursorRing.position.y;
            const dzM = pos[idx + 2];
            const dSqM = dxM * dxM + dyM * dyM + dzM * dzM;

            if (dSqM < 3.0 && dSqM > 0.0001) {
              const dM = Math.sqrt(dSqM);
              const f = (1.0 - dM / 1.73) * dt;
              if (st.fluidTool === 'push') {
                vel[idx] += (dxM / dM) * 26 * f;
                vel[idx + 1] += (dyM / dM) * 26 * f;
                vel[idx + 2] += (dzM / dM) * 26 * f;
              } else if (st.fluidTool === 'vortex') {
                vel[idx] += (-dyM / dM - (dxM / dM) * 0.3) * 30 * f;
                vel[idx + 1] += (dxM / dM - (dyM / dM) * 0.2) * 30 * f;
              } else if (st.fluidTool === 'attract') {
                vel[idx] -= (dxM / dM) * 30 * f;
                vel[idx + 1] -= (dyM / dM) * 30 * f;
                vel[idx + 2] -= (dzM / dM) * 30 * f;
              }
            }

            pos[idx] += vel[idx] * dt;
            pos[idx + 1] += vel[idx + 1] * dt;
            pos[idx + 2] += vel[idx + 2] * dt;

            const gx = Math.floor(pos[idx] / interactionRad);
            const gy = Math.floor(pos[idx + 1] / interactionRad);
            const gz = Math.floor(pos[idx + 2] / interactionRad);
            const hash = (gx * 73856093) ^ (gy * 19349663) ^ (gz * 83492791);
            let cell = spatialGrid.get(hash);
            if (!cell) {
              cell = [];
              spatialGrid.set(hash, cell);
            }
            cell.push(i);
          }

          const minRadSq = interactionRad * interactionRad;
          const minObsDist = obsRadius + radius;

          for (let i = 0; i < count; i++) {
            const idxA = i * 3;
            const px = pos[idxA];
            const py = pos[idxA + 1];
            const pz = pos[idxA + 2];

            const gx = Math.floor(px / interactionRad);
            const gy = Math.floor(py / interactionRad);
            const gz = Math.floor(pz / interactionRad);

            for (let ox = -1; ox <= 1; ox++) {
              for (let oy = -1; oy <= 1; oy++) {
                for (let oz = -1; oz <= 1; oz++) {
                  const hash =
                    ((gx + ox) * 73856093) ^ ((gy + oy) * 19349663) ^ ((gz + oz) * 83492791);
                  const cell = spatialGrid.get(hash);
                  if (!cell) continue;

                  for (let k = 0; k < cell.length; k++) {
                    const j = cell[k];
                    if (j <= i) continue;
                    const idxB = j * 3;
                    const dx = px - pos[idxB];
                    const dy = py - pos[idxB + 1];
                    const dz = pz - pos[idxB + 2];
                    const dSq = dx * dx + dy * dy + dz * dz;

                    if (dSq < minRadSq && dSq > 0.00001) {
                      const d = Math.sqrt(dSq);
                      const overlap = (interactionRad - d) * 0.5 * curPreset.stiffness;
                      const nx = dx / d;
                      const ny = dy / d;
                      const nz = dz / d;

                      pos[idxA] += nx * overlap;
                      pos[idxA + 1] += ny * overlap;
                      pos[idxA + 2] += nz * overlap;
                      pos[idxB] -= nx * overlap;
                      pos[idxB + 1] -= ny * overlap;
                      pos[idxB + 2] -= nz * overlap;

                      const visc = st.viscosity * 0.14;
                      const vxD = (vel[idxA] - vel[idxB]) * visc;
                      const vyD = (vel[idxA + 1] - vel[idxB + 1]) * visc;
                      const vzD = (vel[idxA + 2] - vel[idxB + 2]) * visc;
                      vel[idxA] -= vxD;
                      vel[idxA + 1] -= vyD;
                      vel[idxA + 2] -= vzD;
                      vel[idxB] += vxD;
                      vel[idxB + 1] += vyD;
                      vel[idxB + 2] += vzD;
                    }
                  }
                }
              }
            }

            if (st.fluidObstacle) {
              const odx = pos[idxA] - obsX;
              const ody = pos[idxA + 1] - obsY;
              const odz = pos[idxA + 2];
              const oDistSq = odx * odx + ody * ody + odz * odz;
              if (oDistSq < minObsDist * minObsDist && oDistSq > 0.0001) {
                const oDist = Math.sqrt(oDistSq);
                const push = minObsDist - oDist;
                pos[idxA] += (odx / oDist) * push;
                pos[idxA + 1] += (ody / oDist) * push;
                pos[idxA + 2] += (odz / oDist) * push;
                vel[idxA] += (odx / oDist) * 2.2;
                vel[idxA + 1] += (ody / oDist) * 2.2;
              }
            }

            const damp = 0.45;
            if (pos[idxA] < -bounds.x) {
              pos[idxA] = -bounds.x;
              vel[idxA] *= -damp;
            } else if (pos[idxA] > bounds.x) {
              pos[idxA] = bounds.x;
              vel[idxA] *= -damp;
            }
            if (pos[idxA + 1] < radius) {
              pos[idxA + 1] = radius;
              vel[idxA + 1] *= -damp;
              vel[idxA] *= 0.96;
              vel[idxA + 2] *= 0.96;
            } else if (pos[idxA + 1] > bounds.y) {
              pos[idxA + 1] = bounds.y;
              vel[idxA + 1] *= -damp;
            }
            if (pos[idxA + 2] < -bounds.z) {
              pos[idxA + 2] = -bounds.z;
              vel[idxA + 2] *= -damp;
            } else if (pos[idxA + 2] > bounds.z) {
              pos[idxA + 2] = bounds.z;
              vel[idxA + 2] *= -damp;
            }

            const speedSq =
              vel[idxA] * vel[idxA] + vel[idxA + 1] * vel[idxA + 1] + vel[idxA + 2] * vel[idxA + 2];
            tempColor.lerpColors(baseColor, foamColor, Math.min(1.0, speedSq / 28.0));

            dummy.position.set(pos[idxA], pos[idxA + 1], pos[idxA + 2]);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);
            instancedMesh.setColorAt(i, tempColor);
          }

          instancedMesh.instanceMatrix.needsUpdate = true;
          if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
        };
      }

      // -----------------------------------------------------------------------
      // LAB B: 3D OCEAN
      // -----------------------------------------------------------------------
      else if (lab === 'ocean') {
        const poolSize = 11.0;
        const segs = quality === 'low' ? 72 : quality === 'medium' ? 110 : 140;

        const volGeo = new THREE.BoxGeometry(poolSize, 2.0, poolSize);
        const volMat = new THREE.MeshPhysicalMaterial({
          color: fPreset.color,
          transparent: true,
          opacity: 0.35,
          roughness: 0.15,
        });
        const volMesh = new THREE.Mesh(volGeo, volMat);
        volMesh.position.set(0, 1.0, 0);
        labGroup.add(volMesh);

        const edgesGeo = new THREE.EdgesGeometry(volGeo);
        const edgesMat = new THREE.LineBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.4 });
        const edgesMesh = new THREE.LineSegments(edgesGeo, edgesMat);
        edgesMesh.position.set(0, 1.0, 0);
        labGroup.add(edgesMesh);

        const surfGeo = new THREE.PlaneGeometry(poolSize, poolSize, segs, segs);
        surfGeo.rotateX(-Math.PI / 2);

        const ripples = Array.from({ length: 10 }, (_, i) =>
          i === 0 ? new THREE.Vector4(0, 0, 0, 1.4) : new THREE.Vector4(0, 0, -100, 0)
        );

        const surfMat = new THREE.ShaderMaterial({
          transparent: true,
          side: THREE.DoubleSide,
          uniforms: {
            uTime: { value: 0 },
            uIntensity: { value: state.waveIntensity },
            uBaseColor: { value: new THREE.Color(fPreset.color) },
            uFoamColor: { value: new THREE.Color(fPreset.foamColor || '#ffffff') },
            uDeepColor: { value: new THREE.Color(fPreset.color).multiplyScalar(0.3) },
            uRipples: { value: ripples },
          },
          vertexShader: `
            uniform float uTime;
            uniform float uIntensity;
            uniform vec4 uRipples[10];
            varying float vElevation;
            varying vec3 vNormal;
            varying vec3 vWorldPos;

            float waveH(vec2 p) {
              float h = (sin(p.x * 0.75 + uTime * 2.2) * 0.16 +
                         cos(p.y * 0.65 - uTime * 1.8) * 0.14 +
                         sin((p.x + p.y) * 0.9 + uTime * 2.8) * 0.08) * uIntensity;
              for(int i = 0; i < 10; i++) {
                vec4 r = uRipples[i];
                float age = uTime - r.z;
                if(age > 0.0 && age < 4.5 && r.w > 0.0) {
                  float d = distance(p, r.xy);
                  float front = age * 3.8;
                  float band = abs(d - front);
                  if(band < 1.8) {
                    float dec = exp(-age * 0.85) * (1.0 - band / 1.8);
                    h += sin((d - front) * 6.5) * r.w * dec * uIntensity * 0.45;
                  }
                }
              }
              return h;
            }

            void main() {
              vec3 pos = position;
              float h = waveH(pos.xz);
              float hx = waveH(pos.xz + vec2(0.15, 0.0));
              float hz = waveH(pos.xz + vec2(0.0, 0.15));
              vNormal = normalize(vec3(h - hx, 0.15, h - hz));
              pos.y += h;
              vElevation = h;
              vec4 wp = modelMatrix * vec4(pos, 1.0);
              vWorldPos = wp.xyz;
              gl_Position = projectionMatrix * viewMatrix * wp;
            }
          `,
          fragmentShader: `
            uniform vec3 uBaseColor;
            uniform vec3 uFoamColor;
            uniform vec3 uDeepColor;
            varying float vElevation;
            varying vec3 vNormal;
            varying vec3 vWorldPos;

            void main() {
              vec3 viewDir = normalize(cameraPosition - vWorldPos);
              float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.0);
              float t = clamp((vElevation + 0.35) / 0.7, 0.0, 1.0);
              vec3 col = mix(uDeepColor, uBaseColor, smoothstep(0.0, 0.65, t));
              col = mix(col, uFoamColor, smoothstep(0.6, 0.98, t));
              vec3 lightDir = normalize(vec3(10.0, 18.0, 12.0));
              float spec = pow(max(dot(vNormal, normalize(lightDir + viewDir)), 0.0), 48.0) * 0.75;
              gl_FragColor = vec4(col + uFoamColor * fresnel * 0.35 + vec3(spec), 0.92);
            }
          `,
        });

        const surfMesh = new THREE.Mesh(surfGeo, surfMat);
        surfMesh.position.set(0, 2.0, 0);
        labGroup.add(surfMesh);

        const buoy1Geo = new THREE.SphereGeometry(0.48, 32, 32);
        const buoy1Mat = new THREE.MeshStandardMaterial({ color: '#f43f5e', roughness: 0.2, metalness: 0.7 });
        const buoy1 = new THREE.Mesh(buoy1Geo, buoy1Mat);
        labGroup.add(buoy1);

        const buoy2Geo = new THREE.BoxGeometry(0.75, 0.75, 0.75);
        const buoy2Mat = new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.25, metalness: 0.6 });
        const buoy2 = new THREE.Mesh(buoy2Geo, buoy2Mat);
        labGroup.add(buoy2);

        disposables.push(volGeo, volMat, edgesGeo, edgesMat, surfGeo, surfMat, buoy1Geo, buoy1Mat, buoy2Geo, buoy2Mat);

        let rippleIdx = 0;
        let lastPointerX = 0;

        updateCurrentLab = (_, elapsed) => {
          const st = useSimulationStore.getState();
          const curP = FLUID_PRESETS[st.fluidPreset] || FLUID_PRESETS.water;

          surfMat.uniforms.uTime.value = elapsed;
          surfMat.uniforms.uIntensity.value = st.waveIntensity;
          surfMat.uniforms.uBaseColor.value.set(curP.color);
          surfMat.uniforms.uFoamColor.value.set(curP.foamColor || '#ffffff');
          surfMat.uniforms.uDeepColor.value.set(curP.color).multiplyScalar(0.3);
          volMat.color.set(curP.color);

          raycaster.setFromCamera(pointer, camera);
          const hits = raycaster.intersectObject(surfMesh);
          if (hits.length > 0 && Math.abs(pointer.x - lastPointerX) > 0.01) {
            lastPointerX = pointer.x;
            const pt = hits[0].point;
            ripples[rippleIdx % 10].set(pt.x, pt.z, elapsed, isPointerDown ? 1.7 : 0.6);
            rippleIdx++;
          }

          const evalH = (x: number, z: number) =>
            2.0 +
            (Math.sin(x * 0.75 + elapsed * 2.2) * 0.16 +
              Math.cos(z * 0.65 - elapsed * 1.8) * 0.14) *
              st.waveIntensity;

          buoy1.position.set(-2.4, evalH(-2.4, 1.5) + 0.1, 1.5);
          buoy1.rotation.z = Math.cos(elapsed * 2.4) * 0.25;

          buoy2.position.set(2.5, evalH(2.5, -1.6) + 0.1, -1.6);
          buoy2.rotation.x = Math.sin(elapsed * 2.1) * 0.25;
        };
      }

      // -----------------------------------------------------------------------
      // LAB C: CLOTH
      // -----------------------------------------------------------------------
      else if (lab === 'cloth') {
        const segs = quality === 'low' ? 24 : quality === 'medium' ? 32 : 40;
        const width = 7.0;
        const height = 5.5;
        const cols = segs + 1;
        const numPts = cols * cols;
        const restDx = width / segs;
        const restDy = height / segs;

        const rodGeo = new THREE.CylinderGeometry(0.07, 0.07, width + 0.6, 24);
        rodGeo.rotateZ(Math.PI / 2);
        const rodMat = new THREE.MeshStandardMaterial({ color: '#64748b', metalness: 0.85, roughness: 0.2 });
        const rodMesh = new THREE.Mesh(rodGeo, rodMat);
        rodMesh.position.set(0, 6.25, 0);
        labGroup.add(rodMesh);

        const pos = new Float32Array(numPts * 3);
        const prev = new Float32Array(numPts * 3);
        const pinned = new Uint8Array(numPts);

        for (let y = 0; y < cols; y++) {
          for (let x = 0; x < cols; x++) {
            const i = y * cols + x;
            const px = (x / segs - 0.5) * width;
            const py = 6.2 - (y / segs) * height;
            const pz = Math.sin(x * 0.4) * 0.05;
            pos[i * 3] = prev[i * 3] = px;
            pos[i * 3 + 1] = prev[i * 3 + 1] = py;
            pos[i * 3 + 2] = prev[i * 3 + 2] = pz;
            if (y === 0 && (x % 3 === 0 || x === segs)) pinned[i] = 1;
          }
        }

        const constraints: { p1: number; p2: number; rest: number; active: boolean }[] = [];
        const edgeMap = new Set<string>();
        const addEdge = (a: number, b: number, r: number) => {
          constraints.push({ p1: a, p2: b, rest: r, active: true });
          edgeMap.add(a < b ? `${a}_${b}` : `${b}_${a}`);
        };

        for (let y = 0; y < cols; y++) {
          for (let x = 0; x < cols; x++) {
            const i = y * cols + x;
            if (x < segs) addEdge(i, i + 1, restDx);
            if (y < segs) addEdge(i, i + cols, restDy);
          }
        }

        const clothGeo = new THREE.BufferGeometry();
        clothGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

        const rebuildIndices = () => {
          const indices: number[] = [];
          const has = (a: number, b: number) => edgeMap.has(a < b ? `${a}_${b}` : `${b}_${a}`);
          for (let y = 0; y < segs; y++) {
            for (let x = 0; x < segs; x++) {
              const i00 = y * cols + x;
              const i10 = i00 + 1;
              const i01 = (y + 1) * cols + x;
              const i11 = i01 + 1;
              if (has(i00, i10) && has(i00, i01)) indices.push(i00, i01, i10);
              if (has(i10, i11) && has(i01, i11)) indices.push(i10, i01, i11);
            }
          }
          clothGeo.setIndex(indices);
        };
        rebuildIndices();
        clothGeo.computeVertexNormals();

        const clothMat = new THREE.MeshStandardMaterial({
          color: cPreset.color,
          roughness: cPreset.roughness,
          metalness: 0.15,
          side: THREE.DoubleSide,
        });
        const clothMesh = new THREE.Mesh(clothGeo, clothMat);
        labGroup.add(clothMesh);

        disposables.push(rodGeo, rodMat, clothGeo, clothMat);

        updateCurrentLab = (dt, elapsed) => {
          const st = useSimulationStore.getState();
          const curC = CLOTH_PRESETS[st.clothPreset] || CLOTH_PRESETS.silk;
          clothMat.color.set(curC.color);
          clothMat.roughness = curC.roughness;

          if (isPointerDown) {
            if (st.clothTool === 'cut') {
              let cutAny = false;
              for (let i = 0; i < constraints.length; i++) {
                const c = constraints[i];
                if (!c.active) continue;
                const mx = (pos[c.p1 * 3] + pos[c.p2 * 3]) * 0.5;
                const my = (pos[c.p1 * 3 + 1] + pos[c.p2 * 3 + 1]) * 0.5;
                if (Math.hypot(mx - mouseWorld.x, my - mouseWorld.y) < 0.42) {
                  c.active = false;
                  edgeMap.delete(c.p1 < c.p2 ? `${c.p1}_${c.p2}` : `${c.p2}_${c.p1}`);
                  cutAny = true;
                }
              }
              if (cutAny) rebuildIndices();
            } else if (st.clothTool === 'grab') {
              if (draggedClothIdx === -1) {
                let bestD = 0.75;
                for (let i = 0; i < numPts; i++) {
                  const d = Math.hypot(pos[i * 3] - mouseWorld.x, pos[i * 3 + 1] - mouseWorld.y);
                  if (d < bestD) {
                    bestD = d;
                    draggedClothIdx = i;
                  }
                }
              }
              if (draggedClothIdx !== -1) {
                pos[draggedClothIdx * 3] = prev[draggedClothIdx * 3] = mouseWorld.x;
                pos[draggedClothIdx * 3 + 1] = prev[draggedClothIdx * 3 + 1] = mouseWorld.y;
              }
            }
          }

          for (let i = 0; i < numPts; i++) {
            if (pinned[i] || i === draggedClothIdx) continue;
            const idx = i * 3;
            const vx = (pos[idx] - prev[idx]) * curC.damping;
            const vy = (pos[idx + 1] - prev[idx + 1]) * curC.damping;
            const vz = (pos[idx + 2] - prev[idx + 2]) * curC.damping;

            prev[idx] = pos[idx];
            prev[idx + 1] = pos[idx + 1];
            prev[idx + 2] = pos[idx + 2];

            const wind = Math.sin(elapsed * 2.5 + pos[idx] * 0.5) * st.windStrength;
            pos[idx] += vx + wind * 0.25 * dt * dt;
            pos[idx + 1] = Math.max(0.05, pos[idx + 1] + vy - st.gravity * dt * dt);
            pos[idx + 2] += vz + wind * dt * dt;
          }

          let torn = false;
          const maxTear = restDx * curC.tearThreshold;
          for (let iter = 0; iter < 5; iter++) {
            for (let i = 0; i < constraints.length; i++) {
              const c = constraints[i];
              if (!c.active) continue;
              const i1 = c.p1 * 3;
              const i2 = c.p2 * 3;
              const dx = pos[i2] - pos[i1];
              const dy = pos[i2 + 1] - pos[i1 + 1];
              const dz = pos[i2 + 2] - pos[i1 + 2];
              const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
              if (d === 0) continue;

              if (d > maxTear) {
                c.active = false;
                edgeMap.delete(c.p1 < c.p2 ? `${c.p1}_${c.p2}` : `${c.p2}_${c.p1}`);
                torn = true;
                continue;
              }

              const diff = ((d - c.rest) / d) * 0.5 * curC.stiffness;
              const ox = dx * diff;
              const oy = dy * diff;
              const oz = dz * diff;

              if (!pinned[c.p1] && c.p1 !== draggedClothIdx) {
                pos[i1] += ox;
                pos[i1 + 1] += oy;
                pos[i1 + 2] += oz;
              }
              if (!pinned[c.p2] && c.p2 !== draggedClothIdx) {
                pos[i2] -= ox;
                pos[i2 + 1] -= oy;
                pos[i2 + 2] -= oz;
              }
            }
          }

          if (torn) rebuildIndices();
          (clothGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
          clothGeo.computeVertexNormals();
        };
      }

      // -----------------------------------------------------------------------
      // LAB D: BLACK HOLE
      // -----------------------------------------------------------------------
      else if (lab === 'gravity') {
        const starCount = quality === 'low' ? 3500 : quality === 'medium' ? 7000 : 12000;

        const createBHGroup = () => {
          const g = new THREE.Group();
          const core = new THREE.Mesh(
            new THREE.SphereGeometry(0.65, 32, 32),
            new THREE.MeshBasicMaterial({ color: '#000000' })
          );
          g.add(core);

          const halo = new THREE.Mesh(
            new THREE.SphereGeometry(0.85, 32, 32),
            new THREE.MeshBasicMaterial({
              color: '#c084fc',
              transparent: true,
              opacity: 0.28,
              side: THREE.BackSide,
              blending: THREE.AdditiveBlending,
            })
          );
          g.add(halo);

          const diskMat = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            uniforms: {
              uTime: { value: 0 },
              uLensing: { value: 1.2 },
            },
            vertexShader: `
              varying vec2 vUv;
              void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `,
            fragmentShader: `
              uniform float uTime;
              uniform float uLensing;
              varying vec2 vUv;
              void main() {
                vec2 c = vUv * 2.0 - 1.0;
                float r = length(c);
                if(r < 0.24 || r > 0.98) discard;
                float a = atan(c.y, c.x);
                float spiral = sin(a * 5.0 - r * 18.0 + uTime * 4.5);
                float bands = cos(r * 35.0 - uTime * 6.0) * 0.5 + 0.5;
                float inten = smoothstep(0.24, 0.38, r) * (1.0 - smoothstep(0.55, 0.98, r));
                inten *= (0.65 + 0.35 * spiral * bands) * uLensing;
                vec3 col = mix(vec3(1.0, 0.92, 0.8), vec3(0.98, 0.45, 0.08), smoothstep(0.25, 0.55, r));
                col = mix(col, vec3(0.55, 0.15, 0.85), smoothstep(0.55, 0.92, r));
                gl_FragColor = vec4(col * inten * 1.8, clamp(inten, 0.0, 0.92));
              }
            `,
          });

          const disk = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 5.5), diskMat);
          disk.rotation.x = Math.PI / 2.15;
          g.add(disk);
          return { group: g, diskMat, halo };
        };

        const bh1 = createBHGroup();
        bh1.group.position.set(0, 3.0, 0);
        labGroup.add(bh1.group);

        const bh2 = createBHGroup();
        bh2.group.position.set(2.5, 3.0, 0);
        labGroup.add(bh2.group);

        const pos = new Float32Array(starCount * 3);
        const vel = new Float32Array(starCount * 3);
        const cols = new Float32Array(starCount * 3);

        const cNear = new THREE.Color('#f97316');
        const cMid = new THREE.Color('#38bdf8');
        const cFar = new THREE.Color('#a855f7');
        const tmpCol = new THREE.Color();

        const spawnStar = (i: number, minR = 1.4, maxR = 9.5) => {
          const r = minR + Math.random() * (maxR - minR);
          const theta = Math.random() * Math.PI * 2;
          pos[i * 3] = Math.cos(theta) * r;
          pos[i * 3 + 1] = 3.0 + (Math.random() - 0.5) * 0.45 * (r / maxR);
          pos[i * 3 + 2] = Math.sin(theta) * r;

          const spd = Math.sqrt(18.0 / r) * (0.92 + Math.random() * 0.15);
          vel[i * 3] = -Math.sin(theta) * spd;
          vel[i * 3 + 1] = (Math.random() - 0.5) * 0.2;
          vel[i * 3 + 2] = Math.cos(theta) * spd;

          const t = (r - minR) / (maxR - minR);
          tmpCol.lerpColors(t < 0.4 ? cNear : cMid, t < 0.4 ? cMid : cFar, t < 0.4 ? t / 0.4 : (t - 0.4) / 0.6);
          cols[i * 3] = tmpCol.r;
          cols[i * 3 + 1] = tmpCol.g;
          cols[i * 3 + 2] = tmpCol.b;
        };

        for (let i = 0; i < starCount; i++) spawnStar(i);

        const starGeo = new THREE.BufferGeometry();
        starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        starGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));

        const starMat = new THREE.PointsMaterial({
          size: 0.09,
          vertexColors: true,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const starPoints = new THREE.Points(starGeo, starMat);
        labGroup.add(starPoints);

        disposables.push(starGeo, starMat);

        updateCurrentLab = (dt, elapsed) => {
          const st = useSimulationStore.getState();
          bh1.diskMat.uniforms.uTime.value = elapsed;
          bh1.diskMat.uniforms.uLensing.value = st.lensingIntensity;
          bh2.diskMat.uniforms.uTime.value = elapsed;
          bh2.diskMat.uniforms.uLensing.value = st.lensingIntensity;
          bh2.group.visible = st.binarySystem;

          let bh1X = 0,
            bh1Z = 0,
            bh2X = 0,
            bh2Z = 0;
          if (st.binarySystem) {
            bh1X = Math.cos(elapsed * 0.9) * 2.4;
            bh1Z = Math.sin(elapsed * 0.9) * 2.4;
            bh2X = -bh1X;
            bh2Z = -bh1Z;
          }
          bh1.group.position.set(bh1X, 3.0, bh1Z);
          bh2.group.position.set(bh2X, 3.0, bh2Z);

          for (let i = 0; i < starCount; i++) {
            const idx = i * 3;
            const dx1 = bh1X - pos[idx];
            const dy1 = 3.0 - pos[idx + 1];
            const dz1 = bh1Z - pos[idx + 2];
            const dSq1 = dx1 * dx1 + dy1 * dy1 + dz1 * dz1;

            if (dSq1 < 0.42 || dSq1 > 160) {
              spawnStar(i, 6.0, 9.8);
              continue;
            }

            const d1 = Math.sqrt(dSq1);
            const f1 = (st.blackHoleMass / (dSq1 + 0.15)) * dt;
            vel[idx] += (dx1 / d1) * f1;
            vel[idx + 1] += (dy1 / d1) * f1;
            vel[idx + 2] += (dz1 / d1) * f1;

            if (st.binarySystem) {
              const dx2 = bh2X - pos[idx];
              const dy2 = 3.0 - pos[idx + 1];
              const dz2 = bh2Z - pos[idx + 2];
              const dSq2 = dx2 * dx2 + dy2 * dy2 + dz2 * dz2;
              if (dSq2 < 0.42) {
                spawnStar(i, 6.0, 9.8);
                continue;
              }
              const d2 = Math.sqrt(dSq2);
              const f2 = ((st.blackHoleMass * 0.85) / (dSq2 + 0.15)) * dt;
              vel[idx] += (dx2 / d2) * f2;
              vel[idx + 1] += (dy2 / d2) * f2;
              vel[idx + 2] += (dz2 / d2) * f2;
            }

            pos[idx] += vel[idx] * dt;
            pos[idx + 1] += vel[idx + 1] * dt;
            pos[idx + 2] += vel[idx + 2] * dt;
          }

          (starGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
        };
      }

      // -----------------------------------------------------------------------
      // LAB E: UNIFIED MULTI-PHYSICS
      // -----------------------------------------------------------------------
      else if (lab === 'unified') {
        const segs = 22;
        const cols = segs + 1;
        const size = 6.0;
        const stepDist = size / segs;
        const numNodes = cols * cols;
        const numDrops = quality === 'low' ? 500 : 1000;

        const cPos = new Float32Array(numNodes * 3);
        const cPrev = new Float32Array(numNodes * 3);
        const cPin = new Uint8Array(numNodes);
        const cWet = new Float32Array(numNodes);

        for (let z = 0; z < cols; z++) {
          for (let x = 0; x < cols; x++) {
            const i = z * cols + x;
            cPos[i * 3] = cPrev[i * 3] = (x / segs - 0.5) * size;
            cPos[i * 3 + 1] = cPrev[i * 3 + 1] = 2.6;
            cPos[i * 3 + 2] = cPrev[i * 3 + 2] = (z / segs - 0.5) * size;
            if (((x === 0 || x === segs) && z % 3 === 0) || ((z === 0 || z === segs) && x % 3 === 0)) {
              cPin[i] = 1;
            }
          }
        }

        const constraints: { p1: number; p2: number; rest: number; active: boolean }[] = [];
        const edgeMap = new Set<string>();
        const addC = (a: number, b: number) => {
          constraints.push({ p1: a, p2: b, rest: stepDist, active: true });
          edgeMap.add(a < b ? `${a}_${b}` : `${b}_${a}`);
        };
        for (let z = 0; z < cols; z++) {
          for (let x = 0; x < cols; x++) {
            const i = z * cols + x;
            if (x < segs) addC(i, i + 1);
            if (z < segs) addC(i, i + cols);
          }
        }

        const clothGeo = new THREE.BufferGeometry();
        clothGeo.setAttribute('position', new THREE.BufferAttribute(cPos, 3));
        const rebuildNet = () => {
          const idx: number[] = [];
          const has = (a: number, b: number) => edgeMap.has(a < b ? `${a}_${b}` : `${b}_${a}`);
          for (let z = 0; z < segs; z++) {
            for (let x = 0; x < segs; x++) {
              const i00 = z * cols + x;
              const i10 = i00 + 1;
              const i01 = (z + 1) * cols + x;
              const i11 = i01 + 1;
              if (has(i00, i10) && has(i00, i01)) idx.push(i00, i01, i10);
              if (has(i10, i11) && has(i01, i11)) idx.push(i10, i01, i11);
            }
          }
          clothGeo.setIndex(idx);
        };
        rebuildNet();
        clothGeo.computeVertexNormals();

        const clothMat = new THREE.MeshStandardMaterial({
          color: cPreset.color,
          roughness: cPreset.roughness,
          side: THREE.DoubleSide,
        });
        labGroup.add(new THREE.Mesh(clothGeo, clothMat));

        const dropGeo = new THREE.SphereGeometry(0.14, 12, 12);
        const dropMat = new THREE.MeshPhysicalMaterial({
          color: fPreset.color,
          roughness: 0.1,
          clearcoat: 1.0,
        });
        const dropMesh = new THREE.InstancedMesh(dropGeo, dropMat, numDrops);
        labGroup.add(dropMesh);

        const fPos = new Float32Array(numDrops * 3);
        const fVel = new Float32Array(numDrops * 3);
        const dummy = new THREE.Object3D();

        const spawnDrop = (i: number, randY = false) => {
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * 1.4;
          fPos[i * 3] = Math.cos(a) * r;
          fPos[i * 3 + 1] = randY ? 3.0 + Math.random() * 4.5 : 6.2 + Math.random();
          fPos[i * 3 + 2] = Math.sin(a) * r;
          fVel[i * 3] = (Math.random() - 0.5) * 0.5;
          fVel[i * 3 + 1] = -0.5;
          fVel[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
        };
        for (let i = 0; i < numDrops; i++) spawnDrop(i, true);

        disposables.push(clothGeo, clothMat, dropGeo, dropMat);

        updateCurrentLab = (dt) => {
          const st = useSimulationStore.getState();
          const curF = FLUID_PRESETS[st.fluidPreset] || FLUID_PRESETS.water;
          const curC = CLOTH_PRESETS[st.clothPreset] || CLOTH_PRESETS.silk;
          dropMat.color.set(curF.color);
          clothMat.color.set(curC.color);

          for (let i = 0; i < numNodes; i++) {
            if (cPin[i]) continue;
            const idx = i * 3;
            const vx = (cPos[idx] - cPrev[idx]) * 0.98;
            const vy = (cPos[idx + 1] - cPrev[idx + 1]) * 0.98;
            const vz = (cPos[idx + 2] - cPrev[idx + 2]) * 0.98;
            cPrev[idx] = cPos[idx];
            cPrev[idx + 1] = cPos[idx + 1];
            cPrev[idx + 2] = cPos[idx + 2];

            const wetMass = 1.0 + cWet[i] * st.clothWetnessFactor;
            cWet[i] = Math.max(0, cWet[i] - dt * 0.15);

            cPos[idx] += vx;
            cPos[idx + 1] = Math.max(0.05, cPos[idx + 1] + vy - st.gravity * wetMass * dt * dt);
            cPos[idx + 2] += vz;
          }

          const half = size * 0.5;
          for (let i = 0; i < numDrops; i++) {
            const idx = i * 3;
            fVel[idx + 1] -= st.gravity * dt;
            fPos[idx] += fVel[idx] * dt;
            fPos[idx + 1] += fVel[idx + 1] * dt;
            fPos[idx + 2] += fVel[idx + 2] * dt;

            if (Math.abs(fPos[idx]) < half && Math.abs(fPos[idx + 2]) < half) {
              const gx = Math.round(((fPos[idx] + half) / size) * segs);
              const gz = Math.round(((fPos[idx + 2] + half) / size) * segs);
              if (gx >= 0 && gx <= segs && gz >= 0 && gz <= segs) {
                const cIdx = gz * cols + gx;
                const cy = cPos[cIdx * 3 + 1];
                if (fPos[idx + 1] < cy + 0.16 && fPos[idx + 1] > cy - 0.35 && fVel[idx + 1] < 0) {
                  fPos[idx + 1] = cy + 0.16;
                  fVel[idx + 1] *= -0.35;
                  fVel[idx] += (Math.random() - 0.5) * 1.6;
                  fVel[idx + 2] += (Math.random() - 0.5) * 1.6;
                  if (!cPin[cIdx]) {
                    cPos[cIdx * 3 + 1] -= 0.04 * curF.restDensity;
                    cWet[cIdx] = Math.min(3.0, cWet[cIdx] + 0.35);
                  }
                }
              }
            }

            if (fPos[idx + 1] < 0.1) spawnDrop(i, false);
            dummy.position.set(fPos[idx], fPos[idx + 1], fPos[idx + 2]);
            dummy.updateMatrix();
            dropMesh.setMatrixAt(i, dummy.matrix);
          }

          let torn = false;
          const maxTear = stepDist * curC.tearThreshold;
          for (let iter = 0; iter < 4; iter++) {
            for (let i = 0; i < constraints.length; i++) {
              const c = constraints[i];
              if (!c.active) continue;
              const i1 = c.p1 * 3;
              const i2 = c.p2 * 3;
              const dx = cPos[i2] - cPos[i1];
              const dy = cPos[i2 + 1] - cPos[i1 + 1];
              const dz = cPos[i2 + 2] - cPos[i1 + 2];
              const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
              if (d > maxTear) {
                c.active = false;
                edgeMap.delete(c.p1 < c.p2 ? `${c.p1}_${c.p2}` : `${c.p2}_${c.p1}`);
                torn = true;
                continue;
              }
              const diff = ((d - c.rest) / d) * 0.5 * curC.stiffness;
              if (!cPin[c.p1]) {
                cPos[i1] += dx * diff;
                cPos[i1 + 1] += dy * diff;
                cPos[i1 + 2] += dz * diff;
              }
              if (!cPin[c.p2]) {
                cPos[i2] -= dx * diff;
                cPos[i2 + 1] -= dy * diff;
                cPos[i2 + 2] -= dz * diff;
              }
            }
          }

          if (torn) rebuildNet();
          (clothGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
          clothGeo.computeVertexNormals();
          dropMesh.instanceMatrix.needsUpdate = true;
        };
      }

      // -----------------------------------------------------------------------
      // LAB F: THERMAL & IDEAL GAS LAB (Temperature, State Change & Brownian Motion)
      // -----------------------------------------------------------------------
      else if (lab === 'thermal') {
        const pCount = quality === 'low' ? 1200 : quality === 'medium' ? 2500 : 5000;
        const radius = 0.08;
        const boxSize = 6.0;

        // Glass Chamber
        const chamberGeo = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
        const chamberMat = new THREE.MeshPhysicalMaterial({
          color: '#e2e8f0',
          transparent: true,
          opacity: 0.15,
          roughness: 0.1,
          side: THREE.BackSide,
        });
        const chamberMesh = new THREE.Mesh(chamberGeo, chamberMat);
        chamberMesh.position.set(0, boxSize / 2 + 0.1, 0);
        labGroup.add(chamberMesh);

        const edgesGeo = new THREE.EdgesGeometry(chamberGeo);
        const edgesMat = new THREE.LineBasicMaterial({ color: '#f97316', transparent: true, opacity: 0.5 });
        const edgesMesh = new THREE.LineSegments(edgesGeo, edgesMat);
        edgesMesh.position.copy(chamberMesh.position);
        labGroup.add(edgesMesh);

        // Gas Particles
        const gasGeo = new THREE.SphereGeometry(radius, 8, 8);
        const gasMat = new THREE.MeshBasicMaterial({ color: '#38bdf8' });
        const gasMesh = new THREE.InstancedMesh(gasGeo, gasMat, pCount);
        labGroup.add(gasMesh);

        disposables.push(chamberGeo, chamberMat, edgesGeo, edgesMat, gasGeo, gasMat);

        const pos = new Float32Array(pCount * 3);
        const vel = new Float32Array(pCount * 3);
        const tmpCol = new THREE.Color();
        const dummy = new THREE.Object3D();

        for (let i = 0; i < pCount; i++) {
          pos[i * 3] = (Math.random() - 0.5) * (boxSize - radius * 2);
          pos[i * 3 + 1] = Math.random() * (boxSize - radius * 2) + 0.1 + radius;
          pos[i * 3 + 2] = (Math.random() - 0.5) * (boxSize - radius * 2);

          // Initial random velocities
          vel[i * 3] = (Math.random() - 0.5);
          vel[i * 3 + 1] = (Math.random() - 0.5);
          vel[i * 3 + 2] = (Math.random() - 0.5);
        }

        updateCurrentLab = (dt) => {
          const st = useSimulationStore.getState();
          const temp = st.temperature; // Kelvin (e.g. 298)

          // Map temp (0K - 1000K) to Particle Speed & Color
          const kineticEnergy = Math.max(0.1, temp / 100);
          
          // Color Shift based on temperature (Blue = Cold, Red/White = Hot)
          if (temp < 273) tmpCol.set('#38bdf8'); // Ice cold
          else if (temp < 400) tmpCol.set('#10b981'); // Room temp
          else if (temp < 800) tmpCol.set('#f97316'); // Very Hot
          else tmpCol.set('#ffffff'); // Plasma

          gasMat.color.copy(tmpCol);

          const halfBox = boxSize / 2 - radius;

          for (let i = 0; i < pCount; i++) {
            const idx = i * 3;
            
            // Apply Kinetic Speed
            pos[idx] += vel[idx] * kineticEnergy * dt * 10;
            pos[idx + 1] += vel[idx + 1] * kineticEnergy * dt * 10;
            pos[idx + 2] += vel[idx + 2] * kineticEnergy * dt * 10;

            // Bouncing off walls (Elastic Collision)
            if (Math.abs(pos[idx]) > halfBox) {
              pos[idx] = Math.sign(pos[idx]) * halfBox;
              vel[idx] *= -1;
            }
            if (pos[idx + 1] < 0.1 + radius) {
              pos[idx + 1] = 0.1 + radius;
              vel[idx + 1] *= -1;
            } else if (pos[idx + 1] > boxSize + 0.1 - radius) {
              pos[idx + 1] = boxSize + 0.1 - radius;
              vel[idx + 1] *= -1;
            }
            if (Math.abs(pos[idx + 2]) > halfBox) {
              pos[idx + 2] = Math.sign(pos[idx + 2]) * halfBox;
              vel[idx + 2] *= -1;
            }

            dummy.position.set(pos[idx], pos[idx + 1], pos[idx + 2]);
            dummy.updateMatrix();
            gasMesh.setMatrixAt(i, dummy.matrix);
          }
          gasMesh.instanceMatrix.needsUpdate = true;
        };
      }
    };

    buildActiveLab();

    // =========================================================================
    // 3. POINTER & RESIZE EVENT LISTENERS
    // =========================================================================
    const onPointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      raycaster.ray.intersectPlane(planeZ, mouseWorld);
    };

    const onPointerDown = (e: PointerEvent) => {
      onPointerMove(e);
      isPointerDown = true;
      const st = useSimulationStore.getState();
      if (st.activeLab === 'cloth') {
        controls.enabled = false;
      }
    };

    const onPointerUp = () => {
      isPointerDown = false;
      draggedClothIdx = -1;
      controls.enabled = true;
    };

    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('pointermove', onPointerMove);
    domElem.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('resize', onResize);

    // =========================================================================
    // 4. PURE THREE.JS ANIMATION LOOP
    // =========================================================================
    let animId: number;
    let prevTime = performance.now();
    let elapsed = 0;

    const animate = (now: number) => {
      animId = requestAnimationFrame(animate);

      const rawDt = Math.min((now - prevTime) / 1000, 0.02);
      prevTime = now;

      const st = useSimulationStore.getState();
      const targetKey = `${st.activeLab}_${st.quality}_${st.resetCounter}`;
      if (targetKey !== currentLabKey) {
        buildActiveLab();
      }

      if (st.isPlaying) {
        const dt = rawDt * (st.timeScale || 1.0);
        elapsed += dt;
        updateCurrentLab(dt, elapsed);
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      domElem.removeEventListener('pointermove', onPointerMove);
      domElem.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', onResize);
      clearLabGroup();
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="w-full h-full relative">
      <div ref={mountRef} className="w-full h-full" />

      <div className="absolute bottom-4 left-4 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-md text-[11px] text-slate-300 pointer-events-none">
        {activeLab === 'fluid' &&
          `Pure Three.js SPH Engine (${fluidTool.toUpperCase()}): Move cursor across the glass tank to splash, swirl vortex, or attract water!`}
        {activeLab === 'ocean' &&
          'Pure Three.js GLSL Ocean: Glide or click on the 3D water surface to generate real-time waves!'}
        {activeLab === 'thermal' &&
          'Ideal Gas Lab: Adjust the Temperature to see Brownian motion and kinetic energy changes!'}
        {activeLab === 'cloth' &&
          `Pure Three.js PBD Cloth (${clothTool.toUpperCase()}): Click & drag to stretch/tear or swipe to cut fabric!`}
        {activeLab === 'gravity' &&
          'Pure Three.js Singularity: Relativistic accretion shader & orbital star vortex!'}
        {activeLab === 'unified' &&
          'Pure Three.js Multi-Physics: Liquid stream dynamically weighs down and tears the cloth net!'}
      </div>
    </div>
  );
}