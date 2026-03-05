import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  createGameState,
  hardDrop,
  levelToDropInterval,
  mergeBoardWithPiece,
  movePiece,
  rotatePiece,
  tick,
} from './gameEngine.js';

const CELL_SIZE = 30;
const NEXT_CELL = 24;
const COLORS = {
  0: 'rgba(12, 18, 31, 0.8)',
  1: '#49f3ff',
  2: '#ffd54a',
  3: '#bf8bff',
  4: '#4dff9d',
  5: '#ff6688',
  6: '#4aa3ff',
  7: '#ff9b40',
};

const boardCanvas = document.querySelector('#game-board');
const nextCanvas = document.querySelector('#next-piece');
const scoreEl = document.querySelector('#score');
const linesEl = document.querySelector('#lines');
const levelEl = document.querySelector('#level');
const speedEl = document.querySelector('#speed');
const messageEl = document.querySelector('#message');

const boardCtx = boardCanvas.getContext('2d');
const nextCtx = nextCanvas.getContext('2d');
const SWIPE_THRESHOLD = 24;
const HORIZONTAL_BIAS = 1.25;
const CLEAR_FX_DURATION = 560;
const TIME_ACCEL_STEP_MS = 15000;
const TIME_ACCEL_FACTOR = 0.94;
const MIN_DROP_INTERVAL_MS = 32;

let state = createGameState();
let previous = performance.now();
let dropAccumulator = 0;
let gameElapsedMs = 0;
let clearFxElapsed = CLEAR_FX_DURATION;
let clearFxStrength = 0;
let touchStartX = 0;
let touchStartY = 0;
let touchCurrentX = 0;
let touchCurrentY = 0;
let touchTracking = false;
const rootStyle = document.documentElement.style;

const SPEED_THEME_BASE = {
  bg1: [8, 17, 31],
  bg2: [4, 7, 13],
  accentLeft: [15, 47, 77],
  accentRight: [20, 32, 95],
  glowLeft: [23, 191, 255],
  glowRight: [46, 115, 255],
};

const SPEED_THEME_FAST = {
  bg1: [24, 8, 20],
  bg2: [10, 4, 12],
  accentLeft: [91, 28, 57],
  accentRight: [138, 37, 49],
  glowLeft: [255, 99, 160],
  glowRight: [255, 127, 76],
};

const PREVIEW_PIECES = {
  I: [[1, 1, 1, 1]],
  O: [
    [2, 2],
    [2, 2],
  ],
  T: [
    [0, 3, 0],
    [3, 3, 3],
  ],
  S: [
    [0, 4, 4],
    [4, 4, 0],
  ],
  Z: [
    [5, 5, 0],
    [0, 5, 5],
  ],
  J: [
    [6, 0, 0],
    [6, 6, 6],
  ],
  L: [
    [0, 0, 7],
    [7, 7, 7],
  ],
};

function drawCell(ctx, x, y, value, size) {
  const px = x * size;
  const py = y * size;
  ctx.fillStyle = COLORS[value];
  ctx.fillRect(px, py, size, size);
  ctx.strokeStyle = 'rgba(133, 224, 255, 0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);

  if (value !== 0) {
    const gradient = ctx.createLinearGradient(px, py, px + size, py + size);
    gradient.addColorStop(0, 'rgba(255,255,255,0.45)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(px + 3, py + 3, size - 6, size - 6);
  }
}

function drawBoard() {
  const composed = mergeBoardWithPiece(state.board, state.currentPiece);
  boardCtx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);

  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      drawCell(boardCtx, x, y, composed[y][x], CELL_SIZE);
    }
  }
}

