/**
 * Pose interpreter: converts MediaPipe Pose landmarks into directional controls.
 *
 * Landmark indices used:
 *   11 = left shoulder, 12 = right shoulder
 *   23 = left hip,      24 = right hip
 *
 * Body center = average of the four torso landmarks.
 * We compare the current body center to a calibrated baseline to determine
 * which direction the player is leaning.
 *
 * Coordinates are normalized 0–1, where (0,0) is top-left of the video frame.
 * We flip the X axis to match mirrored camera display (selfie mode).
 */

// Thresholds for triggering movement (in normalized units 0–1)
const HORIZONTAL_THRESHOLD = 0.04;
const VERTICAL_THRESHOLD = 0.035;

// Smoothing: rolling average over this many frames
const HISTORY_SIZE = 6;

let positionHistory = [];

/** Reset smoothing history (call when starting a new calibration or game). */
export function resetPoseHistory() {
  positionHistory = [];
}

/**
 * Interpret a set of pose landmarks into a movement direction.
 *
 * @param {Array} landmarks - Array of {x, y, z, visibility} objects from MediaPipe
 * @param {{ x: number, y: number } | null} calibration - Calibrated neutral body center
 * @param {boolean} [flipX=true] - Flip X axis for mirrored (selfie) camera display
 * @returns {{
 *   direction: 'up'|'down'|'left'|'right'|null,
 *   bodyCenter: { x: number, y: number } | null,
 *   visible: boolean,
 *   dx: number,
 *   dy: number
 * }}
 */
export function interpretPose(landmarks, calibration, flipX = true) {
  if (!landmarks || landmarks.length < 25) {
    return { direction: null, bodyCenter: null, visible: false, dx: 0, dy: 0 };
  }

  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];

  // Check that all four torso landmarks are sufficiently visible
  const allVisible = [leftShoulder, rightShoulder, leftHip, rightHip].every(
    (lm) => lm && (lm.visibility == null || lm.visibility > 0.3)
  );

  if (!allVisible) {
    return { direction: null, bodyCenter: null, visible: false, dx: 0, dy: 0 };
  }

  // Compute raw body center from torso landmarks
  let rawX =
    (leftShoulder.x + rightShoulder.x + leftHip.x + rightHip.x) / 4;
  let rawY =
    (leftShoulder.y + rightShoulder.y + leftHip.y + rightHip.y) / 4;

  // Flip X to match mirrored camera display
  if (flipX) rawX = 1 - rawX;

  // Apply rolling average for smoothing
  positionHistory.push({ x: rawX, y: rawY });
  if (positionHistory.length > HISTORY_SIZE) positionHistory.shift();

  const smoothX =
    positionHistory.reduce((s, p) => s + p.x, 0) / positionHistory.length;
  const smoothY =
    positionHistory.reduce((s, p) => s + p.y, 0) / positionHistory.length;

  const bodyCenter = { x: smoothX, y: smoothY };

  // Use provided calibration or fall back to the frame centre (0.5, 0.5),
  // which effectively divides the camera space into directional zones without
  // requiring the user to calibrate manually.
  const neutral = calibration ?? { x: 0.5, y: 0.5 };

  // Deviation from neutral position
  const dx = smoothX - neutral.x;
  const dy = smoothY - neutral.y;

  // Determine direction: pick the axis with the larger deviation,
  // only if it exceeds the threshold for that axis.
  let direction = null;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  if (absX > HORIZONTAL_THRESHOLD || absY > VERTICAL_THRESHOLD) {
    if (absX >= absY) {
      direction = dx > 0 ? 'right' : 'left';
    } else {
      direction = dy > 0 ? 'down' : 'up';
    }
  }

  return { direction, bodyCenter, visible: true, dx, dy };
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
