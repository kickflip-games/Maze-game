/**
 * Pose interpreter: converts MediaPipe Pose landmarks into directional controls.
 *
 * This version tracks the nose landmark (index 0) and compares it to a calibrated
 * centre point. Movement is triggered when the nose drifts beyond a fixed radius.
 *
 * Coordinates are normalized 0–1, where (0,0) is top-left of the video frame.
 * We flip the X axis to match mirrored camera display (selfie mode).
 */

// Radius threshold (normalized) around the neutral point.
export const DIRECTION_RADIUS = 0.085;
const VELOCITY_THRESHOLD = 1.0; // normalized units per second

// Smoothing: rolling average over this many frames
const HISTORY_SIZE = 6;

let noseHistory = [];

/** Reset smoothing history (call when starting a new calibration or game). */
export function resetPoseHistory() {
  noseHistory = [];
}

/**
 * Interpret a set of pose landmarks into a movement direction.
 *
 * @param {Array} landmarks - Array of {x, y, z, visibility} objects from MediaPipe
 * @param {{ x: number, y: number } | null} calibration - Calibrated neutral body center
 * @param {boolean} [flipX=true] - Flip X axis for mirrored (selfie) camera display
 * @returns {{
 *   direction: 'up'|'down'|'left'|'right'|null,
 *   nose: { x: number, y: number } | null,
 *   visible: boolean,
 *   dx: number,
 *   dy: number,
 *   distance: number,
 *   velocityMagnitude: number,
 *   directionBasis: 'distance'|'velocity'|'none'
 * }}
 */
export function interpretPose(
  landmarks,
  calibration,
  flipX = true,
  directionRadius = DIRECTION_RADIUS
) {
  if (!landmarks || landmarks.length === 0) {
    return {
      direction: null,
      nose: null,
      visible: false,
      dx: 0,
      dy: 0,
      distance: 0,
      velocityMagnitude: 0,
      directionBasis: 'none',
    };
  }

  const nose = landmarks[0];
  if (!nose || (nose.visibility != null && nose.visibility < 0.3)) {
    return { direction: null, nose: null, visible: false, dx: 0, dy: 0, distance: 0 };
  }

  let rawX = nose.x;
  let rawY = nose.y;
  if (flipX) rawX = 1 - rawX;

  const now = performance.now();
  noseHistory.push({ x: rawX, y: rawY, t: now });
  if (noseHistory.length > HISTORY_SIZE) noseHistory.shift();

  const smoothX =
    noseHistory.reduce((sum, point) => sum + point.x, 0) / noseHistory.length;
  const smoothY =
    noseHistory.reduce((sum, point) => sum + point.y, 0) / noseHistory.length;

  const neutral = calibration ?? { x: 0.5, y: 0.5 };

  const dx = smoothX - neutral.x;
  const dy = smoothY - neutral.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const latest = noseHistory[noseHistory.length - 1];
  const prev = noseHistory.length >= 2 ? noseHistory[noseHistory.length - 2] : null;

  let velocityX = 0;
  let velocityY = 0;
  let speed = 0;
  if (prev && latest.t !== prev.t) {
    const dt = (latest.t - prev.t) / 1000;
    if (dt > 0) {
      velocityX = (latest.x - prev.x) / dt;
      velocityY = (latest.y - prev.y) / dt;
      speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
    }
  }

  const axisFromVector = (vx, vy) =>
    Math.abs(vx) >= Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : vy > 0 ? 'down' : 'up';

  const directionByDistance =
    distance > directionRadius ? axisFromVector(dx, dy) : null;
  const directionByVelocity =
    speed > VELOCITY_THRESHOLD ? axisFromVector(velocityX, velocityY) : null;

  let direction = null;
  let directionBasis = 'none';
  if (directionByDistance) {
    direction = directionByDistance;
    directionBasis = 'distance';
  } else if (directionByVelocity) {
    direction = directionByVelocity;
    directionBasis = 'velocity';
  }

  return {
    direction,
    nose: { x: smoothX, y: smoothY },
    visible: true,
    dx,
    dy,
    distance,
    velocityMagnitude: speed,
    directionBasis,
  };
}

/**
 * Compute the body center from landmarks for use during calibration.
 * Returns null if landmarks are insufficient.
 */
export function getBodyCenter(landmarks, flipX = true) {
  if (!landmarks || landmarks.length < 25) return null;

  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];

  const allPresent = [leftShoulder, rightShoulder, leftHip, rightHip].every(
    (lm) => lm != null
  );
  if (!allPresent) return null;

  let x = (leftShoulder.x + rightShoulder.x + leftHip.x + rightHip.x) / 4;
  let y = (leftShoulder.y + rightShoulder.y + leftHip.y + rightHip.y) / 4;

  if (flipX) x = 1 - x;

  return { x, y };
}
