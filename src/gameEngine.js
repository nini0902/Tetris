export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;

const PIECES = {
  I: {
    id: 1,
    matrix: [[1, 1, 1, 1]],
  },
  O: {
    id: 2,
    matrix: [
      [2, 2],
      [2, 2],
    ],
  },
  T: {
    id: 3,
    matrix: [
      [0, 3, 0],
      [3, 3, 3],
    ],
  },
  S: {
    id: 4,
    matrix: [
      [0, 4, 4],
      [4, 4, 0],
    ],
  },
  Z: {
    id: 5,
    matrix: [
      [5, 5, 0],
      [0, 5, 5],
    ],
  },
  J: {
    id: 6,
    matrix: [
      [6, 0, 0],
      [6, 6, 6],
    ],
  },
  L: {
    id: 7,
    matrix: [
      [0, 0, 7],
      [7, 7, 7],
    ],
  },
};

const PIECE_TYPES = Object.keys(PIECES);
const WALL_KICKS = [0, -1, 1, -2, 2];

function createBoard() {
  return Array.from({ length: BOARD_HEIGHT }, () => new Array(BOARD_WIDTH).fill(0));
}

function cloneBoard(board) {
  return board.map((row) => [...row]);
}

function randomType(randomFn = Math.random) {
  const index = Math.floor(randomFn() * PIECE_TYPES.length);
  return PIECE_TYPES[index];
}

function takeNextType(state, randomFn = Math.random) {
  if (state.pieceQueue.length > 0) {
    const [nextType, ...rest] = state.pieceQueue;
    return { nextType, pieceQueue: rest };
  }

  return {
    nextType: randomType(randomFn),
    pieceQueue: state.pieceQueue,
  };
}

function buildPiece(type) {
  const piece = PIECES[type];
  return {
    type,
    matrix: piece.matrix.map((row) => [...row]),
    x: Math.floor((BOARD_WIDTH - piece.matrix[0].length) / 2),
    y: 0,
  };
}

function isValidPosition(board, piece, x = piece.x, y = piece.y, matrix = piece.matrix) {
  for (let row = 0; row < matrix.length; row += 1) {
    for (let col = 0; col < matrix[row].length; col += 1) {
      if (matrix[row][col] === 0) {
        continue;
      }

      const nextX = x + col;
      const nextY = y + row;

      if (nextX < 0 || nextX >= BOARD_WIDTH || nextY >= BOARD_HEIGHT) {
        return false;
      }

      if (nextY >= 0 && board[nextY][nextX] !== 0) {
        return false;
      }
    }
  }

  return true;
}

function rotateMatrixClockwise(matrix) {
  return matrix[0].map((_, index) => matrix.map((row) => row[index]).reverse());
}

function lockPieceToBoard(board, piece) {
  const nextBoard = cloneBoard(board);

  for (let row = 0; row < piece.matrix.length; row += 1) {
    for (let col = 0; col < piece.matrix[row].length; col += 1) {
      if (piece.matrix[row][col] === 0) {
        continue;
      }

      const targetY = piece.y + row;
      const targetX = piece.x + col;

      if (targetY >= 0 && targetY < BOARD_HEIGHT && targetX >= 0 && targetX < BOARD_WIDTH) {
        nextBoard[targetY][targetX] = piece.matrix[row][col];
      }
    }
  }

  return nextBoard;
}

function clearLines(board) {
  const clearedRows = [];
  board.forEach((row, index) => {
    if (row.every((cell) => cell !== 0)) {
      clearedRows.push(index);
    }
  });

  const remainingRows = board.filter((row) => row.some((cell) => cell === 0));
  const clearedCount = BOARD_HEIGHT - remainingRows.length;
  const newRows = Array.from({ length: clearedCount }, () => new Array(BOARD_WIDTH).fill(0));
  return {
    board: [...newRows, ...remainingRows],
    clearedCount,
    clearedRows,
  };
}

function lineClearScore(clearedCount, level) {
  const table = [0, 40, 100, 300, 1200];
  return table[clearedCount] * level;
}

