import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  createGameState,
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
const messageEl = document.querySelector('#message');

const boardCtx = boardCanvas.getContext('2d');
const nextCtx = nextCanvas.getContext('2d');
const SWIPE_THRESHOLD = 24;
const HORIZONTAL_BIAS = 1.25;
const CLEAR_EFFECT_DURATION = 520;

let state = createGameState();
let previous = performance.now();
let dropAccumulator = 0;
let clearEffects = [];
let isPaused = false;
let touchStartX = 0;
let touchStartY = 0;
let touchCurrentX = 0;
let touchCurrentY = 0;
let touchTracking = false;

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

function drawLineClearEffects(delta) {
  if (clearEffects.length === 0) {
    return;
  }

  for (let i = clearEffects.length - 1; i >= 0; i -= 1) {
    const effect = clearEffects[i];
    effect.elapsed += delta;

    const progress = Math.min(effect.elapsed / CLEAR_EFFECT_DURATION, 1);
    const fade = 1 - progress;
    const flashPhase = Math.min(progress / 0.22, 1);
    const sweepPhase = Math.max((progress - 0.12) / 0.88, 0);
    const y = effect.row * CELL_SIZE;
    const sweepWidth = boardCanvas.width * sweepPhase;
    const beamWidth = 180;

    // Wide row glow to ensure line clear is obvious even on small mobile screens.
    boardCtx.fillStyle = `rgba(123, 234, 255, ${0.78 * fade})`;
    boardCtx.fillRect(0, y, boardCanvas.width, CELL_SIZE);

    // Initial white flash pulse.
    if (flashPhase < 1) {
      boardCtx.fillStyle = `rgba(255, 255, 255, ${0.95 * (1 - flashPhase)})`;
      boardCtx.fillRect(0, y, boardCanvas.width, CELL_SIZE);
    }

    const scan = boardCtx.createLinearGradient(
      Math.max(0, sweepWidth - beamWidth),
      y,
      Math.min(boardCanvas.width, sweepWidth + beamWidth),
      y,
    );
    scan.addColorStop(0, 'rgba(255,255,255,0)');
    scan.addColorStop(0.25, `rgba(77, 245, 255, ${0.45 * fade})`);
    scan.addColorStop(0.5, `rgba(255,255,255,${1.15 * fade})`);
    scan.addColorStop(0.75, `rgba(77, 245, 255, ${0.45 * fade})`);
    scan.addColorStop(1, 'rgba(255,255,255,0)');

    boardCtx.save();
    boardCtx.globalCompositeOperation = 'lighter';
    boardCtx.fillStyle = scan;
    boardCtx.fillRect(Math.max(0, sweepWidth - beamWidth), y, beamWidth * 2, CELL_SIZE);

    // Energy trail behind the scanning beam.
    boardCtx.fillStyle = `rgba(86, 237, 255, ${0.26 * fade})`;
    boardCtx.fillRect(0, y + 3, Math.max(0, sweepWidth - 18), CELL_SIZE - 6);
    boardCtx.restore();

    if (progress >= 1) {
      clearEffects.splice(i, 1);
    }
  }
}

function setState(nextState) {
  if (nextState.lines > state.lines) {
    const rows = nextState.lastClearedRows?.length ? nextState.lastClearedRows : [BOARD_HEIGHT - 1];
    rows.forEach((row) => {
      clearEffects.push({ row, elapsed: 0 });
    });
  }

  state = nextState;
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

  if (isPaused && !state.gameOver) {
    messageEl.textContent = 'PAUSED - Press Space to resume';
    messageEl.classList.add('visible');
    return;
  }

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
  drawLineClearEffects(delta);
  drawNextPiece();
  renderHud();
}

function update(timestamp) {
  const delta = timestamp - previous;
  previous = timestamp;

  if (!state.gameOver && !isPaused) {
    dropAccumulator += delta;
    const interval = levelToDropInterval(state.level);
    if (dropAccumulator >= interval) {
      setState(tick(state));
      dropAccumulator = 0;
    }
  }

  render(delta);
  requestAnimationFrame(update);
}

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    if (!state.gameOver) {
      isPaused = !isPaused;
    }
    return;
  }

  if (event.key === 'r' || event.key === 'R') {
    clearEffects = [];
    isPaused = false;
    setState(createGameState());
    return;
  }

  if (state.gameOver || isPaused) {
    return;
  }

  if (event.key === 'ArrowLeft') setState(movePiece(state, -1, 0));
  if (event.key === 'ArrowRight') setState(movePiece(state, 1, 0));
  if (event.key === 'ArrowDown') setState(tick(state));
  if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') setState(rotatePiece(state));
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
        setState(movePiece(state, direction, 0));
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
