import { useEffect, useRef, useState } from 'react';
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

type HandGesture = 'open' | 'closed' | 'unknown';

type HandMoveState = {
  x: number;
  y: number;
  active: boolean;
};

type HandGestureControllerProps = {
  onGesture: (gesture: HandGesture) => void;
  onMove: (state: HandMoveState) => void;
  onActiveChange?: (active: boolean) => void;
  showPreview?: boolean;
};

type HandResults = {
  multiHandLandmarks?: Array<Array<{ x: number; y: number }>>;
  multiHandedness?: Array<{ label?: string }>;
};

const MIN_GESTURE_FRAMES = 3;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const getGesture = (
  results: HandResults
): { gesture: HandGesture; center: { x: number; y: number } } => {
  const landmarks = results.multiHandLandmarks?.[0];
  if (!landmarks) {
    return { gesture: 'unknown', center: { x: 0.5, y: 0.5 } };
  }

  const fingerTips = [8, 12, 16, 20];
  const fingerPips = [6, 10, 14, 18];
  let extendedCount = 0;

  fingerTips.forEach((tip, index) => {
    const pip = fingerPips[index];
    if (landmarks[tip].y < landmarks[pip].y - 0.02) {
      extendedCount += 1;
    }
  });

  const thumbTip = landmarks[4];
  const thumbIp = landmarks[3];
  const handLabel = results.multiHandedness?.[0]?.label ?? 'Right';
  const thumbExtended =
    handLabel === 'Left' ? thumbTip.x > thumbIp.x + 0.01 : thumbTip.x < thumbIp.x - 0.01;

  const openFingers = extendedCount + (thumbExtended ? 1 : 0);
  let gesture: HandGesture = 'unknown';
  if (openFingers >= 4) {
    gesture = 'open';
  } else if (openFingers <= 1) {
    gesture = 'closed';
  } else {
    const wrist = landmarks[0];
    const middleMcp = landmarks[9];
    const palmSize = Math.max(0.08, distance(wrist, middleMcp));
    const tipDistances = fingerTips.map((tip) => distance(wrist, landmarks[tip]));
    const avgTipDistance = tipDistances.reduce((sum, value) => sum + value, 0) / tipDistances.length;
    if (avgTipDistance > palmSize * 1.65) {
      gesture = 'open';
    } else if (avgTipDistance < palmSize * 1.15) {
      gesture = 'closed';
    }
  }

  const palmPoints = [0, 5, 9, 13, 17];
  const center = palmPoints.reduce(
    (acc, index) => {
      acc.x += landmarks[index].x;
      acc.y += landmarks[index].y;
      return acc;
    },
    { x: 0, y: 0 }
  );
  center.x /= palmPoints.length;
  center.y /= palmPoints.length;

  return { gesture, center };
};

export const HandGestureController = ({
  onGesture,
  onMove,
  onActiveChange,
  showPreview = true
}: HandGestureControllerProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const lastGestureRef = useRef<HandGesture>('unknown');
  const stableGestureRef = useRef<HandGesture>('unknown');
  const stableFramesRef = useRef(0);
  const activeRef = useRef(false);
  const [status, setStatus] = useState('Camera idle');
  const [gestureLabel, setGestureLabel] = useState('No hand');
  const statusRef = useRef(status);
  const gestureLabelRef = useRef(gestureLabel);
  const startedRef = useRef(false);

  useEffect(() => {
    let hands: Hands | null = null;
    let cancelled = false;

    const start = async () => {
      try {
        if (cancelled || startedRef.current) return;
        const video = videoRef.current;
        if (!video) {
          requestAnimationFrame(start);
          return;
        }
        startedRef.current = true;
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;

        hands = new Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });
        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
          selfieMode: true
        });

        hands.onResults((results) => {
          if (cancelled) return;
          const hasHand = Boolean(results.multiHandLandmarks?.length);
          if (hasHand !== activeRef.current) {
            activeRef.current = hasHand;
            onActiveChange?.(hasHand);
          }

          if (!hasHand) {
            onMove({ x: 0, y: 0, active: false });
            stableGestureRef.current = 'unknown';
            stableFramesRef.current = 0;
            if (gestureLabelRef.current !== 'No hand') {
              gestureLabelRef.current = 'No hand';
              setGestureLabel('No hand');
            }
            return;
          }

          const { gesture, center } = getGesture(results);
          const moveX = clamp((center.x - 0.5) * 2, -1, 1);
          const moveY = clamp((center.y - 0.5) * 2, -1, 1);
          onMove({ x: moveX, y: moveY, active: true });
          const label =
            gesture === 'open' ? 'Open hand' : gesture === 'closed' ? 'Closed hand' : 'Hand detected';
          if (gestureLabelRef.current !== label) {
            gestureLabelRef.current = label;
            setGestureLabel(label);
          }

          if (gesture !== stableGestureRef.current) {
            stableGestureRef.current = gesture;
            stableFramesRef.current = 1;
          } else {
            stableFramesRef.current += 1;
          }

          if (
            gesture !== 'unknown' &&
            stableFramesRef.current >= MIN_GESTURE_FRAMES &&
            gesture !== lastGestureRef.current
          ) {
            lastGestureRef.current = gesture;
            onGesture(gesture);
          }
        });

        cameraRef.current = new Camera(video, {
          onFrame: async () => {
            if (!hands) return;
            await hands.send({ image: video });
          },
          width: 640,
          height: 480
        });

        if (statusRef.current !== 'Camera active') {
          statusRef.current = 'Camera active';
          setStatus('Camera active');
        }
        await cameraRef.current.start();
      } catch (error) {
        startedRef.current = false;
        onActiveChange?.(false);
        onMove({ x: 0, y: 0, active: false });
        if (statusRef.current !== 'Camera error') {
          statusRef.current = 'Camera error';
          setStatus('Camera error');
        }
        console.error('Failed to start hand tracking.', error);
      }
    };

    start();

    return () => {
      cancelled = true;
      cameraRef.current?.stop();
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
      hands?.close();
      startedRef.current = false;
    };
  }, [onActiveChange, onGesture, onMove]);

  if (!showPreview) return null;

  return (
    <div className="gesture-preview-panel">
      <video ref={videoRef} className="gesture-preview-video" />
      <div className="gesture-preview-label">
        <div>{status}</div>
        <div>{gestureLabel}</div>
      </div>
    </div>
  );
};
