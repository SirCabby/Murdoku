// Core domain model for Murdoku.
//
// A Murdle-style puzzle is a set of *categories* (e.g. Suspects, Weapons,
// Locations), each holding an equal number of *items*. Solving means deciding,
// for every pair of items drawn from two different categories, whether they go
// together (`yes`) or not (`no`). Those decisions live in `Puzzle.cells`, keyed
// by a canonical, order-independent pair key (see `lib/cells.ts`).

/** A single cell's deduction state. `blank` = undecided. */
export type Mark = 'blank' | 'no' | 'yes'

export interface Item {
  id: string
  label: string
}

export interface Category {
  id: string
  name: string
  items: Item[]
}

export interface CellState {
  mark: Mark
  /** Free-text scratch note for this pairing. Empty string = no note. */
  note: string
}

export interface Puzzle {
  id: string
  name: string
  /** Optional mystery flavor text / the prompt the player is solving. */
  flavor: string
  categories: Category[]
  /** Pair state, keyed by `cellKey(...)`. Absent keys are treated as blank. */
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
  version: 1
  folders: Folder[]
  puzzles: Record<string, Puzzle>
}
