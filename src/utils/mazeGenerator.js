/**
 * Maze generator using recursive DFS (backtracker) algorithm.
 * Each cell stores which walls are present: top, right, bottom, left.
 */

/**
 * @param {number} cols - Number of columns
 * @param {number} rows - Number of rows
 * @returns {{ grid, rows, cols, start, end }}
 */
export function generateMaze(cols, rows) {
  // Initialize grid: every cell has all 4 walls
  const grid = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      visited: false,
      walls: { top: true, right: true, bottom: true, left: true },
    }))
  );

  function getUnvisitedNeighbors(r, c) {
    const neighbors = [];
    if (r > 0 && !grid[r - 1][c].visited) neighbors.push([r - 1, c, 'top', 'bottom']);
    if (r < rows - 1 && !grid[r + 1][c].visited) neighbors.push([r + 1, c, 'bottom', 'top']);
    if (c > 0 && !grid[r][c - 1].visited) neighbors.push([r, c - 1, 'left', 'right']);
    if (c < cols - 1 && !grid[r][c + 1].visited) neighbors.push([r, c + 1, 'right', 'left']);
    return neighbors;
  }

  // Iterative DFS to avoid stack overflow on large mazes
  const stack = [[0, 0]];
  grid[0][0].visited = true;

  while (stack.length > 0) {
    const [r, c] = stack[stack.length - 1];
    const neighbors = getUnvisitedNeighbors(r, c);

    if (neighbors.length === 0) {
      stack.pop();
    } else {
      // Pick a random neighbor
      const [nr, nc, dir, opposite] =
        neighbors[Math.floor(Math.random() * neighbors.length)];
      // Remove walls between current cell and chosen neighbor
      grid[r][c].walls[dir] = false;
      grid[nr][nc].walls[opposite] = false;
      grid[nr][nc].visited = true;
      stack.push([nr, nc]);
    }
  }

  return {
    grid,
    rows,
    cols,
    start: { row: 0, col: 0 },
    end: { row: rows - 1, col: cols - 1 },
  };
}
