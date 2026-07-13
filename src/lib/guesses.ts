import type { CellState } from '../types/puzzle'
import { cellKey } from './coords'

// Pure operations on a puzzle's `guesses` map — the player's per-cell record of
// which personas they think occupy each square. Mirrors how `objects`/`windows`
// are split off from the cell state: keyed by `"x,y"`, each entry a list of
// persona ids (a cell can hold several guesses at once). Labels are never stored
// here — they're derived from the ids against `personas` (see `lib/personas.ts`).
// Every function returns a new map (or the same reference when nothing changed),
// so callers replace `puzzle.guesses` with the result, and stays free of React.

/** The persona ids guessed for one cell, in stored order (never undefined). */
export function guessesAt(
  guesses: Record<string, string[]>,
  x: number,
  y: number
): string[] {
  return guesses[cellKey(x, y)] ?? []
}

/**
 * Add or remove one persona's guess at a cell. If the persona is already guessed
 * there it's removed (emptying the entry drops the key); otherwise it's appended.
 * A cell can hold several guesses, so this toggles a single id without disturbing
 * the others.
 */
export function toggleGuess(
  guesses: Record<string, string[]>,
  x: number,
  y: number,
  personaId: string
): Record<string, string[]> {
  const key = cellKey(x, y)
  const current = guesses[key] ?? []
  const next = { ...guesses }
  if (current.includes(personaId)) {
    const remaining = current.filter((id) => id !== personaId)
    if (remaining.length === 0) delete next[key]
    else next[key] = remaining
  } else {
    next[key] = [...current, personaId]
  }
  return next
}

/** Drop guesses for any cell no longer in the shape. */
export function pruneGuesses(
  guesses: Record<string, string[]>,
  cells: Record<string, CellState>
): Record<string, string[]> {
  const next: Record<string, string[]> = {}
  let changed = false
  for (const [key, ids] of Object.entries(guesses)) {
    if (key in cells) next[key] = ids
    else changed = true
  }
  return changed ? next : guesses
}

/** Strip a removed persona's id from every cell's guesses (emptied cells drop out). */
export function pruneGuessPersona(
  guesses: Record<string, string[]>,
  personaId: string
): Record<string, string[]> {
  const next: Record<string, string[]> = {}
  let changed = false
  for (const [key, ids] of Object.entries(guesses)) {
    if (!ids.includes(personaId)) {
      next[key] = ids
      continue
    }
    changed = true
    const remaining = ids.filter((id) => id !== personaId)
    if (remaining.length > 0) next[key] = remaining
  }
  return changed ? next : guesses
}