function drawLineClearEffect(delta) {
  if (clearFxStrength <= 0) {
    return;
  }

  clearFxElapsed += delta;
  const progress = Math.min(clearFxElapsed / CLEAR_FX_DURATION, 1);
  const fade = 1 - progress;
  const flashPhase = Math.min(progress / 0.22, 1);
  const sweepX = boardCanvas.width * progress;
  const beamWidth = 160 + clearFxStrength * 28;

  boardCtx.save();
  boardCtx.globalCompositeOperation = 'lighter';

  // Strong white opening pulse so line clear is unmistakable.
  boardCtx.fillStyle = `rgba(255, 255, 255, ${0.95 * clearFxStrength * (1 - flashPhase)})`;
  boardCtx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);

  boardCtx.fillStyle = `rgba(116, 235, 255, ${0.38 * clearFxStrength * fade})`;
  boardCtx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);

  const beam = boardCtx.createLinearGradient(
    Math.max(0, sweepX - beamWidth),
    0,
    Math.min(boardCanvas.width, sweepX + beamWidth),
    0,
  );
  beam.addColorStop(0, 'rgba(255,255,255,0)');
  beam.addColorStop(0.35, `rgba(255, 92, 168, ${0.44 * fade})`);
  beam.addColorStop(0.5, `rgba(255,255,255, ${1.15 * fade})`);
  beam.addColorStop(0.65, `rgba(255, 154, 86, ${0.44 * fade})`);
  beam.addColorStop(1, 'rgba(255,255,255,0)');
  boardCtx.fillStyle = beam;
  boardCtx.fillRect(Math.max(0, sweepX - beamWidth), 0, beamWidth * 2, boardCanvas.height);

  boardCtx.strokeStyle = `rgba(255, 255, 255, ${0.85 * fade})`;
  boardCtx.lineWidth = 3;
  boardCtx.strokeRect(1.5, 1.5, boardCanvas.width - 3, boardCanvas.height - 3);

  boardCtx.restore();

  if (progress >= 1) {
    clearFxStrength = 0;
  }
}

function transitionState(nextState) {
  if (nextState.lines > state.lines) {
    clearFxElapsed = 0;
    clearFxStrength = Math.min(2.6, 1.25 + (nextState.lines - state.lines) * 0.45);
  }

  state = nextState;
}

function getAcceleratedInterval(level, elapsedMs) {
  const base = levelToDropInterval(level);
  const stages = Math.floor(elapsedMs / TIME_ACCEL_STEP_MS);
  const boosted = base * Math.pow(TIME_ACCEL_FACTOR, stages);
  return Math.max(MIN_DROP_INTERVAL_MS, boosted);
}

function lerpChannel(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function mixColor(from, to, t) {
  const r = lerpChannel(from[0], to[0], t);
  const g = lerpChannel(from[1], to[1], t);
  const b = lerpChannel(from[2], to[2], t);
  return `rgb(${r}, ${g}, ${b})`;
}

function updateSpeedTheme(speedMultiplier) {
  const intensity = Math.max(0, Math.min(1, (speedMultiplier - 1) / 1.4));
  rootStyle.setProperty('--bg-1', mixColor(SPEED_THEME_BASE.bg1, SPEED_THEME_FAST.bg1, intensity));
  rootStyle.setProperty('--bg-2', mixColor(SPEED_THEME_BASE.bg2, SPEED_THEME_FAST.bg2, intensity));
  rootStyle.setProperty(
    '--bg-accent-left',
    mixColor(SPEED_THEME_BASE.accentLeft, SPEED_THEME_FAST.accentLeft, intensity),
  );
  rootStyle.setProperty(
    '--bg-accent-right',
    mixColor(SPEED_THEME_BASE.accentRight, SPEED_THEME_FAST.accentRight, intensity),
  );
  rootStyle.setProperty(
    '--glow-left-color',
    mixColor(SPEED_THEME_BASE.glowLeft, SPEED_THEME_FAST.glowLeft, intensity),
  );
  rootStyle.setProperty(
    '--glow-right-color',
    mixColor(SPEED_THEME_BASE.glowRight, SPEED_THEME_FAST.glowRight, intensity),
  );
}

function drawNextPiece() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const matrix = PREVIEW_PIECES[state.nextPieceType] ?? [[0]];
  const width = matrix[0].length * NEXT_CELL;
  const height = matrix.length * NEXT_CELL;
  const offsetX = Math.floor((nextCanvas.width - width) / 2 / NEXT_CELL);
  const offsetY = Math.floor((nextCanvas.height - height) / 2 / NEXT_CELL);

  for (let row = 0; row < matrix.length; row += 1) {
    for (let col = 0; col < matrix[row].length; col += 1) {
      if (matrix[row][col] === 0) continue;
      drawCell(nextCtx, offsetX + col, offsetY + row, matrix[row][col], NEXT_CELL);
    }
  }
}

