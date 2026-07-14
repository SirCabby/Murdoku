import type { CellObjectKind, CellState } from '../types/puzzle'
import { cellKey, parseCellKey } from './coords'
import { isPlacementBlocked } from './objects'

// Pure operations on a puzzle's `solution` map — the author's answer key, the
// definitive placement of the cast (one persona id per cell, keyed by `"x,y"`).
// Same single-value shape as `answers`, but it is *authoring* content and carries
// stricter invariants than a player's board:
//   - each persona appears at most once across the whole key, and
//   - at most one persona sits in any row or column.
// `setSolution` maintains both invariants on every placement, so the map a caller
// stores is always a legal key-so-far. Only the definitive placements are stored;
// unplaced cells are left blank on the key (no ruled-out "X" is drawn). Every
// function returns a new map (or the same reference when nothing changed), so
// callers replace `puzzle.solution` with the result, and the module stays free of
// React.

/** The persona placed in one cell of the key, or null if none. */
export function solutionAt(
  solution: Record<string, string>,
  x: number,
  y: number
): string | null {
  return solution[cellKey(x, y)] ?? null
}

/**
 * Place a persona in the answer key at (x, y), keeping the key legal. Clicking the
 * persona already there removes it (a toggle-off). Otherwise the placement wins
 * over any conflict: the persona is dropped from wherever else it sat (one cell
 * per persona) and whoever occupied the target's row or column is cleared (one
 * per row and column) before the persona lands. The target cell itself is on that
 * row and column, so a persona already there is replaced the same way.
 */
export function setSolution(
  solution: Record<string, string>,
  x: number,
  y: number,
  personaId: string
): Record<string, string> {
  const key = cellKey(x, y)
  if (solution[key] === personaId) {
    const next = { ...solution }
    delete next[key]
    return next
  }
  const next: Record<string, string> = {}
  for (const [k, id] of Object.entries(solution)) {
    if (id === personaId) continue // this persona only sits in one cell
    const { x: kx, y: ky } = parseCellKey(k)
    if (kx === x || ky === y) continue // clear the target's row and column
    next[k] = id
  }
  next[key] = personaId
  return next
}

/** Remove the placement at a cell, if any (returns the same map when there's none). */
export function clearSolutionAt(
  solution: Record<string, string>,
  x: number,
  y: number
): Record<string, string> {
  const key = cellKey(x, y)
  if (!(key in solution)) return solution
  const next = { ...solution }
  delete next[key]
  return next
}

/** Drop placements for any cell no longer in the shape. */
export function pruneSolution(
  solution: Record<string, string>,
  cells: Record<string, CellState>
): Record<string, string> {
  const next: Record<string, string> = {}
  let changed = false
  for (const [key, id] of Object.entries(solution)) {
    if (key in cells) next[key] = id
    else changed = true
  }
  return changed ? next : solution
}

/** Clear any placement naming a removed persona. */
export function pruneSolutionPersona(
  solution: Record<string, string>,
  personaId: string
): Record<string, string> {
  const next: Record<string, string> = {}
  let changed = false
  for (const [key, id] of Object.entries(solution)) {
    if (id === personaId) changed = true
    else next[key] = id
  }
  return changed ? next : solution
}

/**
 * Drop any placement whose cell now holds a placement-blocking object (a table
 * etc.) — no persona can stand there, so it can't be part of the key. Called when
 * objects change so furnishing a solved cell doesn't leave a stranded letter.
 */
export function pruneSolutionBlocked(
  solution: Record<string, string>,
  objects: Record<string, CellObjectKind>
): Record<string, string> {
  const next: Record<string, string> = {}
  let changed = false
  for (const [key, id] of Object.entries(solution)) {
    if (isPlacementBlocked(objects, key)) changed = true
    else next[key] = id
  }
  return changed ? next : solution
}
