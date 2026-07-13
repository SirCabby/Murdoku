// Core domain model for Murdoku.
//
// A puzzle is a *shape*: a set of cells placed on an integer lattice. The shape
// need not be a rectangle — it can have bulges, notches, or holes. Each existing
// cell also carries play state (a mark and a note). Rows and columns are not
// labelled yet; the puzzle is, for now, purely the arrangement of cells.
//
// Cells are keyed by their coordinate string `"x,y"` (see `lib/coords.ts`). A
// key being present in `Puzzle.cells` is exactly what it means for that cell to
// exist in the shape.

/** A single cell's play state. `blank` = undecided. */
export type Mark = 'blank' | 'no' | 'yes'

export interface CellState {
  mark: Mark
  /** Free-text scratch note for this cell. Empty string = no note. */
  note: string
}

export interface Puzzle {
  id: string
  name: string
  /**
   * The grid shape *and* its play state. Keyed by `"x,y"`. A present key means
   * the cell exists; its value holds the mark/note. Absent = no cell there.
   */
  cells: Record<string, CellState>
  createdAt: number
  updatedAt: number
}

export interface Folder {
  id: string
  name: string
  /** Puzzle ids in display order. */
  puzzleIds: string[]
}

/** The entire persisted library — one blob in localStorage / a save file. */
export interface Library {
  version: 2
  folders: Folder[]
  puzzles: Record<string, Puzzle>
}