function renderHud() {
  scoreEl.textContent = String(state.score);
  linesEl.textContent = String(state.lines);
  levelEl.textContent = String(state.level);
  const baseInterval = levelToDropInterval(state.level);
  const activeInterval = getAcceleratedInterval(state.level, gameElapsedMs);
  const speedMultiplier = Math.max(1, baseInterval / activeInterval);
  speedEl.textContent = `x${speedMultiplier.toFixed(2)}`;
  updateSpeedTheme(speedMultiplier);

  if (state.gameOver) {
    messageEl.textContent = 'SYSTEM FAILURE - Press R to reboot';
    messageEl.classList.add('visible');
  } else {
    messageEl.textContent = '';
    messageEl.classList.remove('visible');
  }
}

function render(delta) {
  drawBoard();
  drawLineClearEffect(delta);
  drawNextPiece();
  renderHud();
}

function update(timestamp) {
  const delta = timestamp - previous;
  previous = timestamp;

  if (!state.gameOver) {
    gameElapsedMs += delta;
    dropAccumulator += delta;
    const interval = getAcceleratedInterval(state.level, gameElapsedMs);
    if (dropAccumulator >= interval) {
      transitionState(tick(state));
      dropAccumulator = 0;
    }
  }

  render(delta);
  requestAnimationFrame(update);
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'r' || event.key === 'R') {
    gameElapsedMs = 0;
    dropAccumulator = 0;
    clearFxStrength = 0;
    clearFxElapsed = CLEAR_FX_DURATION;
    transitionState(createGameState());
    return;
  }

  if (state.gameOver) {
    return;
  }

  if (event.key === 'ArrowLeft') transitionState(movePiece(state, -1, 0));
  if (event.key === 'ArrowRight') transitionState(movePiece(state, 1, 0));
  if (event.key === 'ArrowDown') transitionState(tick(state));
  if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') transitionState(rotatePiece(state));
  if (event.code === 'Space') {
    event.preventDefault();
    transitionState(hardDrop(state));
  }
});

boardCanvas.addEventListener(
  'touchstart',
  (event) => {
    const [touch] = event.touches;
    if (!touch) return;
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchCurrentX = touch.clientX;
    touchCurrentY = touch.clientY;
    touchTracking = true;
  },
  { passive: true },
);

boardCanvas.addEventListener(
  'touchmove',
  (event) => {
    if (!touchTracking || state.gameOver) {
      return;
    }

    const [touch] = event.touches;
    if (!touch) return;

    touchCurrentX = touch.clientX;
    touchCurrentY = touch.clientY;

    const deltaX = touchCurrentX - touchStartX;
    const deltaY = touchCurrentY - touchStartY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX > absY * HORIZONTAL_BIAS) {
      event.preventDefault();
    }
  },
  { passive: false },
);

boardCanvas.addEventListener(
  'touchend',
  (event) => {
    if (!touchTracking || state.gameOver) {
      touchTracking = false;
      return;
    }

    const endTouch = event.changedTouches?.[0];
    if (endTouch) {
      touchCurrentX = endTouch.clientX;
      touchCurrentY = endTouch.clientY;
    }

    const deltaX = touchCurrentX - touchStartX;
    const deltaY = touchCurrentY - touchStartY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX >= SWIPE_THRESHOLD && absX > absY * HORIZONTAL_BIAS) {
      const direction = deltaX > 0 ? 1 : -1;
      const steps = Math.max(1, Math.floor(absX / SWIPE_THRESHOLD));
      for (let i = 0; i < steps; i += 1) {
        transitionState(movePiece(state, direction, 0));
      }
    }

    touchTracking = false;
  },
  { passive: true },
);

boardCanvas.addEventListener(
  'touchcancel',
  () => {
    touchTracking = false;
  },
  { passive: true },
);

render(0);
requestAnimationFrame(update);
