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

/** A persona is either one of the puzzle's suspects or its single victim. */
export type PersonaRole = 'suspect' | 'victim'

/**
 * A character in the puzzle: a suspect or the victim. A puzzle always has one or
 * more suspects and exactly one victim.
 *
 * Display labels are *derived*, never stored: the victim is always `V`, and the
 * suspects are lettered `A`, `B`, `C`, … by their order among the suspects (see
 * `lib/personas.ts`). Only the identity (`id`) is stable — relettering a suspect
 * after a deletion doesn't disturb the others' ids, matching how item ids stay
 * put across relabels elsewhere in the app.
 */
export interface Persona {
  id: string
  role: PersonaRole
  /** The character's name. Empty string until the author fills it in. */
  name: string
  /** Free-text description / backstory. Empty string = none. */
  description: string
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
  /**
   * The puzzle's cast: one or more suspects plus exactly one victim. Order among
   * the suspects sets their derived letters (see `Persona`); the array as a whole
   * has no spatial meaning, unlike the maps above.
   */
  personas: Persona[]
  /**
   * The player's placement guesses: which personas they think occupy each cell.
   * Keyed by `"x,y"` (always an existing cell) to an array of persona ids; a cell
   * can hold several guesses at once, so the value is a list rather than a single
   * id. The ids point into `personas` — the letters shown in a cell are derived
   * from them (see `lib/personas.ts`), never stored. Removing a cell drops its
   * entry, and removing a persona strips its id from every cell.
   */
  guesses: Record<string, string[]>
  /**
   * The player's definitive answers: the one persona they've committed to for a
   * cell. Keyed by `"x,y"` (always an existing cell) to a single persona id —
   * unlike `guesses`, at most one per cell, mirroring `objects`. An answer and a
   * guess are mutually exclusive in a cell: committing an answer clears that
   * cell's guesses, and adding a guess clears its answer. The letter shown is
   * derived from the id (see `lib/personas.ts`), never stored. Removing a cell
   * drops its entry, and removing a persona clears any answer naming it.
   */
  answers: Record<string, string>
  /**
   * The player's crossed-out cells: rooms they've ruled out entirely (a big grey
   * "X"). Keyed by `"x,y"` (always an existing cell); a present key means an X
   * sits there. Persona-independent — unlike guesses/answers it names no cast
   * member. An X is mutually exclusive with a cell's guesses and answer: marking
   * an X clears both, and placing a guess or answer clears the X. Removing a cell
   * drops its entry.
   */
  crosses: Record<string, true>
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
  version: 10
  folders: Folder[]
  puzzles: Record<string, Puzzle>
}
