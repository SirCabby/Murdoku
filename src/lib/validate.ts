import type { Puzzle } from '../types/puzzle'
import { parseCellKey } from './coords'

// Pure check of a player's whole solve against the author's answer key. React-
// free and side-effect-free so it can be exercised on its own; the play view
// turns the result into a popup and, on success, flips the puzzle's sticky
// `solved` badge.
//
// A solve is graded in the same order the player would notice the problems:
//   1. incomplete — some persona still isn't placed, or no suspect is accused;
//   2. conflict   — two or more people share a row or column (structurally
//                   impossible: each person owns one row and one column);
//   3. incorrect  — everyone is placed legally, but not where the key says;
//   4. solved     — every persona sits in the key's cell and the accusation
//                   names the key's murderer.
// Only the player's *definitive* answers count — tentative guesses are pencil
// marks, not a committed placement.

/** Why a solve isn't finished yet: nobody-placed vs no-accusation. */
export type IncompleteReason = 'placements' | 'accusation'

export type ValidateResult =
  | { status: 'incomplete'; reason: IncompleteReason }
  | { status: 'conflict' }
  | { status: 'incorrect' }
  | { status: 'solved' }

/** Grade a puzzle's play state against its answer key (see the module comment). */
export function validateSolve(puzzle: Puzzle): ValidateResult {
  // 1. Completeness: every persona (suspects *and* the victim) committed as an
  //    answer somewhere, and a suspect accused.
  const placed = new Set(Object.values(puzzle.answers))
  if (!puzzle.personas.every((p) => placed.has(p.id))) {
    return { status: 'incomplete', reason: 'placements' }
  }
  if (!puzzle.murderer) return { status: 'incomplete', reason: 'accusation' }

  // 2. Structural validity: at most one answered cell per row and per column.
  const perRow = new Map<number, number>()
  const perCol = new Map<number, number>()
  for (const key of Object.keys(puzzle.answers)) {
    const { x, y } = parseCellKey(key)
    perRow.set(y, (perRow.get(y) ?? 0) + 1)
    perCol.set(x, (perCol.get(x) ?? 0) + 1)
  }
  for (const count of perRow.values()) if (count > 1) return { status: 'conflict' }
  for (const count of perCol.values()) if (count > 1) return { status: 'conflict' }

  // 3/4. Correctness: the answers must reproduce the key cell-for-cell (so an
  //      extra placement or a right person in the wrong room fails), and the
  //      accusation must name the key's murderer.
  const correct =
    sameMap(puzzle.answers, puzzle.solution) &&
    puzzle.murderer === puzzle.solutionMurderer
  return { status: correct ? 'solved' : 'incorrect' }
}

/** Whether two cell→persona maps hold exactly the same entries. */
function sameMap(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) return false
  for (const key of keys) if (a[key] !== b[key]) return false
  return true
}
