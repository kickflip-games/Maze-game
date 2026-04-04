import { useEffect, useRef } from 'react';

/**
 * MediaPipe Pose skeleton connections (pairs of landmark indices).
 * Covering the main body: face, arms, torso, legs.
 */
const POSE_CONNECTIONS = [
  // Face
  [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
  // Shoulders
  [11, 12],
  // Left arm
  [11, 13], [13, 15],
  // Right arm
  [12, 14], [14, 16],
  // Torso
  [11, 23], [12, 24], [23, 24],
  // Left leg
  [23, 25], [25, 27], [27, 29], [29, 31],
  // Right leg
  [24, 26], [26, 28], [28, 30], [30, 32],
];

/**
 * Shows a webcam feed with a MediaPipe Pose skeleton overlay drawn on a canvas.
 *
 * Props:
 *   videoRef   - ref to the <video> element (shared with PoseController)
 *   landmarks  - current pose landmarks array (null if not detected)
 *   width      - display width in pixels
 *   height     - display height in pixels
 */
export default function WebcamPoseOverlay({
  videoRef,
  landmarks,
  width = 320,
  height = 240,
}) {
  const canvasRef = useRef(null);

  // Draw skeleton overlay whenever landmarks change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    if (!landmarks || landmarks.length === 0) return;

    // Landmarks are normalized [0,1]. The video is displayed mirrored
    // (CSS scaleX(-1)), so we mirror the X coordinate when drawing on canvas.
    function toCanvas(lm) {
      return {
        x: (1 - lm.x) * width,
        y: lm.y * height,
      };
    }

    // Draw skeleton lines
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    for (const [a, b] of POSE_CONNECTIONS) {
      const lmA = landmarks[a];
      const lmB = landmarks[b];
      if (!lmA || !lmB) continue;
      // Skip low-visibility landmarks
      if (
        (lmA.visibility != null && lmA.visibility < 0.3) ||
        (lmB.visibility != null && lmB.visibility < 0.3)
      ) {
        continue;
      }
      const pa = toCanvas(lmA);
      const pb = toCanvas(lmB);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }

    // Draw joint dots
    ctx.fillStyle = '#ffff00';
    for (const lm of landmarks) {
      if (!lm) continue;
      if (lm.visibility != null && lm.visibility < 0.3) continue;
      const p = toCanvas(lm);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [landmarks, width, height]);

  return (
    <div
      className="webcam-overlay-container"
      style={{ width, height, position: 'relative', display: 'inline-block' }}
    >
      {/* Video is mirrored for natural selfie-camera feel */}
      <video
        ref={videoRef}
        width={width}
        height={height}
        autoPlay
        playsInline
        muted
        style={{
          transform: 'scaleX(-1)',
          display: 'block',
          borderRadius: '8px',
        }}
      />
      {/* Canvas overlay for skeleton */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          borderRadius: '8px',
        }}
      />
    </div>
  );
}
