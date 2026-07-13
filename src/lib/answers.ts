import type { CellState } from '../types/puzzle'
import { cellKey } from './coords'

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
