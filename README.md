# 🌀 Maze Runner — Body-Controlled Maze Game

A React web game where you control a dot through a fog-of-war maze using your **real body movements**, detected in real-time via [Google MediaPipe Pose](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker).

🎮 **[Play it live on GitHub Pages](https://avivajpeyi.github.io/Maze-game/)**

---

## How to Play

1. Allow camera access in your browser
2. **Calibrate** — stand naturally in front of the camera and click _Calibrate_ to set your neutral position
3. **Move** — lean your body to navigate the dot through the maze:
   - **Lean left** → move left
   - **Lean right** → move right
   - **Stand taller / raise up** → move up
   - **Crouch / lower** → move down
4. Find the ⭐ to win! The maze is hidden — only a small area around you is visible.

---

## Features

- 🎥 Real-time body tracking via MediaPipe Pose (runs entirely in the browser)
- 🌫️ Fog-of-war: only a circular radius around the player is visible
- 🎯 Calibration step to set your neutral position
- 🏆 Win detection with elapsed timer
- 📊 HUD showing pose status, calibration, and current direction
- 🎚️ Three difficulty levels: Easy (10×10), Medium (15×15), Hard (20×20)
- 🦴 Live webcam overlay with pose skeleton drawn on screen

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| [React 19](https://react.dev) | UI framework |
| [Vite 8](https://vite.dev) | Build tool & dev server |
| [@mediapipe/tasks-vision](https://www.npmjs.com/package/@mediapipe/tasks-vision) | Pose detection |
| HTML Canvas | Maze rendering + fog-of-war |

---

## Local Development

### Prerequisites
- Node.js 18+ (LTS recommended)
- A device with a webcam

### Setup

```bash
# Clone the repository
git clone https://github.com/avivajpeyi/Maze-game.git
cd Maze-game

# Install dependencies
npm install

# Start the development server
npm run dev
```

Then open http://localhost:5173/Maze-game/ in your browser.

> **Note:** MediaPipe requires a secure context (HTTPS or localhost). The Vite dev server on `localhost` works fine.

### Build for production

```bash
npm run build
```

The built files will be in the `dist/` directory.

### Deploy to GitHub Pages

```bash
npm run deploy
```

This runs `vite build` and pushes the `dist/` folder to the `gh-pages` branch.

---

## Project Structure

```
src/
├── App.jsx                    # Main app — screen state machine
├── App.css                    # All styles
├── main.jsx                   # Entry point
├── components/
│   ├── PoseController.jsx     # MediaPipe pose detection hook
│   ├── WebcamPoseOverlay.jsx  # Webcam feed + skeleton canvas overlay
│   ├── MazeGame.jsx           # Canvas maze renderer + game logic
│   └── HUD.jsx                # Status panel (pose, calibration, direction)
└── utils/
    ├── mazeGenerator.js       # Recursive DFS maze generation
    └── poseInterpreter.js     # Landmark → direction conversion
```

---

## Architecture Notes

### Pose Interpretation
MediaPipe Pose landmarks are normalized 0–1 (x, y). We use the four torso landmarks (shoulders + hips) to compute a **body center**. A rolling average smooths jitter. Deviation from the calibrated neutral position determines the movement direction.

```
Body center X = avg(leftShoulder.x, rightShoulder.x, leftHip.x, rightHip.x)
Body center Y = avg(leftShoulder.y, rightShoulder.y, leftHip.y, rightHip.y)

dx = currentX - calibratedX   → lean left/right
dy = currentY - calibratedY   → stand taller/crouch
```

The larger deviation axis determines the direction, with dead-zone thresholds to prevent accidental movement.

### Maze Generation
Uses a standard **iterative DFS (recursive backtracker)** algorithm. Each cell tracks four walls (top/right/bottom/left). The algorithm carves passages by removing shared walls between adjacent unvisited cells.

### Fog of War
After drawing the full maze on the canvas, a near-opaque dark overlay is drawn with an **even-odd fill rule** cutout (circular hole) centered on the player — revealing only a radius of ~3.5 cells.
