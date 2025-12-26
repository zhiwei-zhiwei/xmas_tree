import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { GrandTree, TreeMode } from './scene/GrandTree';
import { PostEffects } from './scene/PostEffects';
import * as THREE from 'three';
import { SceneErrorBoundary } from './scene/SceneErrorBoundary';
import { HandGestureController } from './scene/HandGestureController';
import { GestureCameraController } from './scene/GestureCameraController';

const statusLabel: Record<TreeMode, string> = {
  FORMED: 'Formed',
  CHAOS: 'Unleashed'
};

export default function App() {
  const [mode, setMode] = useState<TreeMode>('FORMED');
  const [handActive, setHandActive] = useState(false);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const handRef = useRef({ x: 0, y: 0, active: false });
  const minPolarAngle = 0.55;
  const maxPolarAngle = 1.45;

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        setMode((prev) => (prev === 'FORMED' ? 'CHAOS' : 'FORMED'));
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const handleGesture = useCallback((gesture: 'open' | 'closed' | 'unknown') => {
    if (gesture === 'open') {
      setMode('CHAOS');
    } else if (gesture === 'closed') {
      setMode('FORMED');
    }
  }, []);

  const handleMove = useCallback((state: { x: number; y: number; active: boolean }) => {
    handRef.current.x = state.x;
    handRef.current.y = state.y;
    handRef.current.active = state.active;
  }, []);

  const handleActiveChange = useCallback((active: boolean) => {
    setHandActive(active);
  }, []);

  return (
    <div className="app-shell">
      <HandGestureController
        onGesture={handleGesture}
        onMove={handleMove}
        onActiveChange={handleActiveChange}
      />
      <SceneErrorBoundary>
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [0, 2.6, 8], fov: 48, near: 0.1, far: 60 }}
          gl={{ antialias: true, alpha: true }}
          className="app-canvas"
          style={{ width: '100%', height: '100%' }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.1;
            gl.setClearColor(new THREE.Color('#000000'), 0);
          }}
        >
          <fog attach="fog" args={['#0b1b2a', 9, 28]} />
          <GrandTree mode={mode} />
          <OrbitControls
            ref={controlsRef}
            enablePan={false}
            minDistance={6}
            maxDistance={12}
            minPolarAngle={minPolarAngle}
            maxPolarAngle={maxPolarAngle}
            autoRotate={!handActive}
            autoRotateSpeed={0.3}
          />
          <GestureCameraController
            controlsRef={controlsRef}
            handRef={handRef}
            minPolarAngle={minPolarAngle}
            maxPolarAngle={maxPolarAngle}
          />
          <PostEffects />
        </Canvas>
      </SceneErrorBoundary>

      <div className="app-overlay">
        <div className="app-overlay-footer">
          <div className="lux-panel lux-status">
            Status: {statusLabel[mode]}
          </div>
        </div>
      </div>
    </div>
  );
}
