const FILES = "abcdefgh";
const PIECE_VALUES = { P: 100, N: 320, B: 335, R: 500, Q: 900, K: 20000 };
const PROMOTIONS = ["Q", "R", "B", "N"];
export const PIECE_SYMBOLS = {
  w: { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙" },
  b: { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" },
};
export const PIECE_NAMES = {
  K: "rei",
  Q: "rainha",
  R: "torre",
  B: "bispo",
  N: "cavalo",
  P: "peão",
};
const opposite = (color) => (color === "w" ? "b" : "w");
const inBounds = (row, col) => row >= 0 && row < 8 && col >= 0 && col < 8;
const squareName = ([row, col]) => `${FILES[col]}${8 - row}`;
function initialBoard() {
  const order = ["R", "N", "B", "Q", "K", "B", "N", "R"];
  return Array.from({ length: 8 }, (_, row) =>
    Array.from({ length: 8 }, (_, col) => {
      if (row === 0) return { type: order[col], color: "b" };
      if (row === 1) return { type: "P", color: "b" };
      if (row === 6) return { type: "P", color: "w" };
      if (row === 7) return { type: order[col], color: "w" };
      return null;
    }),
  );
}
function positionKey(position) {
  const boardKey = position.board
    .flat()
    .map((piece) => {
      if (!piece) return "-";
      return piece.color === "w" ? piece.type : piece.type.toLowerCase();
    })
    .join("");
  const rights = ["wK", "wQ", "bK", "bQ"]
    .filter((right) => position.castling[right])
    .join("");
  const enPassant = position.enPassant ? squareName(position.enPassant) : "-";
  return `${boardKey} ${position.turn} ${rights || "-"} ${enPassant}`;
}
export function newGame() {
  const position = {
    board: initialBoard(),
    turn: "w",
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    enPassant: null,
    halfmove: 0,
    fullmove: 1,
    lastMove: null,
  };
  return {
    ...position,
    moveLog: [],
    captured: { w: [], b: [] },
    repetitions: { [positionKey(position)]: 1 },
    result: null,
    history: [],
  };
}
export function isSquareAttacked(board, target, byColor) {
  const [targetRow, targetCol] = target;
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = board[row][col];
      if (!piece || piece.color !== byColor) continue;
      const rowDiff = targetRow - row;
      const colDiff = targetCol - col;
      if (piece.type === "P") {
        const direction = byColor === "w" ? -1 : 1;
        if (rowDiff === direction && Math.abs(colDiff) === 1) return true;
        continue;
      }
      if (piece.type === "N") {
        if (
          (Math.abs(rowDiff) === 2 && Math.abs(colDiff) === 1) ||
          (Math.abs(rowDiff) === 1 && Math.abs(colDiff) === 2)
        ) {
          return true;
        }
        continue;
      }
      if (piece.type === "K") {
        if (Math.max(Math.abs(rowDiff), Math.abs(colDiff)) === 1) return true;
        continue;
      }
      const diagonal = Math.abs(rowDiff) === Math.abs(colDiff);
      const straight = rowDiff === 0 || colDiff === 0;
      if (
        (piece.type === "B" && !diagonal) ||
        (piece.type === "R" && !straight) ||
        (piece.type === "Q" && !diagonal && !straight) ||
        (rowDiff === 0 && colDiff === 0)
      ) {
        continue;
      }
      const rowStep = Math.sign(rowDiff);
      const colStep = Math.sign(colDiff);
      let pathRow = row + rowStep;
      let pathCol = col + colStep;
      let blocked = false;
      while (pathRow !== targetRow || pathCol !== targetCol) {
        if (board[pathRow][pathCol]) {
          blocked = true;
          break;
        }
        pathRow += rowStep;
        pathCol += colStep;
      }
      if (!blocked) return true;
    }
  }
  return false;
}
export function isKingInCheck(position, color) {
  let king = null;
  for (let row = 0; row < 8 && !king; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = position.board[row][col];
      if (piece?.type === "K" && piece.color === color) {
        king = [row, col];
        break;
      }
    }
  }
  return !king || isSquareAttacked(position.board, king, opposite(color));
}
function pseudoMovesForPiece(position, row, col) {
  const { board, enPassant } = position;
  const piece = board[row][col];
  if (!piece) return [];
  const moves = [];
  const addMove = (toRow, toCol, extras = {}) => {
    if (!inBounds(toRow, toCol)) return;
    const target = board[toRow][toCol];
    if (target?.color === piece.color || target?.type === "K") return;
    moves.push({ from: [row, col], to: [toRow, toCol], ...extras });
  };
  if (piece.type === "P") {
    const direction = piece.color === "w" ? -1 : 1;
    const startRow = piece.color === "w" ? 6 : 1;
    const nextRow = row + direction;
    if (inBounds(nextRow, col) && !board[nextRow][col]) {
      addMove(nextRow, col);
      const doubleRow = row + direction * 2;
      if (row === startRow && !board[doubleRow][col]) addMove(doubleRow, col);
    }
    for (const nextCol of [col - 1, col + 1]) {
      if (!inBounds(nextRow, nextCol)) continue;
      const target = board[nextRow][nextCol];
      if (target && target.color !== piece.color && target.type !== "K") {
        addMove(nextRow, nextCol);
      } else if (
        enPassant &&
        enPassant[0] === nextRow &&
        enPassant[1] === nextCol
      ) {
        moves.push({ from: [row, col], to: [nextRow, nextCol], enPassant: true });
      }
    }
    return moves;
  }
  if (piece.type === "N") {
    for (const [rowStep, colStep] of [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1],
    ]) {
      addMove(row + rowStep, col + colStep);
    }
    return moves;
  }
  if (piece.type === "K") {
    for (let rowStep = -1; rowStep <= 1; rowStep += 1) {
      for (let colStep = -1; colStep <= 1; colStep += 1) {
        if (rowStep !== 0 || colStep !== 0) {
          addMove(row + rowStep, col + colStep);
        }
      }
    }
    const homeRow = piece.color === "w" ? 7 : 0;
    const enemy = opposite(piece.color);
    if (
      row === homeRow &&
      col === 4 &&
      !isSquareAttacked(board, [homeRow, 4], enemy)
    ) {
      const kingSideRook = board[homeRow][7];
      if (
        position.castling[`${piece.color}K`] &&
        kingSideRook?.type === "R" &&
        kingSideRook.color === piece.color &&
        !board[homeRow][5] &&
        !board[homeRow][6] &&
        !isSquareAttacked(board, [homeRow, 5], enemy) &&
        !isSquareAttacked(board, [homeRow, 6], enemy)
      ) {
        moves.push({ from: [row, col], to: [homeRow, 6], castle: "king" });
      }
      const queenSideRook = board[homeRow][0];
      if (
        position.castling[`${piece.color}Q`] &&
        queenSideRook?.type === "R" &&
        queenSideRook.color === piece.color &&
        !board[homeRow][1] &&
        !board[homeRow][2] &&
        !board[homeRow][3] &&
        !isSquareAttacked(board, [homeRow, 3], enemy) &&
        !isSquareAttacked(board, [homeRow, 2], enemy)
      ) {
        moves.push({ from: [row, col], to: [homeRow, 2], castle: "queen" });
      }
    }
    return moves;
  }
  const directions = [];
  if (piece.type === "B" || piece.type === "Q") {
    directions.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
  }
  if (piece.type === "R" || piece.type === "Q") {
    directions.push([-1, 0], [1, 0], [0, -1], [0, 1]);
  }
  for (const [rowStep, colStep] of directions) {
    let nextRow = row + rowStep;
    let nextCol = col + colStep;
    while (inBounds(nextRow, nextCol)) {
      const target = board[nextRow][nextCol];
      if (!target) {
        addMove(nextRow, nextCol);
      } else {
        if (target.color !== piece.color && target.type !== "K") {
          addMove(nextRow, nextCol);
        }
        break;
      }
      nextRow += rowStep;
      nextCol += colStep;
    }
  }
  return moves;
}
export function getLegalMoves(position, color = position.turn) {
  const legalMoves = [];
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = position.board[row][col];
      if (!piece || piece.color !== color) continue;
      for (const move of pseudoMovesForPiece(position, row, col)) {
        const next = applyPosition(position, move);
        if (!isKingInCheck(next, color)) legalMoves.push(move);
      }
    }
  }
  return legalMoves;
}
function updateCastlingRights(castling, piece, from, captured, capturedSquare) {
  const next = { ...castling };
  const homeRow = piece.color === "w" ? 7 : 0;
  if (piece.type === "K") {
    next[`${piece.color}K`] = false;
    next[`${piece.color}Q`] = false;
  }
  if (piece.type === "R" && from[0] === homeRow) {
    if (from[1] === 0) next[`${piece.color}Q`] = false;
    if (from[1] === 7) next[`${piece.color}K`] = false;
  }
  if (captured?.type === "R") {
    const capturedHomeRow = captured.color === "w" ? 7 : 0;
    if (capturedSquare[0] === capturedHomeRow) {
      if (capturedSquare[1] === 0) next[`${captured.color}Q`] = false;
      if (capturedSquare[1] === 7) next[`${captured.color}K`] = false;
    }
  }
  return next;
}
function applyPosition(position, move, promotion = "Q") {
  const board = position.board.map((row) => row.slice());
  const [fromRow, fromCol] = move.from;
  const [toRow, toCol] = move.to;
  const movingPiece = board[fromRow][fromCol];
  const isEnPassant =
    movingPiece.type === "P" &&
    fromCol !== toCol &&
    !board[toRow][toCol];
  const capturedSquare = isEnPassant ? [fromRow, toCol] : [toRow, toCol];
  const capturedPiece = board[capturedSquare[0]][capturedSquare[1]];
  board[fromRow][fromCol] = null;
  if (isEnPassant) board[fromRow][toCol] = null;
  if (move.castle) {
    const rookFromCol = move.castle === "king" ? 7 : 0;
    const rookToCol = move.castle === "king" ? 5 : 3;
    board[fromRow][rookToCol] = board[fromRow][rookFromCol];
    board[fromRow][rookFromCol] = null;
  }
  const promotes = movingPiece.type === "P" && (toRow === 0 || toRow === 7);
  board[toRow][toCol] = {
    ...movingPiece,
    type: promotes ? promotion : movingPiece.type,
  };
  const castling = updateCastlingRights(
    position.castling,
    movingPiece,
    move.from,
    capturedPiece,
    capturedSquare,
  );
  const enPassant =
    movingPiece.type === "P" && Math.abs(toRow - fromRow) === 2
      ? [(fromRow + toRow) / 2, fromCol]
      : null;
  return {
    board,
    turn: opposite(movingPiece.color),
    castling,
    enPassant,
    halfmove:
      movingPiece.type === "P" || capturedPiece
        ? 0
        : (position.halfmove || 0) + 1,
    fullmove: (position.fullmove || 1) + (movingPiece.color === "b" ? 1 : 0),
    lastMove: { from: move.from, to: move.to },
  };
}
function sanForMove(position, move, legalMoves, promotion) {
  const piece = position.board[move.from[0]][move.from[1]];
  if (move.castle === "king") return "O-O";
  if (move.castle === "queen") return "O-O-O";
  const target = position.board[move.to[0]][move.to[1]];
  const isCapture = Boolean(target) || Boolean(move.enPassant);
  let disambiguation = "";
  if (piece.type !== "P") {
    const alternatives = legalMoves.filter(
      (other) =>
        other.from[0] !== move.from[0] || other.from[1] !== move.from[1],
    ).filter((other) => {
      const otherPiece = position.board[other.from[0]][other.from[1]];
      return (
        otherPiece?.type === piece.type &&
        other.to[0] === move.to[0] &&
        other.to[1] === move.to[1]
      );
    });
    if (alternatives.length) {
      const sameFile = alternatives.some((other) => other.from[1] === move.from[1]);
      const sameRank = alternatives.some((other) => other.from[0] === move.from[0]);
      if (!sameFile) disambiguation = FILES[move.from[1]];
      else if (!sameRank) disambiguation = String(8 - move.from[0]);
      else disambiguation = squareName(move.from);
    }
  }
  let san = piece.type === "P" ? "" : piece.type;
  if (piece.type === "P" && isCapture) san += FILES[move.from[1]];
  san += disambiguation;
  if (isCapture) san += "x";
  san += squareName(move.to);
  if (piece.type === "P" && (move.to[0] === 0 || move.to[0] === 7)) {
    san += `=${promotion}`;
  }
  return san;
}
function insufficientMaterial(board) {
  const pieces = board.flat().filter((piece) => piece && piece.type !== "K");
  if (pieces.some((piece) => ["P", "R", "Q"].includes(piece.type))) return false;
  if (pieces.length <= 1) return true;
  if (pieces.every((piece) => piece.type === "B")) {
    const squareColors = [];
    board.forEach((row, rowIndex) =>
      row.forEach((piece, colIndex) => {
        if (piece?.type === "B") squareColors.push((rowIndex + colIndex) % 2);
      }),
    );
    return squareColors.every((color) => color === squareColors[0]);
  }
  return false;
}
function snapshot(game) {
  return {
    board: game.board,
    turn: game.turn,
    castling: game.castling,
    enPassant: game.enPassant,
    halfmove: game.halfmove,
    fullmove: game.fullmove,
    lastMove: game.lastMove,
    moveLog: game.moveLog,
    captured: game.captured,
    repetitions: game.repetitions,
    result: game.result,
    history: game.history,
  };
}
export function makeMove(game, requestedMove, promotion = "Q") {
  if (game.result) return game;
  const legalMoves = getLegalMoves(game);
  const move = legalMoves.find(
    (candidate) =>
      candidate.from[0] === requestedMove.from[0] &&
      candidate.from[1] === requestedMove.from[1] &&
      candidate.to[0] === requestedMove.to[0] &&
      candidate.to[1] === requestedMove.to[1],
  );
  if (!move) return game;
  const movingPiece = game.board[move.from[0]][move.from[1]];
  const capturedSquare = move.enPassant
    ? [move.from[0], move.to[1]]
    : move.to;
  const capturedPiece = game.board[capturedSquare[0]][capturedSquare[1]];
  const san = sanForMove(game, move, legalMoves, promotion);
  const nextPosition = applyPosition(game, move, promotion);
  const nextLegalMoves = getLegalMoves(nextPosition);
  const inCheck = isKingInCheck(nextPosition, nextPosition.turn);
  let suffix = "";
  if (inCheck) suffix = nextLegalMoves.length === 0 ? "#" : "+";
  const moveLog = [
    ...game.moveLog,
    { san: `${san}${suffix}`, color: movingPiece.color, number: game.fullmove },
  ];
  const captured = capturedPiece
    ? {
        ...game.captured,
        [movingPiece.color]: [...game.captured[movingPiece.color], capturedPiece],
      }
    : game.captured;
  const repetitions = { ...game.repetitions };
  const key = positionKey(nextPosition);
  repetitions[key] = (repetitions[key] || 0) + 1;
  let result = null;
  if (nextLegalMoves.length === 0) {
    result = inCheck
      ? { type: "checkmate", winner: movingPiece.color, reason: "Xeque-mate" }
      : { type: "draw", winner: null, reason: "Afogamento" };
  } else if (insufficientMaterial(nextPosition.board)) {
    result = { type: "draw", winner: null, reason: "Material insuficiente" };
  } else if (nextPosition.halfmove >= 100) {
    result = { type: "draw", winner: null, reason: "Regra dos 50 lances" };
  } else if (repetitions[key] >= 3) {
    result = { type: "draw", winner: null, reason: "Repetição tripla" };
  }
  return {
    ...nextPosition,
    moveLog,
    captured,
    repetitions,
    result,
    history: [...game.history, snapshot(game)],
  };
}
export function undoMove(game) {
  if (game.history.length === 0) return game;
  const previous = game.history[game.history.length - 1];
  return { ...previous, history: game.history.slice(0, -1) };
}
function orderedMoves(position, moves) {
  return moves.slice().sort((first, second) => {
    const score = (move) => {
      const moving = position.board[move.from[0]][move.from[1]];
      const captured = move.enPassant
        ? { type: "P" }
        : position.board[move.to[0]][move.to[1]];
      const promotion =
        moving.type === "P" && (move.to[0] === 0 || move.to[0] === 7) ? 800 : 0;
      return (captured ? PIECE_VALUES[captured.type] * 10 : 0) - PIECE_VALUES[moving.type] + promotion;
    };
    return score(second) - score(first);
  });
}
function evaluateBoard(board, perspective) {
  let score = 0;
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = board[row][col];
      if (!piece) continue;
      const sign = piece.color === perspective ? 1 : -1;
      let positional = 0;
      const center = 3.5 - (Math.abs(3.5 - row) + Math.abs(3.5 - col)) / 2;
      if (piece.type === "N" || piece.type === "B") positional += center * 7;
      if (piece.type === "P") {
        positional += (piece.color === "w" ? 6 - row : row - 1) * 7;
        positional += center * 2;
      }
      score += sign * (PIECE_VALUES[piece.type] + positional);
    }
  }
  return score;
}
function search(position, depth, alpha, beta, perspective) {
  const moves = getLegalMoves(position);
  if (moves.length === 0) {
    if (!isKingInCheck(position, position.turn)) return 0;
    return position.turn === perspective ? -100000 - depth : 100000 + depth;
  }
  if (depth === 0) return evaluateBoard(position.board, perspective);
  const maximizing = position.turn === perspective;
  let best = maximizing ? -Infinity : Infinity;
  for (const move of orderedMoves(position, moves)) {
    const next = applyPosition(position, move);
    const value = search(next, depth - 1, alpha, beta, perspective);
    if (maximizing) {
      best = Math.max(best, value);
      alpha = Math.max(alpha, best);
    } else {
      best = Math.min(best, value);
      beta = Math.min(beta, best);
    }
    if (beta <= alpha) break;
  }
  return best;
}
export function chooseComputerMove(position, color = "b") {
  const moves = getLegalMoves(position, color);
  if (moves.length === 0) return null;
  let bestScore = -Infinity;
  let bestMoves = [];
  for (const move of orderedMoves(position, moves)) {
    const next = applyPosition(position, move);
    const score = search(next, 2, -Infinity, Infinity, color);
    if (score > bestScore) {
      bestScore = score;
      bestMoves = [move];
    } else if (score === bestScore) {
      bestMoves.push(move);
    }
  }
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}
export function promotionChoices() {
  return PROMOTIONS.slice();
}