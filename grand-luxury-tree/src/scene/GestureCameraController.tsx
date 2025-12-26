import { useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

type HandMoveState = {
  x: number;
  y: number;
  active: boolean;
};

type GestureCameraControllerProps = {
  controlsRef: MutableRefObject<OrbitControlsImpl | null>;
  handRef: MutableRefObject<HandMoveState>;
  minPolarAngle: number;
  maxPolarAngle: number;
};

const AZIMUTH_RANGE = 0.75;
const POLAR_RANGE = 0.45;

export const GestureCameraController = ({
  controlsRef,
  handRef,
  minPolarAngle,
  maxPolarAngle
}: GestureCameraControllerProps) => {
  const baseAnglesRef = useRef<{ azimuth: number; polar: number } | null>(null);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const { x, y, active } = handRef.current;

    if (!active) {
      baseAnglesRef.current = null;
      return;
    }

    if (!baseAnglesRef.current) {
      baseAnglesRef.current = {
        azimuth: controls.getAzimuthalAngle(),
        polar: controls.getPolarAngle()
      };
    }

    const targetAzimuth = baseAnglesRef.current.azimuth - x * AZIMUTH_RANGE;
    const targetPolar = THREE.MathUtils.clamp(
      baseAnglesRef.current.polar + y * POLAR_RANGE,
      minPolarAngle,
      maxPolarAngle
    );

    const nextAzimuth = THREE.MathUtils.damp(
      controls.getAzimuthalAngle(),
      targetAzimuth,
      5,
      delta
    );
    const nextPolar = THREE.MathUtils.damp(controls.getPolarAngle(), targetPolar, 5, delta);

    controls.setAzimuthalAngle(nextAzimuth);
    controls.setPolarAngle(nextPolar);
    controls.update();
  });

  return null;
};
