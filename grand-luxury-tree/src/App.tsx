import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { GrandTree, TreeMode } from './scene/GrandTree';
import { PostEffects } from './scene/PostEffects';
import * as THREE from 'three';
import { SceneErrorBoundary } from './scene/SceneErrorBoundary';

const statusLabel: Record<TreeMode, string> = {
  FORMED: 'Formed',
  CHAOS: 'Unleashed'
};

export default function App() {
  const [mode, setMode] = useState<TreeMode>('FORMED');

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

  return (
    <div className="app-shell">
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
            enablePan={false}
            minDistance={6}
            maxDistance={12}
            minPolarAngle={0.55}
            maxPolarAngle={1.45}
            autoRotate
            autoRotateSpeed={0.3}
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
