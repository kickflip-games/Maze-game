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
 *   videoRef    - ref to the <video> element (shared with PoseController)
 *   landmarks   - current pose landmarks array (null if not detected)
 *   width       - display width in pixels
 *   height      - display height in pixels
 *   calibration - neutral body centre { x, y } in normalised [0,1] coords
 *   poseResult  - current interpreted pose { direction, bodyCenter, visible }
 */
export default function WebcamPoseOverlay({
  videoRef,
  landmarks,
  width = 320,
  height = 240,
  calibration = { x: 0.5, y: 0.5 },
  poseResult = { direction: null, bodyCenter: null, visible: false },
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
    const { direction: activeDir, bodyCenter } = poseResult;

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

    // Body centre tracker: line + dot
    if (bodyCenter) {
      const bx = bodyCenter.x * width;
      const by = bodyCenter.y * height;

      // Line from neutral to current body centre
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(bx, by);
      ctx.strokeStyle = activeDir
        ? 'rgba(0,255,136,0.55)'
        : 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // Dot at current body centre
      ctx.save();
      ctx.beginPath();
      ctx.arc(bx, by, 6, 0, Math.PI * 2);
      ctx.fillStyle = activeDir ? '#00ff88' : '#ffffff';
      ctx.shadowColor = activeDir ? '#00ff88' : 'rgba(255,255,255,0.8)';
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
