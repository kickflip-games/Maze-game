import { useEffect, useRef, useState } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm';

/**
 * Custom hook that initializes MediaPipe PoseLandmarker and runs a detection
 * loop on the provided video element.
 *
 * @param {{ videoRef: React.RefObject, onPoseResult: Function, enabled: boolean }} options
 * @returns {{ poseStatus: string }}
 */
export function usePoseController({ videoRef, onPoseResult, enabled }) {
  const [poseStatus, setPoseStatus] = useState('loading'); // loading | ready | error
  const poseLandmarkerRef = useRef(null);
  const animFrameRef = useRef(null);
  const lastTimestampRef = useRef(-1);

  // Initialize PoseLandmarker once
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_URL);
        const options = { runningMode: 'VIDEO', numPoses: 1 };

        let landmarker;
        try {
          landmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
            ...options,
          });
        } catch (gpuErr) {
          // GPU delegate unavailable — fall back to CPU
          console.warn('GPU delegate failed, falling back to CPU:', gpuErr);
          landmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
            ...options,
          });
        }

        if (!cancelled) {
          poseLandmarkerRef.current = landmarker;
          setPoseStatus('ready');
        } else {
          landmarker.close();
        }
      } catch (err) {
        console.error('PoseLandmarker initialization failed:', err);
        if (!cancelled) setPoseStatus('error');
      }
    }

    init();

    return () => {
      cancelled = true;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  // Stable callback reference
  const onPoseResultRef = useRef(onPoseResult);
  useEffect(() => {
    onPoseResultRef.current = onPoseResult;
  }, [onPoseResult]);

  // Run detection loop when landmarker is ready and hook is enabled
  useEffect(() => {
    if (poseStatus !== 'ready' || !enabled) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

    function detect() {
      const video = videoRef.current;
      if (
        video &&
        video.readyState >= 2 &&
        poseLandmarkerRef.current
      ) {
        const now = performance.now();
        // Avoid re-processing the same timestamp
        if (now !== lastTimestampRef.current) {
          try {
            const results = poseLandmarkerRef.current.detectForVideo(
              video,
              now
            );
            lastTimestampRef.current = now;
            if (results.landmarks && results.landmarks.length > 0) {
              onPoseResultRef.current(results.landmarks[0]);
            } else {
              onPoseResultRef.current(null);
            }
          } catch {
            // Video may not be ready yet – skip this frame
          }
        }
      }
      animFrameRef.current = requestAnimationFrame(detect);
    }

    animFrameRef.current = requestAnimationFrame(detect);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [poseStatus, enabled, videoRef]);

  return { poseStatus };
}
