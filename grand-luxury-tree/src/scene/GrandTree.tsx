import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment, Sparkles, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { photoUrls } from 'virtual:photo-list';

export type TreeMode = 'FORMED' | 'CHAOS';

type ProgressRef = MutableRefObject<number>;

type OrnamentData = {
  target: THREE.Vector3[];
  chaos: THREE.Vector3[];
  current: THREE.Vector3[];
  rotation: THREE.Euler[];
  scale: number[];
  weight: number[];
  wobble: number[];
};

type PhotoData = {
  target: THREE.Vector3;
  chaos: THREE.Vector3;
  current: THREE.Vector3;
  targetRotation: THREE.Euler;
  chaosRotation: THREE.Euler;
  currentRotation: THREE.Euler;
  scale: number;
  weight: number;
};

const TREE_HEIGHT = 4.6;
const TREE_RADIUS = 2.1;
const CHAOS_RADIUS = 6.4;

const FOLIAGE_COUNT = 1860;
const GIFT_COUNT = 80;
const BAUBLE_COUNT = 140;
const LIGHT_COUNT = 36;
const STAR_COUNT = 50;
const SPIRAL_COUNT = 90;
const SPIRAL_TURNS = 3.4;
const SNOW_COUNT = 520;
const ROOT_PINE_COUNT = 16;
const ROOT_BERRY_COUNT = 22;
const GROUND_GIFT_COUNT = 26;
const BASE_Y = -TREE_HEIGHT / 2 - 0.75;

const foliageVertexShader = `
  attribute vec3 aChaos;
  attribute float aScale;
  uniform float uTime;
  uniform float uProgress;
  varying float vTwinkle;
  void main() {
    vec3 blended = mix(position, aChaos, uProgress);
    float sway = sin(uTime * 0.6 + blended.y * 3.4 + blended.x * 5.2) * 0.03;
    float breathe = 0.86 + 0.14 * sin(uTime * 0.7 + blended.y * 2.4);
    blended.xz += vec2(sway, -sway);
    vec4 mvPosition = modelViewMatrix * vec4(blended, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aScale * (1.0 + (1.0 - uProgress) * 0.5);
    gl_PointSize *= breathe * (200.0 / -mvPosition.z);
    vTwinkle = sin(uTime * 1.4 + aScale * 8.0);
  }
`;

const foliageFragmentShader = `
  uniform vec3 uColor;
  uniform vec3 uGold;
  varying float vTwinkle;
  void main() {
    vec2 coord = gl_PointCoord - 0.5;
    float dist = length(coord);
    float alpha = smoothstep(0.5, 0.0, dist);
    alpha *= 0.75;
    float rim = smoothstep(0.18, 0.5, dist);
    float glow = clamp(vTwinkle * 0.3 + 0.35, 0.0, 1.0);
    vec3 edge = mix(uGold, vec3(1.0, 0.97, 0.85), rim);
    vec3 color = mix(uColor, uGold, glow);
    color = mix(color, edge, rim * 0.6);
    color *= 0.85;
    gl_FragColor = vec4(color, alpha);
  }
`;

const randomInSphere = (radius: number) => {
  const u = Math.random();
  const v = Math.random();
  const theta = u * Math.PI * 2;
  const phi = Math.acos(2 * v - 1);
  const r = radius * Math.cbrt(Math.random());
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
};

const randomConePoint = (height: number, radius: number, outerBias = 0.35) => {
  const y = Math.pow(Math.random(), 0.62) * height;
  const radiusAtY = (1 - y / height) * radius;
  const radial = radiusAtY * (outerBias + (1 - outerBias) * Math.random());
  const theta = Math.random() * Math.PI * 2;
  return new THREE.Vector3(
    Math.cos(theta) * radial,
    y - height / 2,
    Math.sin(theta) * radial
  );
};

const buildOrnaments = (
  count: number,
  weightBase: number,
  scaleMin: number,
  scaleMax: number,
  outerBias: number
): OrnamentData => {
  const target: THREE.Vector3[] = [];
  const chaos: THREE.Vector3[] = [];
  const current: THREE.Vector3[] = [];
  const rotation: THREE.Euler[] = [];
  const scale: number[] = [];
  const weight: number[] = [];
  const wobble: number[] = [];

  for (let i = 0; i < count; i += 1) {
    const targetPoint = randomConePoint(TREE_HEIGHT, TREE_RADIUS, outerBias);
    target.push(targetPoint);
    chaos.push(randomInSphere(CHAOS_RADIUS));
    current.push(targetPoint.clone());
    rotation.push(
      new THREE.Euler(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      )
    );
    scale.push(THREE.MathUtils.lerp(scaleMin, scaleMax, Math.random()));
    weight.push(weightBase + Math.random() * 0.18);
    wobble.push(Math.random() * Math.PI * 2);
  }

  return { target, chaos, current, rotation, scale, weight, wobble };
};

