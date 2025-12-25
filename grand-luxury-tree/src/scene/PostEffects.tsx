import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BloomEffect, EffectComposer, EffectPass, RenderPass } from 'postprocessing';
import * as THREE from 'three';

export const PostEffects = () => {
  const { gl, scene, camera, size } = useThree();

  const composer = useMemo(() => new EffectComposer(gl), [gl]);
  const bloomEffect = useMemo(
    () =>
      new BloomEffect({
        intensity: 0.8,
        luminanceThreshold: 0.9,
        luminanceSmoothing: 0.08,
        mipmapBlur: true
      }),
    []
  );
  const renderPass = useMemo(() => new RenderPass(scene, camera), [scene, camera]);
  const effectPass = useMemo(() => new EffectPass(camera, bloomEffect), [camera, bloomEffect]);

  useEffect(() => {
    gl.autoClear = false;
  }, [gl]);

  useEffect(() => {
    composer.addPass(renderPass);
    composer.addPass(effectPass);
    return () => {
      composer.removePass(effectPass);
      composer.removePass(renderPass);
      composer.dispose();
    };
  }, [composer, renderPass, effectPass]);

  useEffect(() => {
    const bufferSize = new THREE.Vector2();
    gl.getDrawingBufferSize(bufferSize);
    composer.setSize(bufferSize.x, bufferSize.y);
  }, [composer, size, gl]);

  useFrame((_, delta) => {
    composer.render(delta);
  }, 1);

  return null;
};
