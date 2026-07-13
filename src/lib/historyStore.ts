import type { Puzzle } from '../types/puzzle'
import type { History, PlaySnapshot } from './history'
import { initHistory, snapshotOf } from './history'

// localStorage persistence for a puzzle's play-state undo/redo timeline, one key
// per puzzle. Like the UI prefs (see `lib/prefs.ts`) and unlike the library
// itself, this is scratch state: it never travels with a save file or a
// GameStateTracker sync, and reads/writes are wrapped so a storage-less
// environment (private mode) just loses history rather than breaking.
//
// A stored timeline is tied to the puzzle's *structure* by a signature. Editing
// the shape or cast prunes play state out from under the stored snapshots (a
// guess on a since-deleted cell, an answer naming a removed suspect), so a
// signature mismatch discards the old timeline instead of letting undo restore
// state that no longer fits the puzzle.

const KEY_PREFIX = 'murdoku.history.'

/** The stored form: only past/future travel (present is the live puzzle), plus the structural signature. */
interface StoredHistory {
  sig: string
  past: PlaySnapshot[]
  future: PlaySnapshot[]
}

/**
 * A fingerprint of the puzzle structure a timeline is valid against: its set of
 * cells and its cast of persona ids. Both are what the store prunes play state
 * by, so either changing invalidates stored snapshots. Order-independent.
 */
export function historySig(puzzle: Puzzle): string {
  const cells = Object.keys(puzzle.cells).sort().join('|')
  const cast = puzzle.personas.map((p) => p.id).sort().join('|')
  return `${cells}#${cast}`
}

/**
 * Load the timeline for a puzzle, or a fresh one. `present` is always the live
 * puzzle's play maps; a stored past/future is restored only when its signature
 * still matches (else the structure changed and the old trail is dropped).
 */
export function loadHistory(puzzle: Puzzle): History {
  const present = snapshotOf(puzzle)
  try {
    const raw = localStorage.getItem(KEY_PREFIX + puzzle.id)
    if (raw) {
      const stored = JSON.parse(raw) as Partial<StoredHistory>
      if (
        stored.sig === historySig(puzzle) &&
        Array.isArray(stored.past) &&
        Array.isArray(stored.future)
      ) {
        return { past: stored.past, present, future: stored.future }
      }
    }
  } catch {
    // Corrupt / unreadable — start fresh.
  }
  return initHistory(present)
}

/** Persist a timeline. The live present isn't stored — it's rebuilt from the puzzle on load. */
export function saveHistory(puzzle: Puzzle, history: History): void {
  try {
    const stored: StoredHistory = {
      sig: historySig(puzzle),
      past: history.past,
      future: history.future,
    }
    localStorage.setItem(KEY_PREFIX + puzzle.id, JSON.stringify(stored))
  } catch {
    // Storage full / unavailable (e.g. private mode). Non-fatal.
  }
}