const buildLayeredOrnaments = (
  count: number,
  weightBase: number,
  scaleMin: number,
  scaleMax: number,
  outerBias: number,
  tMin = 0.08,
  tMax = 0.92,
  tPower = 1
): OrnamentData => {
  const target: THREE.Vector3[] = [];
  const chaos: THREE.Vector3[] = [];
  const current: THREE.Vector3[] = [];
  const rotation: THREE.Euler[] = [];
  const scale: number[] = [];
  const weight: number[] = [];
  const wobble: number[] = [];

  for (let i = 0; i < count; i += 1) {
    const tRaw = (i + Math.random()) / count;
    const t = THREE.MathUtils.lerp(tMin, tMax, Math.pow(tRaw, tPower));
    const y = t * TREE_HEIGHT - TREE_HEIGHT / 2 + (Math.random() - 0.5) * 0.12;
    const radiusAtY = (1 - t) * TREE_RADIUS;
    const radial = radiusAtY * (outerBias + (1 - outerBias) * Math.random());
    const theta = Math.random() * Math.PI * 2;
    const targetPoint = new THREE.Vector3(
      Math.cos(theta) * radial,
      y,
      Math.sin(theta) * radial
    );

    target.push(targetPoint);
    chaos.push(randomInSphere(CHAOS_RADIUS));
    current.push(targetPoint.clone());
    rotation.push(
      new THREE.Euler(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      )
    );
    scale.push(THREE.MathUtils.lerp(scaleMin, scaleMax, Math.random()));
    weight.push(weightBase + Math.random() * 0.18);
    wobble.push(Math.random() * Math.PI * 2);
  }

  return { target, chaos, current, rotation, scale, weight, wobble };
};

const buildPhotoData = (count: number): PhotoData[] => {
  const data: PhotoData[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = THREE.MathUtils.lerp(0.12, 0.9, (i + Math.random()) / count);
    const y = t * TREE_HEIGHT - TREE_HEIGHT / 2 + (Math.random() - 0.5) * 0.12;
    const radiusAtY = (1 - t) * TREE_RADIUS * 1.05;
    const radial = radiusAtY * (0.78 + (1 - 0.78) * Math.random());
    const theta = Math.random() * Math.PI * 2;
    const targetPoint = new THREE.Vector3(Math.cos(theta) * radial, y, Math.sin(theta) * radial);
    const chaosPoint = randomInSphere(CHAOS_RADIUS * 1.05);
    const facing = Math.atan2(targetPoint.x, targetPoint.z);
    const targetRotation = new THREE.Euler(0.05, facing, THREE.MathUtils.degToRad(2));
    const chaosYaw =
      facing + THREE.MathUtils.degToRad(-70 + Math.random() * 140);
    const chaosRotation = new THREE.Euler(
      THREE.MathUtils.degToRad(-40 + Math.random() * 80),
      chaosYaw,
      THREE.MathUtils.degToRad(-25 + Math.random() * 50)
    );

    data.push({
      target: targetPoint,
      chaos: chaosPoint,
      current: targetPoint.clone(),
      targetRotation,
      chaosRotation,
      currentRotation: targetRotation.clone(),
      scale: 0.6 + Math.random() * 0.18,
      weight: 0.42 + Math.random() * 0.2
    });
  }

  return data;
};

type SpiralData = {
  target: THREE.Vector3[];
  chaos: THREE.Vector3[];
  current: THREE.Vector3[];
  scale: number[];
  weight: number[];
  offset: number[];
};

const buildSpiralData = (
  count: number,
  phase: number,
  radiusScale: number,
  sizeMin: number,
  sizeMax: number
): SpiralData => {
  const target: THREE.Vector3[] = [];
  const chaos: THREE.Vector3[] = [];
  const current: THREE.Vector3[] = [];
  const scale: number[] = [];
  const weight: number[] = [];
  const offset: number[] = [];

  for (let i = 0; i < count; i += 1) {
    const t = i / count;
    const y = t * TREE_HEIGHT - TREE_HEIGHT / 2;
    const radiusAtY = (1 - t) * TREE_RADIUS * radiusScale;
    const angle = t * Math.PI * 2 * SPIRAL_TURNS + phase;
    const jitter = (Math.random() - 0.5) * 0.08;
    const targetPoint = new THREE.Vector3(
      Math.cos(angle) * (radiusAtY + jitter),
      y + jitter * 0.2,
      Math.sin(angle) * (radiusAtY + jitter)
    );

    target.push(targetPoint);
    chaos.push(randomInSphere(CHAOS_RADIUS * 0.9));
    current.push(targetPoint.clone());
    scale.push(THREE.MathUtils.lerp(sizeMin, sizeMax, Math.random()));
    weight.push(0.35 + Math.random() * 0.2);
    offset.push(Math.random() * Math.PI * 2);
  }

  return { target, chaos, current, scale, weight, offset };
};

