import type { CellState } from '../types/puzzle'
import { cellKey } from './coords'

// Pure operations on a puzzle's `crosses` map — the player's crossed-out cells,
// rooms they've ruled out entirely (drawn as a big grey "X"). A boolean set keyed
// by `"x,y"`, the same shape as `walls`/`windows`; presence means an X sits there.
// Persona-independent — unlike guesses/answers it names no cast member. Every
// function returns a new map (or the same reference when nothing changed), so
// callers replace `puzzle.crosses` with the result, and stays free of React.
//
// An X is mutually exclusive with a cell's guesses and answer — the cross-map
// clearing that enforces that lives in the store (see `LibraryContext`), not here.

/** Whether a cell is crossed out. */
export function hasCrossAt(
  crosses: Record<string, true>,
  x: number,
  y: number
): boolean {
  return crosses[cellKey(x, y)] === true
}

/** Toggle the X at a cell: add it if absent, remove it if present. */
export function toggleCross(
  crosses: Record<string, true>,
  x: number,
  y: number
): Record<string, true> {
  const key = cellKey(x, y)
  const next = { ...crosses }
  if (next[key]) delete next[key]
  else next[key] = true
  return next
}

/** Remove the X at a cell, if any (returns the same map when there's none). */
export function clearCrossAt(
  crosses: Record<string, true>,
  x: number,
  y: number
): Record<string, true> {
  const key = cellKey(x, y)
  if (!(key in crosses)) return crosses
  const next = { ...crosses }
  delete next[key]
  return next
}

/** Drop crosses for any cell no longer in the shape. */
export function pruneCrosses(
  crosses: Record<string, true>,
  cells: Record<string, CellState>
): Record<string, true> {
  const next: Record<string, true> = {}
  let changed = false
  for (const key of Object.keys(crosses)) {
    if (key in cells) next[key] = true
    else changed = true
  }
  return changed ? next : crosses
}
