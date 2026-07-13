import type { Puzzle } from '../types/puzzle'

// Pure undo/redo algebra for a puzzle's *play* state. Side-effect-free and React-
// free (persistence lives in `lib/historyStore.ts`, the wiring in
// `state/usePlayHistory.ts`), so it's independently testable.
//
// A board action only ever touches the three play maps below — the shape and
// cast (cells, walls, personas, …) aren't play state, so a snapshot leaves them
// out and undo rewinds exactly what a board click could have changed. Capturing
// all three together is what lets one undo revert an automatic clean-up's whole
// cascade (it rewrites answers, guesses and crosses in a single action).

/** The three maps a board action can change, snapshotted together. */
export interface PlaySnapshot {
  guesses: Record<string, string[]>
  answers: Record<string, string>
  crosses: Record<string, true>
}

/**
 * A bounded undo/redo timeline. `present` is the live play state; `past` holds
 * prior snapshots (oldest first, most-recent last) and `future` the redo trail
 * (next-to-redo first).
 */
export interface History {
  past: PlaySnapshot[]
  present: PlaySnapshot
  future: PlaySnapshot[]
}

/**
 * How many undo steps to keep. A snapshot is a copy of all three maps, so an
 * unbounded stack could bloat localStorage over a long session; past this many
 * the oldest step is dropped.
 */
export const HISTORY_LIMIT = 100

export function initHistory(present: PlaySnapshot): History {
  return { past: [], present, future: [] }
}

/**
 * The play maps of a puzzle as a snapshot. The map *references* are shared, not
 * copied: the store hands back a new reference for a map only when its contents
 * change (and the same one otherwise), so `sameSnapshot` can tell "this action
 * touched it" from a cheap reference check.
 */
export function snapshotOf(puzzle: Puzzle): PlaySnapshot {
  return { guesses: puzzle.guesses, answers: puzzle.answers, crosses: puzzle.crosses }
}

/** Whether two snapshots hold the same three maps by reference (see `snapshotOf`). */
export function sameSnapshot(a: PlaySnapshot, b: PlaySnapshot): boolean {
  return a.guesses === b.guesses && a.answers === b.answers && a.crosses === b.crosses
}

/**
 * Record `next` as the new present, pushing the old present onto the undo stack
 * and dropping any redo trail. A no-op when `next` already *is* the present (same
 * references), so it's safe to call on every observed change. The undo stack is
 * capped at `HISTORY_LIMIT`, shedding its oldest entry.
 */
export function record(history: History, next: PlaySnapshot): History {
  if (sameSnapshot(history.present, next)) return history
  const past = [...history.past, history.present]
  if (past.length > HISTORY_LIMIT) past.shift()
  return { past, present: next, future: [] }
}

export function canUndo(history: History): boolean {
  return history.past.length > 0
}

export function canRedo(history: History): boolean {
  return history.future.length > 0
}

/** Step back one snapshot, or null when there's nothing to undo. */
export function undo(history: History): History | null {
  if (history.past.length === 0) return null
  const present = history.past[history.past.length - 1]!
  const past = history.past.slice(0, -1)
  return { past, present, future: [history.present, ...history.future] }
}

/** Step forward one snapshot, or null when there's nothing to redo. */
export function redo(history: History): History | null {
  if (history.future.length === 0) return null
  const present = history.future[0]!
  const future = history.future.slice(1)
  return { past: [...history.past, history.present], present, future }
}
