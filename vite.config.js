import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Base path for GitHub Pages deployment at https://avivajpeyi.github.io/Maze-game/
  base: '/Maze-game/',
})