function advanceAfterLock(state, hardDropBonus = 0, randomFn = Math.random) {
  const lockedBoard = lockPieceToBoard(state.board, state.currentPiece);
  const { board: boardAfterClear, clearedCount, clearedRows } = clearLines(lockedBoard);

  const totalLines = state.lines + clearedCount;
  const level = Math.floor(totalLines / 10) + 1;
  const scoreGain = lineClearScore(clearedCount, state.level) + hardDropBonus;

  const baseState = {
    ...state,
    board: boardAfterClear,
    score: state.score + scoreGain,
    lines: totalLines,
    level,
    lastClearedRows: clearedRows,
  };

  return spawnNextPiece(baseState, randomFn);
}

export function createGameState(options = {}) {
  const state = {
    board: createBoard(),
    currentPiece: null,
    nextPieceType: null,
    pieceQueue: [...(options.pieceQueue ?? [])],
    score: 0,
    lines: 0,
    level: 1,
    gameOver: false,
    lastClearedRows: [],
  };

  return spawnNextPiece(state, options.randomFn);
}

function spawnNextPiece(state, randomFn = Math.random, onlyPreview = false) {
  if (state.gameOver) {
    return state;
  }

  if (onlyPreview) {
    const { nextType, pieceQueue } = takeNextType(state, randomFn);
    return {
      ...state,
      nextPieceType: nextType,
      pieceQueue,
    };
  }

  let pieceType = state.nextPieceType;
  let nextQueue = state.pieceQueue;

  if (!pieceType) {
    const pick = takeNextType(state, randomFn);
    pieceType = pick.nextType;
    nextQueue = pick.pieceQueue;
  }

  const piece = buildPiece(pieceType);
  const withPiece = {
    ...state,
    currentPiece: piece,
    pieceQueue: nextQueue,
  };

  const previewPick = takeNextType(withPiece, randomFn);
  const nextState = {
    ...withPiece,
    nextPieceType: previewPick.nextType,
    pieceQueue: previewPick.pieceQueue,
  };

  if (!isValidPosition(nextState.board, piece)) {
    return {
      ...nextState,
      gameOver: true,
    };
  }

  return nextState;
}

export function mergeBoardWithPiece(board, piece) {
  const merged = cloneBoard(board);

  for (let row = 0; row < piece.matrix.length; row += 1) {
    for (let col = 0; col < piece.matrix[row].length; col += 1) {
      if (piece.matrix[row][col] === 0) {
        continue;
      }

      const y = piece.y + row;
      const x = piece.x + col;
      if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH) {
        merged[y][x] = piece.matrix[row][col];
      }
    }
  }

  return merged;
}

export function movePiece(state, dx, dy) {
  if (state.gameOver) {
    return state;
  }

  const nextX = state.currentPiece.x + dx;
  const nextY = state.currentPiece.y + dy;
  if (!isValidPosition(state.board, state.currentPiece, nextX, nextY)) {
    return state;
  }

  return {
    ...state,
    currentPiece: {
      ...state.currentPiece,
      x: nextX,
      y: nextY,
    },
  };
}

export function rotatePiece(state) {
  if (state.gameOver) {
    return state;
  }

  const rotated = rotateMatrixClockwise(state.currentPiece.matrix);
  for (const offset of WALL_KICKS) {
    const nextX = state.currentPiece.x + offset;
    if (isValidPosition(state.board, state.currentPiece, nextX, state.currentPiece.y, rotated)) {
      return {
        ...state,
        currentPiece: {
          ...state.currentPiece,
          x: nextX,
          matrix: rotated,
        },
      };
    }
  }

  return state;
}

export function tick(state, randomFn = Math.random) {
  if (state.gameOver) {
    return state;
  }

  const moved = movePiece(state, 0, 1);
  if (moved !== state) {
    return moved;
  }

  return advanceAfterLock(state, 0, randomFn);
}

export function hardDrop(state, randomFn = Math.random) {
  if (state.gameOver) {
    return state;
  }

  let distance = 0;
  let nextState = state;

  while (true) {
    const moved = movePiece(nextState, 0, 1);
    if (moved === nextState) {
      break;
    }
    nextState = moved;
    distance += 1;
  }

  return advanceAfterLock(nextState, distance * 2, randomFn);
}

export function levelToDropInterval(level) {
  return Math.max(50, 420 - (level - 1) * 55);
}
