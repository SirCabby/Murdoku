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

/**
 * A movable room-name label that floats over the board. Its position is a
 * lattice point (`x`, `y`) in cell units measured from the shape's origin — the
 * label's *bottom-centre* sits at that point, so a label whose `y` is a wall
 * gridline rests just inside the room above it, covering that wall's upper half.
 * `x` runs 0…(width) across columns (a value like `2.5` is a column centre, `2`
 * a gridline). Positions are stored explicitly (never derived from walls), so a
 * name stays put across shape and wall edits; the editor seeds a new label on
 * the bottom wall of the room it's dropped in, then lets the user drag it
 * anywhere along the walls.
 */
export interface RoomLabel {
  id: string
  /** The room name shown on the label. Empty string while first being typed. */
  text: string
  /** Lattice x of the label's centre (cell units from the origin; may be fractional). */
  x: number
  /** Lattice y of the label's centre (cell units from the origin; may be fractional). */
  y: number
}

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
  /**
   * Movable room-name labels floating over the board. Positioned in lattice
   * space (see `RoomLabel`) rather than tied to a single cell, so a name
   * survives shape and wall edits and can be slid freely along the walls.
   */
  labels: RoomLabel[]
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
  version: 6
  folders: Folder[]
  puzzles: Record<string, Puzzle>
}