const FoliagePoints = ({ progress }: { progress: ProgressRef }) => {
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uColor: { value: new THREE.Color('#0a4a32') },
      uGold: { value: new THREE.Color('#f6d87a') }
    }),
    []
  );

  const { positions, chaosPositions, scales } = useMemo(() => {
    const positionsArray = new Float32Array(FOLIAGE_COUNT * 3);
    const chaosArray = new Float32Array(FOLIAGE_COUNT * 3);
    const scaleArray = new Float32Array(FOLIAGE_COUNT);

    for (let i = 0; i < FOLIAGE_COUNT; i += 1) {
      const targetPoint = randomConePoint(TREE_HEIGHT, TREE_RADIUS, 0.12);
      const chaosPoint = randomInSphere(CHAOS_RADIUS * 0.85);

      positionsArray[i * 3] = targetPoint.x;
      positionsArray[i * 3 + 1] = targetPoint.y;
      positionsArray[i * 3 + 2] = targetPoint.z;

      chaosArray[i * 3] = chaosPoint.x;
      chaosArray[i * 3 + 1] = chaosPoint.y;
      chaosArray[i * 3 + 2] = chaosPoint.z;

      scaleArray[i] = THREE.MathUtils.lerp(1.2, 2.6, Math.random());
    }

    return {
      positions: positionsArray,
      chaosPositions: chaosArray,
      scales: scaleArray
    };
  }, []);

  useFrame(({ clock }) => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    materialRef.current.uniforms.uProgress.value = progress.current;
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aChaos" args={[chaosPositions, 3]} />
        <bufferAttribute attach="attributes-aScale" args={[scales, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={foliageVertexShader}
        fragmentShader={foliageFragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

const Snowfall = () => {
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const positions = useMemo(() => new Float32Array(SNOW_COUNT * 3), []);
  const speeds = useMemo(() => new Float32Array(SNOW_COUNT), []);
  const drift = useMemo(() => new Float32Array(SNOW_COUNT), []);

  useMemo(() => {
    for (let i = 0; i < SNOW_COUNT; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 14;
      positions[i * 3 + 1] = Math.random() * 8 - 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 14;
      speeds[i] = 0.25 + Math.random() * 0.45;
      drift[i] = (Math.random() - 0.5) * 0.12;
    }
  }, [positions, speeds, drift]);

  useFrame((_, delta) => {
    for (let i = 0; i < SNOW_COUNT; i += 1) {
      const index = i * 3;
      positions[index + 1] -= speeds[i] * delta;
      positions[index] += drift[i] * delta;

      if (positions[index + 1] < -4.5) {
        positions[index + 1] = 4.5 + Math.random() * 2;
        positions[index] = (Math.random() - 0.5) * 14;
        positions[index + 2] = (Math.random() - 0.5) * 14;
      }
    }

    if (geometryRef.current) {
      geometryRef.current.attributes.position.needsUpdate = true;
    }
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#f1f6ff"
        size={0.045}
        sizeAttenuation
        transparent
        opacity={0.7}
        depthWrite={false}
      />
    </points>
  );
};

const RootDecor = () => {
  const pineRef = useRef<THREE.InstancedMesh | null>(null);
  const berryRef = useRef<THREE.InstancedMesh | null>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const pineData = useMemo(() => {
    const positions: THREE.Vector3[] = [];
    const rotations: THREE.Euler[] = [];
    const scales: number[] = [];

    for (let i = 0; i < ROOT_PINE_COUNT; i += 1) {
      const angle = (i / ROOT_PINE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      const radius = 0.45 + Math.random() * 0.35;
      positions.push(
        new THREE.Vector3(Math.cos(angle) * radius, (Math.random() - 0.5) * 0.12, Math.sin(angle) * radius)
      );
      rotations.push(
        new THREE.Euler(
          Math.PI * 0.45 + (Math.random() - 0.5) * 0.4,
          Math.random() * Math.PI * 2,
          (Math.random() - 0.5) * 0.5
        )
      );
      scales.push(0.6 + Math.random() * 0.65);
    }

    return { positions, rotations, scales };
  }, []);

  const berryData = useMemo(() => {
    const positions: THREE.Vector3[] = [];
    const scales: number[] = [];

    for (let i = 0; i < ROOT_BERRY_COUNT; i += 1) {
      const angle = (i / ROOT_BERRY_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const radius = 0.3 + Math.random() * 0.5;
      positions.push(
        new THREE.Vector3(Math.cos(angle) * radius, (Math.random() - 0.5) * 0.1, Math.sin(angle) * radius)
      );
      scales.push(0.65 + Math.random() * 0.55);
    }

    return { positions, scales };
  }, []);

  useEffect(() => {
    if (pineRef.current) {
      pineData.positions.forEach((position, i) => {
        dummy.position.copy(position);
        dummy.rotation.copy(pineData.rotations[i]);
        dummy.scale.setScalar(pineData.scales[i]);
        dummy.updateMatrix();
        pineRef.current?.setMatrixAt(i, dummy.matrix);
      });
      pineRef.current.instanceMatrix.needsUpdate = true;
    }

    if (berryRef.current) {
      berryData.positions.forEach((position, i) => {
        dummy.position.copy(position);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(berryData.scales[i]);
        dummy.updateMatrix();
        berryRef.current?.setMatrixAt(i, dummy.matrix);
      });
      berryRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [berryData, dummy, pineData]);

  return (
    <group position={[0, -TREE_HEIGHT / 2 + 0.2, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
        <torusGeometry args={[0.42, 0.07, 16, 80]} />
        <meshStandardMaterial color="#8b1e22" metalness={0.2} roughness={0.45} />
      </mesh>
      <instancedMesh ref={pineRef} args={[undefined, undefined, ROOT_PINE_COUNT]} frustumCulled={false}>
        <coneGeometry args={[0.08, 0.18, 12]} />
        <meshStandardMaterial color="#6b4a2e" metalness={0.15} roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={berryRef} args={[undefined, undefined, ROOT_BERRY_COUNT]} frustumCulled={false}>
        <sphereGeometry args={[0.045, 12, 12]} />
        <meshStandardMaterial
          color="#b11226"
          metalness={0.35}
          roughness={0.35}
          emissive="#4a0b12"
          emissiveIntensity={0.15}
        />
      </instancedMesh>
    </group>
  );
};

const OrnamentCluster = ({ progress }: { progress: ProgressRef }) => {
  const giftRef = useRef<THREE.InstancedMesh | null>(null);
  const giftRibbonXRef = useRef<THREE.InstancedMesh | null>(null);
  const giftRibbonZRef = useRef<THREE.InstancedMesh | null>(null);
  const giftBowRef = useRef<THREE.InstancedMesh | null>(null);
  const baubleRef = useRef<THREE.InstancedMesh | null>(null);
  const lightRef = useRef<THREE.InstancedMesh | null>(null);
  const starRef = useRef<THREE.InstancedMesh | null>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const bowDummy = useMemo(() => new THREE.Object3D(), []);
  const temp = useMemo(() => new THREE.Vector3(), []);

  const giftData = useMemo(
    () => buildLayeredOrnaments(GIFT_COUNT, 0.08, 0.16, 0.3, 0.68, 0.02, 0.9, 1.35),
    []
  );
  const baubleData = useMemo(
    () => buildLayeredOrnaments(BAUBLE_COUNT, 0.22, 0.1, 0.18, 0.78, 0.03, 0.9, 1.25),
    []
  );
  const lightData = useMemo(
    () => buildLayeredOrnaments(LIGHT_COUNT, 0.55, 0.003, 0.006, 0.88, 0.02, 0.88, 2.6),
    []
  );
  const starData = useMemo(() => buildOrnaments(STAR_COUNT, 0.75, 0.04, 0.08, 0.95), []);
  const giftColors = useMemo(() => {
    const palette = [
      '#E73B2B', // Bright Ruby Red
      '#1E8A4B'  // Bright Emerald Green
    ];
    return new Array(GIFT_COUNT).fill(0).map(() =>
      new THREE.Color(palette[Math.floor(Math.random() * palette.length)])
    );
  }, []);

  useEffect(() => {
    if (giftRef.current) {
      giftColors.forEach((color, i) => {
        giftRef.current?.setColorAt(i, color);
      });
      giftRef.current.instanceColor!.needsUpdate = true;
    }
  }, [giftColors]);

  useFrame(({ clock }, delta) => {
    const time = clock.getElapsedTime();
    const progressValue = progress.current;

    const updateGiftInstances = (data: OrnamentData) => {
      if (!giftRef.current) return;
      for (let i = 0; i < data.current.length; i += 1) {
        const weight = data.weight[i];
        const chaosFactor = Math.min(1, progressValue + weight * 0.18);
        temp.copy(data.target[i]).lerp(data.chaos[i], chaosFactor);
        const ease = 1 - Math.exp(-(0.9 + weight * 1.6) * delta);
        data.current[i].lerp(temp, ease);

        const wobbleScale = 0.45 + data.weight[i];
        const wobble = Math.sin(time * 0.8 + data.wobble[i]) * 0.05 * progressValue * wobbleScale;
        dummy.position.copy(data.current[i]);
        dummy.position.x += wobble;
        dummy.position.z -= wobble;

        dummy.rotation.set(
          data.rotation[i].x + wobble * 0.6,
          data.rotation[i].y + progressValue * 0.4,
          data.rotation[i].z
        );
        dummy.scale.setScalar(data.scale[i]);
        dummy.updateMatrix();
        giftRef.current.setMatrixAt(i, dummy.matrix);
        if (giftRibbonXRef.current) {
          giftRibbonXRef.current.setMatrixAt(i, dummy.matrix);
        }
        if (giftRibbonZRef.current) {
          giftRibbonZRef.current.setMatrixAt(i, dummy.matrix);
        }
        if (giftBowRef.current) {
          bowDummy.position.copy(data.current[i]);
          bowDummy.position.y += data.scale[i] * 0.65;
          bowDummy.rotation.copy(dummy.rotation);
          bowDummy.scale.setScalar(data.scale[i] * 0.28);
          bowDummy.updateMatrix();
          giftBowRef.current.setMatrixAt(i, bowDummy.matrix);
        }
      }
      giftRef.current.instanceMatrix.needsUpdate = true;
      if (giftRibbonXRef.current) {
        giftRibbonXRef.current.instanceMatrix.needsUpdate = true;
      }
      if (giftRibbonZRef.current) {
        giftRibbonZRef.current.instanceMatrix.needsUpdate = true;
      }
      if (giftBowRef.current) {
        giftBowRef.current.instanceMatrix.needsUpdate = true;
      }
    };

    const updateInstances = (mesh: THREE.InstancedMesh | null, data: OrnamentData) => {
      if (!mesh) return;
      for (let i = 0; i < data.current.length; i += 1) {
        const weight = data.weight[i];
        const chaosFactor = Math.min(1, progressValue + weight * 0.18);
        temp.copy(data.target[i]).lerp(data.chaos[i], chaosFactor);
        const ease = 1 - Math.exp(-(0.9 + weight * 1.6) * delta);
        data.current[i].lerp(temp, ease);

        const wobbleScale = 0.45 + data.weight[i];
        const wobble = Math.sin(time * 0.8 + data.wobble[i]) * 0.05 * progressValue * wobbleScale;
        dummy.position.copy(data.current[i]);
        dummy.position.x += wobble;
        dummy.position.z -= wobble;

        dummy.rotation.set(
          data.rotation[i].x + wobble * 0.6,
          data.rotation[i].y + progressValue * 0.4,
          data.rotation[i].z
        );
        dummy.scale.setScalar(data.scale[i]);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };

    updateGiftInstances(giftData);
    updateInstances(baubleRef.current, baubleData);
    updateInstances(lightRef.current, lightData);
    updateInstances(starRef.current, starData);
  });

  return (
    <group>
      <instancedMesh ref={giftRef} args={[undefined, undefined, GIFT_COUNT]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#ffffff"
          metalness={0.2}
          roughness={0.25}
          emissive="#2a0c12"
          emissiveIntensity={0.18}
          envMapIntensity={0.9}
          vertexColors
        />
      </instancedMesh>
      <instancedMesh
        ref={giftRibbonXRef}
        args={[undefined, undefined, GIFT_COUNT]}
        frustumCulled={false}
      >
        <boxGeometry args={[1.08, 0.14, 0.32]} />
        <meshStandardMaterial
          color="#FFD700"
          metalness={0.9}
          roughness={0.18}
          emissive="#F0B138"
          emissiveIntensity={0.5}
          envMapIntensity={1.2}
        />
      </instancedMesh>
      <instancedMesh
        ref={giftRibbonZRef}
        args={[undefined, undefined, GIFT_COUNT]}
        frustumCulled={false}
      >
        <boxGeometry args={[0.32, 0.14, 1.08]} />
        <meshStandardMaterial
          color="#FFD700"
          metalness={0.9}
          roughness={0.18}
          emissive="#F0B138"
          emissiveIntensity={0.5}
          envMapIntensity={1.2}
        />
      </instancedMesh>
      <instancedMesh
        ref={giftBowRef}
        args={[undefined, undefined, GIFT_COUNT]}
        frustumCulled={false}
      >
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial
          color="#FFD700"
          metalness={0.9}
          roughness={0.18}
          emissive="#F0B138"
          emissiveIntensity={0.55}
          envMapIntensity={1.2}
        />
      </instancedMesh>
      <instancedMesh ref={baubleRef} args={[undefined, undefined, BAUBLE_COUNT]} frustumCulled={false}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshPhysicalMaterial
          color="#f3c25d"
          metalness={0.55}
          roughness={0.12}
          clearcoat={1}
          clearcoatRoughness={0.08}
          specularIntensity={0.95}
          specularColor="#fff4c9"
          envMapIntensity={1.6}
          emissive="#b77b1c"
          emissiveIntensity={0.28}
        />
      </instancedMesh>
      <instancedMesh ref={lightRef} args={[undefined, undefined, LIGHT_COUNT]} frustumCulled={false}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial
          color="#f6d87a"
          emissive="#f6d87a"
          emissiveIntensity={0.25}
          metalness={0.3}
          roughness={0.2}
        />
      </instancedMesh>
      <instancedMesh ref={starRef} args={[undefined, undefined, STAR_COUNT]} frustumCulled={false}>
        <octahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial
          color="#fff4c2"
          emissive="#f6d87a"
          emissiveIntensity={0.45}
          metalness={0.4}
          roughness={0.25}
        />
      </instancedMesh>
    </group>
  );
};

const GroundGiftRing = () => {
  const baseRef = useRef<THREE.InstancedMesh | null>(null);
  const lidRef = useRef<THREE.InstancedMesh | null>(null);
  const ribbonXRef = useRef<THREE.InstancedMesh | null>(null);
  const ribbonZRef = useRef<THREE.InstancedMesh | null>(null);
  const bowRef = useRef<THREE.InstancedMesh | null>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const bodyDummy = useMemo(() => new THREE.Object3D(), []);
  const bowDummy = useMemo(() => new THREE.Object3D(), []);
  const lidDummy = useMemo(() => new THREE.Object3D(), []);

  const giftData = useMemo(() => {
    const palette = ['#1E8A4B'];
    return new Array(GROUND_GIFT_COUNT).fill(0).map((_, index) => {
      const angle = (index / GROUND_GIFT_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.18;
      const radius = 2.65 + Math.random() * 0.45;
      const size = 0.3 + Math.random() * 0.35;
      return {
        position: new THREE.Vector3(
          Math.cos(angle) * radius,
          BASE_Y + size * 0.5 + 0.02,
          Math.sin(angle) * radius
        ),
        rotation: new THREE.Euler(0, angle + Math.PI * 0.5, (Math.random() - 0.5) * 0.2),
        scale: size,
        color: new THREE.Color(palette[Math.floor(Math.random() * palette.length)])
      };
    });
  }, []);

  useEffect(() => {
    if (!baseRef.current) return;
    giftData.forEach((gift, index) => {
      bodyDummy.position.copy(gift.position);
      bodyDummy.position.y -= gift.scale * 0.11;
      bodyDummy.rotation.copy(gift.rotation);
      bodyDummy.scale.setScalar(gift.scale);
      bodyDummy.updateMatrix();
      baseRef.current!.setMatrixAt(index, bodyDummy.matrix);
      baseRef.current!.setColorAt(index, gift.color);
      dummy.position.copy(gift.position);
      dummy.rotation.copy(gift.rotation);
      dummy.scale.setScalar(gift.scale);
      dummy.updateMatrix();
      if (lidRef.current) {
        lidDummy.position.copy(gift.position);
        lidDummy.position.y += gift.scale * 0.39;
        lidDummy.rotation.copy(gift.rotation);
        lidDummy.scale.setScalar(gift.scale);
        lidDummy.updateMatrix();
        lidRef.current.setMatrixAt(index, lidDummy.matrix);
      }
      if (ribbonXRef.current) {
        ribbonXRef.current.setMatrixAt(index, dummy.matrix);
      }
      if (ribbonZRef.current) {
        ribbonZRef.current.setMatrixAt(index, dummy.matrix);
      }
      if (bowRef.current) {
        bowDummy.position.copy(gift.position);
        bowDummy.position.y += gift.scale * 0.65;
        bowDummy.rotation.copy(gift.rotation);
        bowDummy.scale.setScalar(gift.scale * 0.3);
        bowDummy.updateMatrix();
        bowRef.current.setMatrixAt(index, bowDummy.matrix);
      }
    });

    baseRef.current.instanceMatrix.needsUpdate = true;
    if (baseRef.current.instanceColor) {
      baseRef.current.instanceColor.needsUpdate = true;
    }
    if (lidRef.current) {
      lidRef.current.instanceMatrix.needsUpdate = true;
    }
    if (ribbonXRef.current) {
      ribbonXRef.current.instanceMatrix.needsUpdate = true;
    }
    if (ribbonZRef.current) {
      ribbonZRef.current.instanceMatrix.needsUpdate = true;
    }
    if (bowRef.current) {
      bowRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [giftData, dummy, bowDummy, bodyDummy, lidDummy]);

  return (
    <group>
      <instancedMesh ref={baseRef} args={[undefined, undefined, GROUND_GIFT_COUNT]} frustumCulled={false}>
        <boxGeometry args={[1, 0.78, 1]} />
        <meshPhysicalMaterial
          color="#ffffff"
          metalness={0.12}
          roughness={0.22}
          clearcoat={0.6}
          clearcoatRoughness={0.3}
          emissive="#0b2d1f"
          emissiveIntensity={0.12}
          envMapIntensity={1.1}
          vertexColors
        />
      </instancedMesh>
      <instancedMesh ref={lidRef} args={[undefined, undefined, GROUND_GIFT_COUNT]} frustumCulled={false}>
        <boxGeometry args={[1.04, 0.22, 1.04]} />
        <meshPhysicalMaterial
          color="#E73B2B"
          metalness={0.18}
          roughness={0.28}
          clearcoat={0.65}
          clearcoatRoughness={0.28}
          emissive="#2a0c0f"
          emissiveIntensity={0.18}
          envMapIntensity={1.1}
        />
      </instancedMesh>
      <instancedMesh ref={ribbonXRef} args={[undefined, undefined, GROUND_GIFT_COUNT]} frustumCulled={false}>
        <boxGeometry args={[1.08, 0.14, 0.32]} />
        <meshStandardMaterial
          color="#ffd76a"
          metalness={0.9}
          roughness={0.2}
          emissive="#f0b138"
          emissiveIntensity={0.45}
          envMapIntensity={1.2}
        />
      </instancedMesh>
      <instancedMesh ref={ribbonZRef} args={[undefined, undefined, GROUND_GIFT_COUNT]} frustumCulled={false}>
        <boxGeometry args={[0.32, 0.14, 1.08]} />
        <meshStandardMaterial
          color="#ffd76a"
          metalness={0.9}
          roughness={0.2}
          emissive="#f0b138"
          emissiveIntensity={0.45}
          envMapIntensity={1.2}
        />
      </instancedMesh>
      <instancedMesh ref={bowRef} args={[undefined, undefined, GROUND_GIFT_COUNT]} frustumCulled={false}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial
          color="#ffd76a"
          metalness={0.9}
          roughness={0.2}
          emissive="#f0b138"
          emissiveIntensity={0.55}
          envMapIntensity={1.2}
        />
      </instancedMesh>
    </group>
  );
};

const SpiralLights = ({ progress }: { progress: ProgressRef }) => {
  const redRef = useRef<THREE.InstancedMesh | null>(null);
  const greenRef = useRef<THREE.InstancedMesh | null>(null);
  const redMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const greenMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const temp = useMemo(() => new THREE.Vector3(), []);

  const redData = useMemo(() => buildSpiralData(SPIRAL_COUNT, 0, 1.03, 0.02, 0.035), []);
  const greenData = useMemo(
    () => buildSpiralData(SPIRAL_COUNT, Math.PI, 0.98, 0.02, 0.035),
    []
  );

  useFrame(({ clock }, delta) => {
    const time = clock.getElapsedTime();
    const progressValue = progress.current;
    const redPulse =
      0.32 * Math.sin(time * 2.6) + 0.16 * Math.sin(time * 8.8 + Math.PI * 0.3);
    const greenPulse =
      0.32 * Math.sin(time * 2.4 + Math.PI * 0.7) + 0.16 * Math.sin(time * 9.4);

    if (redMaterialRef.current) {
      redMaterialRef.current.emissiveIntensity = THREE.MathUtils.clamp(1.1 + redPulse, 0.65, 1.6);
    }
    if (greenMaterialRef.current) {
      greenMaterialRef.current.emissiveIntensity = THREE.MathUtils.clamp(
        1.1 + greenPulse,
        0.65,
        1.6
      );
    }

    const updateSpiral = (mesh: THREE.InstancedMesh | null, data: SpiralData) => {
      if (!mesh) return;
      for (let i = 0; i < data.current.length; i += 1) {
        const chaosFactor = Math.min(1, progressValue + data.weight[i] * 0.15);
        temp.copy(data.target[i]).lerp(data.chaos[i], chaosFactor);
        const ease = 1 - Math.exp(-(1.4 + data.weight[i] * 1.2) * delta);
        data.current[i].lerp(temp, ease);

        const wobble = Math.sin(time * 0.8 + data.offset[i]) * 0.05 * progressValue;
        dummy.position.copy(data.current[i]);
        dummy.position.y += wobble * 0.5;
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(data.scale[i]);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };

    updateSpiral(redRef.current, redData);
    updateSpiral(greenRef.current, greenData);
  });

  return (
    <group>
      <instancedMesh ref={redRef} args={[undefined, undefined, SPIRAL_COUNT]} frustumCulled={false}>
        <sphereGeometry args={[0.5, 24, 24]} />
        <meshStandardMaterial
          ref={redMaterialRef}
          color="#ff3b30"
          emissive="#ff3b30"
          emissiveIntensity={1.1}
          metalness={0.1}
          roughness={0.2}
          toneMapped={false}
        />
      </instancedMesh>
      <instancedMesh
        ref={greenRef}
        args={[undefined, undefined, SPIRAL_COUNT]}
        frustumCulled={false}
      >
        <sphereGeometry args={[0.5, 24, 24]} />
        <meshStandardMaterial
          ref={greenMaterialRef}
          color="#2dff84"
          emissive="#2dff84"
          emissiveIntensity={1.1}
          metalness={0.1}
          roughness={0.2}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
};

const PhotoOrnaments = ({ progress }: { progress: ProgressRef }) => {
  const textures = useTexture(photoUrls);
  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  const temp = useMemo(() => new THREE.Vector3(), []);
  const facingDummy = useMemo(() => new THREE.Object3D(), []);

  const data = useMemo(() => buildPhotoData(photoUrls.length), [photoUrls.length]);
  const photoSizes = useMemo(() => {
    const maxWidth = 0.64;
    const maxHeight = 0.7;
    const baseRatio = maxWidth / maxHeight;
    return textures.map((texture) => {
      const image = texture.image as { width?: number; height?: number } | undefined;
      const aspect =
        image && image.width && image.height ? image.width / image.height : baseRatio;
      let width = maxWidth;
      let height = maxHeight;
      if (aspect >= baseRatio) {
        width = maxWidth;
        height = maxWidth / aspect;
      } else {
        height = maxHeight;
        width = maxHeight * aspect;
      }
      return { width, height };
    });
  }, [textures]);

  useEffect(() => {
    textures.forEach((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 16;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.needsUpdate = true;
    });
  }, [textures]);

  useFrame(({ clock, camera }, delta) => {
    const time = clock.getElapsedTime();
    const progressValue = progress.current;

    data.forEach((item, index) => {
      const group = groupRefs.current[index];
      if (!group) return;
      const chaosFactor = Math.min(1, progressValue + item.weight * 0.2);
      temp.copy(item.target).lerp(item.chaos, chaosFactor);
      const ease = 1 - Math.exp(-(1.1 + item.weight * 1.5) * delta);
      item.current.lerp(temp, ease);

      const swirl = Math.sin(time * 0.6 + index) * 0.08 * progressValue;
      group.position.copy(item.current);
      group.position.y += swirl * 0.6;
      const scaleBoost = THREE.MathUtils.lerp(1, 2, progressValue);
      group.scale.setScalar(item.scale * scaleBoost);

      if (progressValue > 0.75) {
        facingDummy.position.copy(group.position);
        facingDummy.lookAt(camera.position);
        const targetX = facingDummy.rotation.x;
        const targetY = facingDummy.rotation.y;
        const targetZ = facingDummy.rotation.z + swirl * 0.2;
        item.currentRotation.x = THREE.MathUtils.damp(item.currentRotation.x, targetX, 6, delta);
        item.currentRotation.y = THREE.MathUtils.damp(item.currentRotation.y, targetY, 6, delta);
        item.currentRotation.z = THREE.MathUtils.damp(item.currentRotation.z, targetZ, 6, delta);
        group.rotation.set(item.currentRotation.x, item.currentRotation.y, item.currentRotation.z);
      } else {
        const targetX = THREE.MathUtils.lerp(
          item.targetRotation.x,
          item.chaosRotation.x,
          chaosFactor
        );
        const targetY = THREE.MathUtils.lerp(
          item.targetRotation.y,
          item.chaosRotation.y,
          chaosFactor
        );
        const targetZ = THREE.MathUtils.lerp(
          item.targetRotation.z,
          item.chaosRotation.z,
          chaosFactor
        );

        item.currentRotation.x = THREE.MathUtils.damp(item.currentRotation.x, targetX, 2.6, delta);
        item.currentRotation.y = THREE.MathUtils.damp(item.currentRotation.y, targetY, 2.6, delta);
        item.currentRotation.z = THREE.MathUtils.damp(item.currentRotation.z, targetZ, 2.6, delta);
        group.rotation.set(
          item.currentRotation.x,
          item.currentRotation.y,
          item.currentRotation.z + swirl * 0.6
        );
      }
    });
  });

  return (
    <group>
      {textures.map((texture, index) => (
        <group
          key={photoUrls[index]}
          ref={(node) => {
            groupRefs.current[index] = node;
          }}
        >
          <mesh position={[0, 0, -0.01]}>
            <boxGeometry args={[0.7, 0.85, 0.04]} />
            <meshPhysicalMaterial
              color="#f7f2e8"
              roughness={0.65}
              metalness={0.05}
              clearcoat={0.2}
              clearcoatRoughness={0.4}
              emissive="#f0e6d6"
              emissiveIntensity={0.08}
            />
          </mesh>
          <mesh position={[0, 0.04, 0.03]}>
            <planeGeometry
              args={[
                photoSizes[index]?.width ?? 0.56,
                photoSizes[index]?.height ?? 0.5
              ]}
            />
            <meshStandardMaterial
              map={texture}
              roughness={0.12}
              metalness={0}
              emissive="#ffffff"
              emissiveMap={texture}
              emissiveIntensity={0.42}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[0, 0.42, 0.035]}>
            <boxGeometry args={[0.18, 0.06, 0.02]} />
            <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

export const GrandTree = ({ mode }: { mode: TreeMode }) => {
  const progress = useRef(mode === 'CHAOS' ? 1 : 0);
  const groupRef = useRef<THREE.Group | null>(null);

  useFrame(({ clock }, delta) => {
    const target = mode === 'CHAOS' ? 1 : 0;
    progress.current = THREE.MathUtils.damp(progress.current, target, 2.4, delta);

    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.12) * 0.2;
    }
  });

  return (
    <group>
      <ambientLight intensity={0.6} color="#0b3b2a" />
      <hemisphereLight intensity={0.6} color="#f6e6b2" groundColor="#0b2d1f" />
      <directionalLight position={[3, 5, 6]} intensity={1.25} color="#fff2c4" />
      <pointLight position={[0, 1.6, 5.4]} intensity={1.1} color="#fff1c9" />
      <pointLight position={[0, 3.8, 0]} intensity={2.4} color="#f6d87a" />
      <pointLight position={[-4, 2, -2]} intensity={1.4} color="#d4af37" />
      <spotLight
        position={[6, 8, 6]}
        intensity={3.4}
        angle={0.35}
        penumbra={0.6}
        color="#f6d87a"
      />
      <Environment preset="warehouse" />

      <Snowfall />

      <group position={[0, -1.4, 0]}>
        <group ref={groupRef}>
          <FoliagePoints progress={progress} />
          <OrnamentCluster progress={progress} />
          <RootDecor />
          <SpiralLights progress={progress} />
          <Suspense fallback={null}>
            <PhotoOrnaments progress={progress} />
          </Suspense>
          <Sparkles count={19} scale={[2, 2, 2]} size={0.32} speed={0.35} color="#f6d87a" />
          <mesh position={[0, TREE_HEIGHT / 2 + 0.2, 0]}>
            <torusKnotGeometry args={[0.14, 0.05, 120, 12]} />
            <meshStandardMaterial
              color="#f6d87a"
              metalness={0.9}
              roughness={0.15}
              emissive="#5a440f"
            />
          </mesh>
        </group>

        <GroundGiftRing />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -TREE_HEIGHT / 2 - 0.75, 0]}>
          <circleGeometry args={[3.4, 80]} />
          <meshStandardMaterial
            color="#d4af37"
            metalness={0.85}
            roughness={0.25}
            emissive="#3e2b08"
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -TREE_HEIGHT / 2 - 0.74, 0]}>
          <ringGeometry args={[2.6, 3.45, 80]} />
          <meshStandardMaterial
            color="#2b1b05"
            metalness={0.6}
            roughness={0.2}
            emissive="#5f430c"
          />
        </mesh>
      </group>
    </group>
  );
};
