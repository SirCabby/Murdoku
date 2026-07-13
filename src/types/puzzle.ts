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

/**
 * Every furnishing that can be placed in a puzzle. All but one sit *inside* a
 * square; a `window` is special — it lives on a wall (an edge between squares,
 * or the outer perimeter), never inside a square.
 */
export type ObjectKind =
  | 'chair'
  | 'carpet'
  | 'bed'
  | 'window'
  | 'table'
  | 'tv'
  | 'plant'
  | 'shelf'
  | 'box'

/** The kinds that occupy a square — every object except the wall-bound window. */
export type CellObjectKind = Exclude<ObjectKind, 'window'>

export interface Puzzle {
  id: string
  name: string
  /**
   * The grid shape *and* its play state. Keyed by `"x,y"`. A present key means
   * the cell exists; its value holds the mark/note. Absent = no cell there.
   */
  cells: Record<string, CellState>
  /**
   * Thick borders between adjacent cells that fence off rooms. Keyed by a
   * canonical edge string (`"x,y,v"` / `"x,y,h"`, see `lib/walls.ts`); a present
   * key means a wall sits on that edge. Only interior edges (both cells exist)
   * are ever stored — removing a cell prunes any wall touching it.
   */
  walls: Record<string, true>
  /**
   * Furnishings placed inside squares — at most one per square. Keyed by `"x,y"`
   * (always an existing cell); removing a cell prunes its object.
   */
  objects: Record<string, CellObjectKind>
  /**
   * Windows, which sit on walls rather than in squares. Keyed by an edge string
   * in the walls key format (`lib/walls.ts`). An edge qualifies as a window
   * mount when it is a perimeter edge (one cell exists) or an interior edge that
   * carries a wall; a window is pruned once its edge stops qualifying.
   */
  windows: Record<string, true>
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
  version: 4
  folders: Folder[]
  puzzles: Record<string, Puzzle>
}
