import { useState, useRef, useCallback, useEffect } from 'react';
import { usePoseController } from './components/PoseController';
import WebcamPoseOverlay from './components/WebcamPoseOverlay';
import MazeGame from './components/MazeGame';
import HUD from './components/HUD';
import {
  interpretPose,
  getBodyCenter,
  resetPoseHistory,
} from './utils/poseInterpreter';
import { generateMaze } from './utils/mazeGenerator';
import './App.css';

// Maze dimensions by difficulty
const DIFFICULTY = {
  easy: { cols: 10, rows: 10, label: 'Easy (10×10)' },
  medium: { cols: 15, rows: 15, label: 'Medium (15×15)' },
  hard: { cols: 20, rows: 20, label: 'Hard (20×20)' },
};

export default function App() {
  // App screens: 'start' | 'permission' | 'calibrate' | 'game' | 'win'
  const [screen, setScreen] = useState('start');
  const [difficulty, setDifficulty] = useState('medium');
  const [cameraError, setCameraError] = useState(null);

  // Pose state
  const [landmarks, setLandmarks] = useState(null);
  const [calibration, setCalibration] = useState(null);
  const [calibrated, setCalibrated] = useState(false);

  // Interpreted pose direction
  const [poseResult, setPoseResult] = useState({
    direction: null,
    bodyCenter: null,
    visible: false,
    dx: 0,
    dy: 0,
  });

  // Game state
  const [maze, setMaze] = useState(null);
  const [playerPos, setPlayerPos] = useState({ row: 0, col: 0 });
  const [elapsedTime, setElapsedTime] = useState(0);
  const gameStartTimeRef = useRef(null);

  const videoRef = useRef(null);
  const cameraStartedRef = useRef(false);
  const streamRef = useRef(null);

  // ---- Webcam access ----
  async function startCamera() {
    if (cameraStartedRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        cameraStartedRef.current = true;
      }
    } catch (err) {
      setCameraError(err.message || 'Camera access denied');
    }
  }

  // Re-attach the stream whenever the active screen (and thus the <video> element) changes.
  useEffect(() => {
    // Stop tracks and reset when returning to start screen.
    if (screen === 'start') {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        cameraStartedRef.current = false;
      }
      return;
    }
    if (streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [screen]);

  // ---- Pose detection callback ----
  const handlePoseResult = useCallback(
    (rawLandmarks) => {
      setLandmarks(rawLandmarks);
      const result = interpretPose(rawLandmarks, calibrated ? calibration : null);
      setPoseResult(result);
    },
    [calibration, calibrated]
  );

  const poseEnabled =
    screen === 'calibrate' || screen === 'game' || screen === 'win';

  const { poseStatus } = usePoseController({
    videoRef,
    onPoseResult: handlePoseResult,
    enabled: poseEnabled,
  });

  // ---- Calibration ----
  function handleCalibrate() {
    const center = getBodyCenter(landmarks);
    if (center) {
      resetPoseHistory();
      setCalibration(center);
      setCalibrated(true);
    }
  }

  // ---- Start game ----
  function startGame() {
    const { cols, rows } = DIFFICULTY[difficulty];
    const newMaze = generateMaze(cols, rows);
    resetPoseHistory();
    setMaze(newMaze);
    setPlayerPos({ row: 0, col: 0 });
    gameStartTimeRef.current = Date.now();
    setElapsedTime(0);
    setScreen('game');
  }

  // ---- Timer ----
  useEffect(() => {
    if (screen !== 'game') return;
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - gameStartTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [screen]);

  // ---- Win detection ----
  function handlePlayerMove(newPos) {
    setPlayerPos(newPos);
    if (
      maze &&
      newPos.row === maze.end.row &&
      newPos.col === maze.end.col
    ) {
      setElapsedTime(Math.floor((Date.now() - gameStartTimeRef.current) / 1000));
      setScreen('win');
    }
  }

  // ---- Screen: Start ----
  if (screen === 'start') {
    return (
      <div className="screen start-screen">
        <div className="start-content">
          <h1 className="game-title">🌀 Maze Runner</h1>
          <p className="game-subtitle">
            Navigate a maze using your body — no keyboard required!
          </p>

          <div className="instructions-box">
            <h3>How to Play</h3>
            <ul>
              <li>
                🧍 Stand in front of your webcam so your full upper body is
                visible
              </li>
              <li>⬅️ Lean left to move left, right to move right</li>
              <li>⬆️ Stand taller to move up, crouch to move down</li>
              <li>🌫️ The maze is hidden — only a small area around you is visible</li>
              <li>⭐ Find the star to win!</li>
            </ul>
          </div>

          <div className="difficulty-select">
            <label>Difficulty:</label>
            <div className="difficulty-buttons">
              {Object.entries(DIFFICULTY).map(([key, val]) => (
                <button
                  key={key}
                  className={`btn ${difficulty === key ? 'btn-active' : 'btn-outline'}`}
                  onClick={() => setDifficulty(key)}
                >
                  {val.label}
                </button>
              ))}
            </div>
          </div>

          <button
            className="btn btn-primary btn-large"
            onClick={() => {
              setScreen('permission');
              // Slight delay so video ref is mounted
              setTimeout(startCamera, 200);
            }}
          >
            Start Game →
          </button>
        </div>
      </div>
    );
  }

  // ---- Screen: Permission / Camera Setup ----
  if (screen === 'permission') {
    return (
      <div className="screen permission-screen">
        <div className="start-content">
          <h2>📷 Camera Access</h2>

          {cameraError ? (
            <div className="error-box">
              <p>⚠️ Camera error: {cameraError}</p>
              <p>Please allow camera access and refresh the page.</p>
            </div>
          ) : (
            <>
              <p>
                Allow camera access when prompted. Your webcam feed will be
                used locally — nothing is sent to any server.
              </p>
              <div className="webcam-preview">
                {/* Hidden video – just for initialization */}
                <video
                  ref={videoRef}
                  width={320}
                  height={240}
                  autoPlay
                  playsInline
                  muted
                  style={{ transform: 'scaleX(-1)', borderRadius: '8px' }}
                  onCanPlay={() => setScreen('calibrate')}
                />
              </div>
              <p className="hint">Waiting for camera…</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // ---- Screens: Calibrate / Game / Win (share layout) ----
  const showCalibrateOverlay = screen === 'calibrate';
  const showWinOverlay = screen === 'win';

  return (
    <div className="screen game-screen">
      <header className="game-header">
        <h1 className="game-title-small">🌀 Maze Runner</h1>
        {screen === 'game' && (
          <div className="timer">⏱ {formatTime(elapsedTime)}</div>
        )}
        {screen === 'win' && (
          <div className="timer win-time">
            🏆 {formatTime(elapsedTime)}
          </div>
        )}
        <button
          className="btn btn-outline btn-small"
          onClick={() => {
            setScreen('start');
            setCalibrated(false);
            setCalibration(null);
            setMaze(null);
          }}
        >
          ↩ Menu
        </button>
      </header>

      <HUD
        poseStatus={poseStatus}
        calibrated={calibrated}
        direction={screen === 'game' ? poseResult.direction : null}
        visible={poseResult.visible}
      />

      <div className="game-layout">
        {/* Left panel: webcam */}
        <div className="panel-left">
          <h3 className="panel-title">📷 Camera</h3>
          <WebcamPoseOverlay
            videoRef={videoRef}
            landmarks={landmarks}
            width={320}
            height={240}
          />

          <div className="controls-panel">
            <button
              className={`btn ${poseResult.visible ? 'btn-primary' : 'btn-disabled'} btn-full`}
              onClick={handleCalibrate}
              disabled={!poseResult.visible}
            >
              {calibrated ? '🔄 Recalibrate' : '🎯 Calibrate'}
            </button>

            {calibrated && screen === 'calibrate' && (
              <button
                className="btn btn-success btn-full"
                onClick={startGame}
              >
                🚀 Start Game!
              </button>
            )}

            {(screen === 'game' || screen === 'win') && (
              <button
                className="btn btn-outline btn-full"
                onClick={startGame}
              >
                🔁 New Maze
              </button>
            )}
          </div>

          {screen === 'calibrate' && (
            <div className="calibrate-instructions">
              <h4>Calibration</h4>
              <ol>
                <li>Stand naturally in front of the camera</li>
                <li>Make sure your upper body is fully visible</li>
                <li>Click <strong>Calibrate</strong> to set your neutral position</li>
                <li>Click <strong>Start Game!</strong> to begin</li>
              </ol>
            </div>
          )}
        </div>

        {/* Right panel: maze */}
        <div className="panel-right">
          <h3 className="panel-title">
            🗺️ Maze
            {maze && (
              <span className="maze-size">
                {' '}({maze.cols}×{maze.rows})
              </span>
            )}
          </h3>

          {showCalibrateOverlay && (
            <div className="maze-placeholder">
              <div className="placeholder-text">
                <p>🎯 Calibrate your pose to start!</p>
                <p className="hint">
                  {poseResult.visible
                    ? 'Body detected — click Calibrate'
                    : 'Stand in front of the camera'}
                </p>
              </div>
            </div>
          )}

          {(screen === 'game' || screen === 'win') && maze && (
            <div style={{ position: 'relative' }}>
              <MazeGame
                maze={maze}
                playerPos={playerPos}
                onMove={handlePlayerMove}
                direction={poseResult.direction}
                calibrated={calibrated}
              />

              {showWinOverlay && (
                <div className="win-overlay">
                  <div className="win-content">
                    <div className="win-emoji">🏆</div>
                    <h2>You Win!</h2>
                    <p>
                      Completed in <strong>{formatTime(elapsedTime)}</strong>
                    </p>
                    <button
                      className="btn btn-primary"
                      onClick={startGame}
                    >
                      Play Again
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
