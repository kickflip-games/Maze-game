import { useEffect, useRef, useCallback, useState } from 'react';

const CELL_SIZE = 30;
const WALL_WIDTH = 2;
const FOG_RADIUS = 3.5; // cells

const COLORS = {
  bg: '#0a0a1a',
  wall: '#4466ff',
  path: '#111133',
  fog: 'rgba(0, 0, 0, 0.92)',
  player: '#ff4444',
  playerGlow: 'rgba(255, 68, 68, 0.4)',
  start: '#44ff88',
  exit: '#ffdd00',
  exitGlow: 'rgba(255, 221, 0, 0.4)',
};

/**
 * Renders a 2D maze on an HTML canvas with fog-of-war around the player.
 *
 * Props:
 *   maze       - maze object from generateMaze()
 *   playerPos  - { row, col }
 *   onMove     - callback(newPos) when player moves
 *   direction  - current movement direction ('up'|'down'|'left'|'right'|null)
 *   calibrated - whether pose has been calibrated
 */
export default function MazeGame({
  maze,
  playerPos,
  onMove,
  direction,
  calibrated,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [cellSize, setCellSize] = useState(CELL_SIZE);
  const lastMoveRef = useRef(0);
  const moveIntervalRef = useRef(null);
  const playerRef = useRef(playerPos);
  const mazeRef = useRef(maze);
  const MOVE_COOLDOWN = 160; // ms between moves

  // Attempt to move the player in the given direction
  const tryMove = useCallback(
    (dir, pos, mazeData) => {
      if (!dir || !pos || !mazeData) return;

      const now = performance.now();
      if (now - lastMoveRef.current < MOVE_COOLDOWN) return;

      const { row, col } = pos;
      const cell = mazeData.grid[row][col];

      let newRow = row;
      let newCol = col;

      if (dir === 'up' && !cell.walls.top) newRow -= 1;
      else if (dir === 'down' && !cell.walls.bottom) newRow += 1;
      else if (dir === 'left' && !cell.walls.left) newCol -= 1;
      else if (dir === 'right' && !cell.walls.right) newCol += 1;

      if (newRow !== row || newCol !== col) {
        lastMoveRef.current = now;
        onMove({ row: newRow, col: newCol });
      }
    },
    [onMove]
  );

  useEffect(() => {
    playerRef.current = playerPos;
  }, [playerPos]);

  useEffect(() => {
    mazeRef.current = maze;
  }, [maze]);

  useEffect(() => {
    if (moveIntervalRef.current) {
      clearInterval(moveIntervalRef.current);
      moveIntervalRef.current = null;
    }

    if (!calibrated || !direction) {
      return;
    }

    tryMove(direction, playerRef.current, mazeRef.current);

    moveIntervalRef.current = setInterval(() => {
      tryMove(direction, playerRef.current, mazeRef.current);
    }, MOVE_COOLDOWN);

    return () => {
      if (moveIntervalRef.current) {
        clearInterval(moveIntervalRef.current);
        moveIntervalRef.current = null;
      }
    };
  }, [direction, calibrated, tryMove]);

  useEffect(() => {
    if (!maze || !containerRef.current) return;

    const updateSize = () => {
      const wrapper = containerRef.current;
      if (!wrapper) return;
      const available = wrapper.clientWidth;
      if (available <= 0) return;
      const maxCell = Math.max(20, Math.min(60, available / maze.cols));
      setCellSize(maxCell);
    };

    updateSize();
    if (typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(() => {
      updateSize();
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [maze?.cols]);

  // Draw the maze
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !maze || !playerPos) return;

    const { grid, rows, cols, start, end } = maze;
    const ctx = canvas.getContext('2d');
    const W = cols * cellSize;
    const H = rows * cellSize;

    canvas.width = W;
    canvas.height = H;
    canvas.style.width = '100%';
    canvas.style.height = `${H}px`;

    // ---- Background ----
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    // ---- Draw maze cells (paths and walls) ----
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cellSize;
        const y = r * cellSize;
        const cell = grid[r][c];

        // Cell floor
        ctx.fillStyle = COLORS.path;
        ctx.fillRect(x + WALL_WIDTH, y + WALL_WIDTH, cellSize - WALL_WIDTH, cellSize - WALL_WIDTH);

        // Walls
        ctx.strokeStyle = COLORS.wall;
        ctx.lineWidth = WALL_WIDTH;
        ctx.lineCap = 'square';

        if (cell.walls.top) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + cellSize, y);
          ctx.stroke();
        }
        if (cell.walls.right) {
          ctx.beginPath();
          ctx.moveTo(x + cellSize, y);
          ctx.lineTo(x + cellSize, y + cellSize);
          ctx.stroke();
        }
        if (cell.walls.bottom) {
          ctx.beginPath();
          ctx.moveTo(x, y + cellSize);
          ctx.lineTo(x + cellSize, y + cellSize);
          ctx.stroke();
        }
        if (cell.walls.left) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + cellSize);
          ctx.stroke();
        }
      }
    }

    // ---- Draw start marker ----
    {
      const sx = start.col * cellSize + cellSize / 2;
      const sy = start.row * cellSize + cellSize / 2;
      ctx.fillStyle = COLORS.start;
      ctx.beginPath();
      ctx.arc(sx, sy, cellSize * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- Draw exit marker ----
    {
      const ex = end.col * cellSize + cellSize / 2;
      const ey = end.row * cellSize + cellSize / 2;
      const grd = ctx.createRadialGradient(ex, ey, 0, ex, ey, cellSize * 0.6);
      grd.addColorStop(0, COLORS.exit);
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(ex, ey, cellSize * 0.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = COLORS.exit;
      ctx.font = `${cellSize * 0.7}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', ex, ey);
    }

    // ---- Draw player dot ----
    {
      const px = playerPos.col * cellSize + cellSize / 2;
      const py = playerPos.row * cellSize + cellSize / 2;

      // Glow
      const grd = ctx.createRadialGradient(px, py, 0, px, py, cellSize * 0.8);
      grd.addColorStop(0, COLORS.playerGlow);
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(px, py, cellSize * 0.8, 0, Math.PI * 2);
      ctx.fill();

      // Dot
      ctx.fillStyle = COLORS.player;
      ctx.beginPath();
      ctx.arc(px, py, cellSize * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- Fog of war ----
    const fogX = playerPos.col * cellSize + cellSize / 2;
    const fogY = playerPos.row * cellSize + cellSize / 2;
    const fogPixelRadius = FOG_RADIUS * cellSize;

    // Dark overlay with radial cutout around the player
    ctx.save();
    ctx.fillStyle = COLORS.fog;
    ctx.beginPath();
    // Outer rectangle
    ctx.rect(0, 0, W, H);
    // Inner circle (subtractive via even-odd fill)
    ctx.arc(fogX, fogY, fogPixelRadius, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill('evenodd');
    ctx.restore();
  }, [maze, playerPos, cellSize]);

  if (!maze) return null;

  const canvasHeight = maze.rows * cellSize;

  return (
    <div
      ref={containerRef}
      className="maze-container"
      style={{
        width: '100%',
        height: canvasHeight,
        position: 'relative',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 0 30px rgba(68, 102, 255, 0.4)',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  );
}
