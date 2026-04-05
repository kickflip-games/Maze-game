# Maze Runner

Maze Runner is a browser game where your body controls a glowing dot through a fog-of-war maze. It uses MediaPipe Pose to track your nose and translate small leans into directional moves without any additional hardware.

## Where to play
[https://avivajpeyi.github.io/Maze-game/](https://avivajpeyi.github.io/Maze-game/)

## Install & run
Requires Node.js 18+ and a webcam-capable device.

```bash
git clone https://github.com/avivajpeyi/Maze-game.git
cd Maze-game
npm install
npm run dev
```

Open `http://localhost:5173/Maze-game/` in a browser (MediaPipe needs a secure context; localhost works fine).
