import { Tuple, TupleMap } from "../../common.ts";

type Character = string & { length: 1 };
const test: Character = "a"; // Type 'string' is not assignable to type '{ length: 1; }'

type Position = Tuple<number, 2>;

abstract class Piece {
  constructor(public player: Character) {}

  abstract getLegalMoves(board: Board, position: Position): Position[];

  abstract toCharacter(): Character;
  static fromCharacter(char: Character): Piece {}
}

class King extends Piece {}
class Queen extends Piece {}
class Bishop extends Piece {}
class Knight extends Piece {}
class Rook extends Piece {}
class Pawn extends Piece {}

class Board extends TupleMap<Piece, 2> {
  constructor(fen = Chess.FEN.Start) {
    super();
    return Board.fromFEN(fen);
  }

  static fromEmpty(): Board {}
  static fromFEN(fen: string): Board {}
}

class Chess {
  static FEN = {
    Empty: "8/8/8/8/8/8/8/8 w - - 0 1",
    Start: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  };
}
