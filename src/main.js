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
const messageEl = document.querySelector('#message');

const boardCtx = boardCanvas.getContext('2d');
const nextCtx = nextCanvas.getContext('2d');

let state = createGameState();
let previous = performance.now();
let dropAccumulator = 0;

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

  if (state.gameOver) {
    messageEl.textContent = 'SYSTEM FAILURE - Press R to reboot';
    messageEl.classList.add('visible');
  } else {
    messageEl.textContent = '';
    messageEl.classList.remove('visible');
  }
}

function render() {
  drawBoard();
  drawNextPiece();
  renderHud();
}

function update(timestamp) {
  const delta = timestamp - previous;
  previous = timestamp;

  if (!state.gameOver) {
    dropAccumulator += delta;
    const interval = levelToDropInterval(state.level);
    if (dropAccumulator >= interval) {
      state = tick(state);
      dropAccumulator = 0;
    }
  }

  render();
  requestAnimationFrame(update);
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'r' || event.key === 'R') {
    state = createGameState();
    return;
  }

  if (state.gameOver) {
    return;
  }

  if (event.key === 'ArrowLeft') state = movePiece(state, -1, 0);
  if (event.key === 'ArrowRight') state = movePiece(state, 1, 0);
  if (event.key === 'ArrowDown') state = tick(state);
  if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') state = rotatePiece(state);
  if (event.code === 'Space') {
    event.preventDefault();
    state = hardDrop(state);
  }
});

render();
requestAnimationFrame(update);
