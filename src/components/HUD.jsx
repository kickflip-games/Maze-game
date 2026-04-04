/**
 * HUD (Heads-Up Display) component.
 * Shows pose detection status, calibration state, current direction, and
 * whether the player is visible to the camera.
 */
export default function HUD({ poseStatus, calibrated, direction, visible }) {
  const directionArrow = {
    up: '↑',
    down: '↓',
    left: '←',
    right: '→',
    null: '·',
  };

  return (
    <div className="hud">
      <div className="hud-item">
        <span className="hud-label">Pose</span>
        <span
          className={`hud-value ${poseStatus === 'ready' ? 'status-ok' : poseStatus === 'error' ? 'status-err' : 'status-loading'}`}
        >
          {poseStatus === 'ready'
            ? '✓ Active'
            : poseStatus === 'error'
              ? '✗ Error'
              : '⏳ Loading'}
        </span>
      </div>

      <div className="hud-item">
        <span className="hud-label">Camera</span>
        <span className={`hud-value ${visible ? 'status-ok' : 'status-warn'}`}>
          {visible ? '✓ Visible' : '✗ Not Visible'}
        </span>
      </div>

      <div className="hud-item">
        <span className="hud-label">Calibration</span>
        <span className={`hud-value ${calibrated ? 'status-ok' : 'status-warn'}`}>
          {calibrated ? '✓ Calibrated' : '✗ Not Calibrated'}
        </span>
      </div>

      <div className="hud-item">
        <span className="hud-label">Direction</span>
        <span className="hud-value hud-direction">
          {directionArrow[direction] ?? '·'}
          {direction && <span className="hud-dir-text"> {direction}</span>}
        </span>
      </div>
    </div>
  );
}
