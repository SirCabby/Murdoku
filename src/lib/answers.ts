import type { CellObjectKind, CellState } from '../types/puzzle'
import { cellKey, parseCellKey } from './coords'
import { isPlacementBlocked } from './objects'
import { pruneGuessPersona } from './guesses'

// Pure operations on a puzzle's `answers` map — the player's per-cell definitive
// placement (which single persona they've committed to occupies each square).
// Keyed by `"x,y"` to one persona id, at most one per cell — the same shape as
// `objects`, unlike `guesses` which holds a list. Labels are never stored here;
// they're derived from the id against `personas` (see `lib/personas.ts`). Every
// function returns a new map (or the same reference when nothing changed), so
// callers replace `puzzle.answers` with the result, and stays free of React.
//
// An answer and a guess are mutually exclusive in a cell — the cross-map clearing
// that enforces that lives in the store (see `LibraryContext`), not here.

/** The persona id answered for one cell, or null if unanswered. */
export function answerAt(
  answers: Record<string, string>,
  x: number,
  y: number
): string | null {
  return answers[cellKey(x, y)] ?? null
}

/**
 * Commit or clear the answer at a cell. Placing the persona already answered
 * there removes it (a toggle-off); any other persona replaces it. There's only
 * ever one answer per cell, so this never appends.
 */
export function setAnswer(
  answers: Record<string, string>,
  x: number,
  y: number,
  personaId: string
): Record<string, string> {
  const key = cellKey(x, y)
  const next = { ...answers }
  if (answers[key] === personaId) delete next[key]
  else next[key] = personaId
  return next
}

/** Remove the answer at a cell, if any (returns the same map when there's none). */
export function clearAnswerAt(
  answers: Record<string, string>,
  x: number,
  y: number
): Record<string, string> {
  const key = cellKey(x, y)
  if (!(key in answers)) return answers
  const next = { ...answers }
  delete next[key]
  return next
}

/** Drop answers for any cell no longer in the shape. */
export function pruneAnswers(
  answers: Record<string, string>,
  cells: Record<string, CellState>
): Record<string, string> {
  const next: Record<string, string> = {}
  let changed = false
  for (const [key, id] of Object.entries(answers)) {
    if (key in cells) next[key] = id
    else changed = true
  }
  return changed ? next : answers
}

/** The three placement maps the automatic clean-up rewrites in one pass. */
export interface AnswerCleanup {
  answers: Record<string, string>
  guesses: Record<string, string[]>
  crosses: Record<string, true>
}

/**
 * The "automatic" clean-up that follows committing an answer at (x, y). Pinning
 * `personaId` to that one cell has two consequences the player would otherwise
 * mark by hand:
 *   1. Every other *placeable* cell sharing its row or column is a room the
 *      occupant can't also be in, so it's crossed out — and whatever guess or
 *      answer sat there gives way, exactly as a hand-placed X does.
 *   2. The persona is now fixed here, so its id is stripped from every other
 *      cell's guesses (cells off this row/column keep their remaining guesses).
 * Cells that can't hold a placement at all (a table etc. — `isPlacementBlocked`)
 * are left untouched, matching how they refuse a manual X. Pure: pass the maps
 * in *after* the answer itself is set, and replace all three with the result.
 */
export function cleanupAfterAnswer(
  x: number,
  y: number,
  personaId: string,
  cells: Record<string, CellState>,
  objects: Record<string, CellObjectKind>,
  answers: Record<string, string>,
  guesses: Record<string, string[]>,
  crosses: Record<string, true>
): AnswerCleanup {
  const placed = cellKey(x, y)
  const nextCrosses = { ...crosses }
  const nextAnswers = { ...answers }
  const clearedGuesses = { ...guesses }
  for (const key of Object.keys(cells)) {
    if (key === placed) continue
    const { x: cx, y: cy } = parseCellKey(key)
    if (cx !== x && cy !== y) continue // not in this cell's row or column
    if (isPlacementBlocked(objects, key)) continue
    nextCrosses[key] = true
    delete nextAnswers[key]
    delete clearedGuesses[key]
  }
  return {
    answers: nextAnswers,
    guesses: pruneGuessPersona(clearedGuesses, personaId),
    crosses: nextCrosses,
  }
}

/** Clear any answer naming a removed persona (its cells become unanswered). */
export function pruneAnswerPersona(
  answers: Record<string, string>,
  personaId: string
): Record<string, string> {
  const next: Record<string, string> = {}
  let changed = false
  for (const [key, id] of Object.entries(answers)) {
    if (id === personaId) changed = true
    else next[key] = id
  }
  return changed ? next : answers
}
