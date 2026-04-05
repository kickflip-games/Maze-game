import { useEffect, useRef } from 'react';
import { DIRECTION_RADIUS } from '../utils/poseInterpreter';

/**
 * MediaPipe Pose skeleton connections (pairs of landmark indices).
 * Covers the head, spine, and legs while omitting arm/hand joints.
 */
const FACE_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
];

const FACE_LANDMARKS = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8]);

/**
 * Shows a webcam feed with a MediaPipe Pose skeleton overlay drawn on a canvas.
 *
 * Props:
 *   videoRef    - ref to the <video> element (shared with PoseController)
 *   landmarks   - current pose landmarks array (null if not detected)
 *   width       - display width in pixels
 *   height      - display height in pixels
 *   calibration - neutral body centre { x, y } in normalised [0,1] coords
 *   poseResult  - current interpreted pose { direction, nose, visible, distance }
 */
export default function WebcamPoseOverlay({
  videoRef,
  landmarks,
  width = 320,
  height = 240,
  calibration = { x: 0.5, y: 0.5 },
  poseResult = { direction: null, nose: null, visible: false, distance: 0 },
  directionRadius = DIRECTION_RADIUS,
}) {
  const canvasRef = useRef(null);

  // Draw guides + skeleton overlay whenever pose state or landmarks change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    // ── Directional guide overlay ─────────────────────────────────────────
    const cx = calibration.x * width;
    const cy = calibration.y * height;
    const { direction: activeDir, nose, distance = 0 } = poseResult;
    const thresholdRadius = directionRadius * Math.min(width, height);
    const noseOutside = distance > directionRadius;
    const distanceRadius = Math.min(distance, 0.55) * Math.min(width, height);

    // Faint cross-hair lines dividing the frame into 4 movement zones
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(width, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, height);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Direction labels at each edge
    const zones = [
      { name: 'up',    label: '↑ UP',    x: cx,           y: 14 },
      { name: 'down',  label: '↓ DOWN',  x: cx,           y: height - 10 },
      { name: 'left',  label: '← LEFT',  x: 30,           y: cy },
      { name: 'right', label: 'RIGHT →', x: width - 30,   y: cy },
    ];

    for (const z of zones) {
      const active = activeDir === z.name;
      ctx.save();
      ctx.font = `bold ${active ? 14 : 12}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (active) {
        // Highlight pill behind active label
        const tw = ctx.measureText(z.label).width;
        ctx.fillStyle = 'rgba(0,255,136,0.25)';
        ctx.beginPath();
        ctx.roundRect(z.x - tw / 2 - 5, z.y - 10, tw + 10, 20, 4);
        ctx.fill();
        ctx.fillStyle = '#00ff88';
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 14;
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
      }
      ctx.fillText(z.label, z.x, z.y);
      ctx.restore();
    }

    // Neutral point crosshair
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    const arm = 9;
    ctx.beginPath();
    ctx.moveTo(cx - arm, cy);
    ctx.lineTo(cx + arm, cy);
    ctx.moveTo(cx, cy - arm);
    ctx.lineTo(cx, cy + arm);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fill();
    ctx.restore();

    // Movement threshold circle
    ctx.save();
    ctx.strokeStyle = noseOutside
      ? 'rgba(0,255,136,0.55)'
      : 'rgba(255,255,255,0.35)';
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(cx, cy, thresholdRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    if (distanceRadius > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.arc(cx, cy, distanceRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Nose tracker: line + dot
    if (nose) {
      const nx = nose.x * width;
      const ny = nose.y * height;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(nx, ny);
      ctx.strokeStyle = noseOutside
        ? 'rgba(0,255,136,0.55)'
        : 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.arc(nx, ny, 6, 0, Math.PI * 2);
      ctx.fillStyle = noseOutside ? '#00ff88' : '#ffffff';
      ctx.shadowColor = noseOutside
        ? '#00ff88'
        : 'rgba(255,255,255,0.8)';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.restore();
    }
    // ── End directional guides ────────────────────────────────────────────

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
    for (const [a, b] of FACE_CONNECTIONS) {
      const lmA = landmarks[a];
      const lmB = landmarks[b];
      if (!lmA || !lmB) continue;
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

    // Draw face landmarks
    ctx.fillStyle = '#ffff00';
    landmarks.forEach((lm, index) => {
      if (!lm) return;
      if (!FACE_LANDMARKS.has(index)) return;
      if (lm.visibility != null && lm.visibility < 0.3) return;
      const p = toCanvas(lm);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [landmarks, calibration, poseResult, width, height]);

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
