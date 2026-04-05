import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { usePoseController } from './components/PoseController';
import WebcamPoseOverlay from './components/WebcamPoseOverlay';
import MazeGame from './components/MazeGame';
import { interpretPose, resetPoseHistory } from './utils/poseInterpreter';
import { generateMaze } from './utils/mazeGenerator';
import './App.css';

const DEFAULT_MAZE_SIZE = { cols: 15, rows: 15 };

export default function App() {
  const [cameraError, setCameraError] = useState(null);
  const [landmarks, setLandmarks] = useState(null);
const calibration = useMemo(() => ({ x: 0.5, y: 0.5 }), []);
  const [poseResult, setPoseResult] = useState({
    direction: null,
    nose: null,
    visible: false,
    dx: 0,
    dy: 0,
    distance: 0,
    velocityMagnitude: 0,
    directionBasis: 'none',
  });
  const [directionRadius, setDirectionRadius] = useState(0.085);
  const [maze, setMaze] = useState(null);
  const [playerPos, setPlayerPos] = useState({ row: 0, col: 0 });
  const [elapsedTime, setElapsedTime] = useState(0);
  const [hasWon, setHasWon] = useState(false);

  const gameStartTimeRef = useRef(null);
  const videoRef = useRef(null);
  const cameraStartedRef = useRef(false);
  const streamRef = useRef(null);

  const startCamera = useCallback(async () => {
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
  }, []);

  const handlePoseResult = useCallback(
    (rawLandmarks) => {
      setLandmarks(rawLandmarks);
      const result = interpretPose(
        rawLandmarks,
        calibration,
        true,
        directionRadius
      );
      setPoseResult(result);
    },
    [calibration, directionRadius]
  );

  const startGame = useCallback(() => {
    const { cols, rows } = DEFAULT_MAZE_SIZE;
    const newMaze = generateMaze(cols, rows);
    resetPoseHistory();
    setMaze(newMaze);
    setPlayerPos({ row: 0, col: 0 });
    gameStartTimeRef.current = Date.now();
    setElapsedTime(0);
    setHasWon(false);
  }, []);

  const handlePlayerMove = useCallback(
    (newPos) => {
      setPlayerPos(newPos);
      if (
        maze &&
        newPos.row === maze.end.row &&
        newPos.col === maze.end.col
      ) {
        setElapsedTime(
          Math.floor((Date.now() - gameStartTimeRef.current) / 1000)
        );
        setHasWon(true);
      }
    },
    [maze]
  );

  useEffect(() => {
    startCamera();
    startGame();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        cameraStartedRef.current = false;
      }
    };
  }, [startCamera, startGame]);

  useEffect(() => {
    if (!maze || hasWon) return;
    const interval = setInterval(() => {
      if (gameStartTimeRef.current) {
        setElapsedTime(
          Math.floor((Date.now() - gameStartTimeRef.current) / 1000)
        );
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [maze, hasWon]);

  const poseEnabled = !!maze;
  usePoseController({
    videoRef,
    onPoseResult: handlePoseResult,
    enabled: poseEnabled,
  });

  return (
    <div className="screen game-screen">
      <header className="game-header">
        <h1 className="game-title-small">Maze Runner</h1>
        <div className="timer">⏱ {formatTime(elapsedTime)}</div>
      </header>

      {cameraError && (
        <div className="error-box">
          <p>⚠️ Camera error: {cameraError}</p>
          <p>Please allow camera access and refresh.</p>
        </div>
      )}

      <div className="game-layout">
          <div className="panel-left">
            <WebcamPoseOverlay
              videoRef={videoRef}
              landmarks={landmarks}
              width={320}
              height={240}
              calibration={calibration}
              poseResult={poseResult}
              directionRadius={directionRadius}
            />
          <div className="controls-panel">
            <button className="btn btn-outline btn-full" onClick={startGame}>
              🔁 New Maze
            </button>
            <div className="slider-control">
              <label>
                Movement deadzone
                <span>{(directionRadius * 100).toFixed(1)}%</span>
              </label>
              <input
                type="range"
                min="0.03"
                max="0.18"
                step="0.005"
                value={directionRadius}
                onChange={(event) =>
                  setDirectionRadius(parseFloat(event.target.value))
                }
              />
            </div>
          </div>
        </div>

        <div className="panel-right">
          {maze && (
            <div style={{ position: 'relative' }}>
              <MazeGame
                maze={maze}
                playerPos={playerPos}
                onMove={handlePlayerMove}
                direction={poseResult.direction}
                calibrated={true}
              />

              {hasWon && (
                <div className="win-overlay">
                  <div className="win-content">
                    <div className="win-emoji">🏆</div>
                    <h2>You Win!</h2>
                    <p>
                      Completed in <strong>{formatTime(elapsedTime)}</strong>
                    </p>
                    <button className="btn btn-primary" onClick={startGame}>
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
