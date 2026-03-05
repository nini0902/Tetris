import { describe, it, expect } from 'vitest';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  createGameState,
  hardDrop,
  mergeBoardWithPiece,
  movePiece,
  rotatePiece,
  tick,
} from '../src/gameEngine.js';

function fillBottomRow(board) {
  const nextBoard = board.map((row) => [...row]);
  nextBoard[BOARD_HEIGHT - 1] = new Array(BOARD_WIDTH).fill(1);
  return nextBoard;
}

describe('gameEngine', () => {
  it('creates a board with correct dimensions and active piece', () => {
    const state = createGameState({ pieceQueue: ['I', 'O'] });

    expect(state.board).toHaveLength(BOARD_HEIGHT);
    expect(state.board[0]).toHaveLength(BOARD_WIDTH);
    expect(state.currentPiece).toBeTruthy();
    expect(state.currentPiece.type).toBe('I');
    expect(state.nextPieceType).toBe('O');
  });

  it('moves piece horizontally when valid', () => {
    const state = createGameState({ pieceQueue: ['O', 'I'] });
    const moved = movePiece(state, -1, 0);

    expect(moved.currentPiece.x).toBe(state.currentPiece.x - 1);
  });

  it('does not move piece through walls', () => {
    let state = createGameState({ pieceQueue: ['O', 'I'] });
    for (let i = 0; i < BOARD_WIDTH; i += 1) {
      state = movePiece(state, -1, 0);
    }

    const blocked = movePiece(state, -1, 0);
    expect(blocked.currentPiece.x).toBe(state.currentPiece.x);
  });

  it('rotates piece clockwise with wall kick', () => {
    let state = createGameState({ pieceQueue: ['I', 'O'] });
    for (let i = 0; i < BOARD_WIDTH; i += 1) {
      state = movePiece(state, -1, 0);
    }

    const rotated = rotatePiece(state);
    expect(rotated.currentPiece.matrix).not.toEqual(state.currentPiece.matrix);
  });

  it('locks piece and clears complete lines', () => {
    let state = createGameState({ pieceQueue: ['I', 'O', 'T'] });
    state = {
      ...state,
      board: fillBottomRow(state.board).map((row, y) => {
        if (y !== BOARD_HEIGHT - 1) return row;
        const nextRow = [...row];
        nextRow[3] = 0;
        nextRow[4] = 0;
        nextRow[5] = 0;
        nextRow[6] = 0;
        return nextRow;
      }),
      currentPiece: {
        type: 'I',
        x: 3,
        y: BOARD_HEIGHT - 1,
        matrix: [[1, 1, 1, 1]],
      },
      nextPieceType: 'O',
    };

    const next = tick(state);

    expect(next.lines).toBe(1);
    expect(next.score).toBe(40);
    expect(next.board[BOARD_HEIGHT - 1].every((cell) => cell === 0)).toBe(true);
  });

  it('hard drop reaches lock state and spawns next piece', () => {
    const state = createGameState({ pieceQueue: ['O', 'I', 'T'] });
    const dropped = hardDrop(state);

    expect(dropped.currentPiece.type).toBe('I');
    expect(dropped.score).toBeGreaterThan(0);
  });

  it('sets game over when spawn area is blocked', () => {
    let state = createGameState({ pieceQueue: ['O', 'I'] });
    const blockedBoard = state.board.map((row) => [...row]);
    blockedBoard[0][4] = 8;
    blockedBoard[0][5] = 8;

    state = {
      ...state,
      board: blockedBoard,
      currentPiece: {
        ...state.currentPiece,
        y: BOARD_HEIGHT - 2,
      },
    };

    const afterLock = hardDrop(state);
    expect(afterLock.gameOver).toBe(true);
  });

  it('mergeBoardWithPiece overlays active piece without mutating original board', () => {
    const state = createGameState({ pieceQueue: ['O', 'I'] });
    const merged = mergeBoardWithPiece(state.board, state.currentPiece);

    expect(merged).not.toBe(state.board);
    expect(merged.some((row) => row.some((cell) => cell > 0))).toBe(true);
  });
});
