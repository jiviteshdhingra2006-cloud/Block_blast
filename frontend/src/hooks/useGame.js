import { useState, useCallback, useEffect } from 'react';
import { getRandomShape } from '../utils/shapes';

const GRID_SIZE = 8;
const INITIAL_GRID = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));

export const useGame = () => {
  const [grid, setGrid] = useState(INITIAL_GRID);
  const [pieces, setPieces] = useState([null, null, null]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const generatePieces = useCallback(() => {
    setPieces([getRandomShape(), getRandomShape(), getRandomShape()]);
  }, []);

  const startGame = useCallback(() => {
    setGrid(INITIAL_GRID);
    setScore(0);
    setGameOver(false);
    generatePieces();
  }, [generatePieces]);

  useEffect(() => {
    startGame();
  }, [startGame]);

  const canPlacePiece = useCallback((gridState, pieceShape, row, col) => {
    for (let r = 0; r < pieceShape.length; r++) {
      for (let c = 0; c < pieceShape[r].length; c++) {
        if (pieceShape[r][c] === 1) {
          const targetRow = row + r;
          const targetCol = col + c;
          if (
            targetRow < 0 || targetRow >= GRID_SIZE ||
            targetCol < 0 || targetCol >= GRID_SIZE ||
            gridState[targetRow][targetCol] !== null
          ) {
            return false;
          }
        }
      }
    }
    return true;
  }, []);

  const checkGameOver = useCallback((currentGrid, currentPieces) => {
    const activePieces = currentPieces.filter(p => p !== null);
    if (activePieces.length === 0) return false;

    // Check if any of the active pieces can be placed anywhere on the board
    for (const piece of activePieces) {
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (canPlacePiece(currentGrid, piece.shape, r, c)) {
            return false; // Found a valid placement, game is not over
          }
        }
      }
    }
    return true; // No valid placement found for any piece
  }, [canPlacePiece]);

  const clearLines = useCallback((currentGrid) => {
    const rowsToClear = [];
    const colsToClear = [];

    // Check rows
    for (let r = 0; r < GRID_SIZE; r++) {
      if (currentGrid[r].every(cell => cell !== null)) {
        rowsToClear.push(r);
      }
    }

    // Check columns
    for (let c = 0; c < GRID_SIZE; c++) {
      let isColFull = true;
      for (let r = 0; r < GRID_SIZE; r++) {
        if (currentGrid[r][c] === null) {
          isColFull = false;
          break;
        }
      }
      if (isColFull) colsToClear.push(c);
    }

    if (rowsToClear.length === 0 && colsToClear.length === 0) {
      return { newGrid: currentGrid, linesCleared: 0 };
    }

    // Create a new grid and clear the lines
    const newGrid = currentGrid.map(row => [...row]);
    
    rowsToClear.forEach(r => {
      for (let c = 0; c < GRID_SIZE; c++) {
        newGrid[r][c] = null;
      }
    });

    colsToClear.forEach(c => {
      for (let r = 0; r < GRID_SIZE; r++) {
        newGrid[r][c] = null;
      }
    });

    return { newGrid, linesCleared: rowsToClear.length + colsToClear.length };
  }, []);

  const placePiece = useCallback((pieceIndex, row, col) => {
    const piece = pieces[pieceIndex];
    if (!piece || gameOver) return false;

    if (!canPlacePiece(grid, piece.shape, row, col)) {
      return false;
    }

    // Place the piece
    let newGrid = grid.map(r => [...r]);
    let blocksPlaced = 0;
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (piece.shape[r][c] === 1) {
          newGrid[row + r][col + c] = piece.color;
          blocksPlaced++;
        }
      }
    }

    // Calculate base score for placing blocks
    let pointsEarned = blocksPlaced * 10;

    // Check for cleared lines
    const { newGrid: clearedGrid, linesCleared } = clearLines(newGrid);
    if (linesCleared > 0) {
      pointsEarned += linesCleared * 100 * linesCleared; // Combo multiplier
      newGrid = clearedGrid;
    }

    setGrid(newGrid);
    setScore(s => s + pointsEarned);

    // Remove the placed piece
    const newPieces = [...pieces];
    newPieces[pieceIndex] = null;
    
    // Check if all pieces are used
    if (newPieces.every(p => p === null)) {
      // Need to generate new pieces, and we must check game over AFTER they are generated.
      // But state updates are async, so we simulate it here.
      const generated = [getRandomShape(), getRandomShape(), getRandomShape()];
      setPieces(generated);
      if (checkGameOver(newGrid, generated)) {
        setGameOver(true);
      }
    } else {
      setPieces(newPieces);
      if (checkGameOver(newGrid, newPieces)) {
        setGameOver(true);
      }
    }

    return true; // Successfully placed
  }, [pieces, grid, gameOver, canPlacePiece, clearLines, checkGameOver]);

  return {
    grid,
    pieces,
    score,
    gameOver,
    placePiece,
    startGame,
    GRID_SIZE
  };
};
