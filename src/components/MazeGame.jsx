import { useEffect, useRef, useCallback } from 'react';

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
  const lastMoveRef = useRef(0);
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

  // Trigger movement when direction changes
  useEffect(() => {
    if (calibrated && direction) {
      tryMove(direction, playerPos, maze);
    }
  }, [direction, playerPos, maze, calibrated, tryMove]);

  // Draw the maze
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !maze || !playerPos) return;

    const { grid, rows, cols, start, end } = maze;
    const ctx = canvas.getContext('2d');
    const W = cols * CELL_SIZE;
    const H = rows * CELL_SIZE;

    canvas.width = W;
    canvas.height = H;

    // ---- Background ----
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    // ---- Draw maze cells (paths and walls) ----
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * CELL_SIZE;
        const y = r * CELL_SIZE;
        const cell = grid[r][c];

        // Cell floor
        ctx.fillStyle = COLORS.path;
        ctx.fillRect(x + WALL_WIDTH, y + WALL_WIDTH, CELL_SIZE - WALL_WIDTH, CELL_SIZE - WALL_WIDTH);

        // Walls
        ctx.strokeStyle = COLORS.wall;
        ctx.lineWidth = WALL_WIDTH;
        ctx.lineCap = 'square';

        if (cell.walls.top) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + CELL_SIZE, y);
          ctx.stroke();
        }
        if (cell.walls.right) {
          ctx.beginPath();
          ctx.moveTo(x + CELL_SIZE, y);
          ctx.lineTo(x + CELL_SIZE, y + CELL_SIZE);
          ctx.stroke();
        }
        if (cell.walls.bottom) {
          ctx.beginPath();
          ctx.moveTo(x, y + CELL_SIZE);
          ctx.lineTo(x + CELL_SIZE, y + CELL_SIZE);
          ctx.stroke();
        }
        if (cell.walls.left) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + CELL_SIZE);
          ctx.stroke();
        }
      }
    }

    // ---- Draw start marker ----
    {
      const sx = start.col * CELL_SIZE + CELL_SIZE / 2;
      const sy = start.row * CELL_SIZE + CELL_SIZE / 2;
      ctx.fillStyle = COLORS.start;
      ctx.beginPath();
      ctx.arc(sx, sy, CELL_SIZE * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- Draw exit marker ----
    {
      const ex = end.col * CELL_SIZE + CELL_SIZE / 2;
      const ey = end.row * CELL_SIZE + CELL_SIZE / 2;
      const grd = ctx.createRadialGradient(ex, ey, 0, ex, ey, CELL_SIZE * 0.6);
      grd.addColorStop(0, COLORS.exit);
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(ex, ey, CELL_SIZE * 0.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = COLORS.exit;
      ctx.font = `${CELL_SIZE * 0.7}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', ex, ey);
    }

    // ---- Draw player dot ----
    {
      const px = playerPos.col * CELL_SIZE + CELL_SIZE / 2;
      const py = playerPos.row * CELL_SIZE + CELL_SIZE / 2;

      // Glow
      const grd = ctx.createRadialGradient(px, py, 0, px, py, CELL_SIZE * 0.8);
      grd.addColorStop(0, COLORS.playerGlow);
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(px, py, CELL_SIZE * 0.8, 0, Math.PI * 2);
      ctx.fill();

      // Dot
      ctx.fillStyle = COLORS.player;
      ctx.beginPath();
      ctx.arc(px, py, CELL_SIZE * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- Fog of war ----
    const fogX = playerPos.col * CELL_SIZE + CELL_SIZE / 2;
    const fogY = playerPos.row * CELL_SIZE + CELL_SIZE / 2;
    const fogPixelRadius = FOG_RADIUS * CELL_SIZE;

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
  }, [maze, playerPos]);

  if (!maze) return null;

  const canvasWidth = maze.cols * CELL_SIZE;
  const canvasHeight = maze.rows * CELL_SIZE;

  return (
    <div
      className="maze-container"
      style={{
        width: canvasWidth,
        height: canvasHeight,
        position: 'relative',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 0 30px rgba(68, 102, 255, 0.4)',
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </div>
  );
}
