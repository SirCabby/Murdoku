import { useCallback, useEffect, useRef, useState } from 'react'
import type { Puzzle } from '../types/puzzle'
import { useLibrary } from './LibraryContext'
import {
  canRedo as canRedoOf,
  canUndo as canUndoOf,
  record,
  redo as redoOf,
  sameSnapshot,
  snapshotOf,
  undo as undoOf,
} from '../lib/history'
import type { History, PlaySnapshot } from '../lib/history'
import { loadHistory, saveHistory } from '../lib/historyStore'

export interface PlayHistoryApi {
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
}

/**
 * Undo/redo for a puzzle's play state (guesses, answers, crosses), persisted to
 * localStorage and driven by Ctrl/Cmd+Z / Ctrl/Cmd+Y (or Shift+Z to redo) as well
 * as the returned callbacks.
 *
 * Rather than intercept each board action, it *observes* the live play maps: any
 * change the store makes — including the multi-map cascade an automatic clean-up
 * performs — is recorded as one step, because the store keeps a map's reference
 * stable when its contents don't change, so a reference diff is exactly "this
 * action touched it". Undo/redo write a past snapshot back through the store,
 * which leaves the maps identical (by reference) to the recorded present, so the
 * observer sees no new change and never re-records its own work.
 *
 * The puzzle id is assumed stable for the hook's lifetime — the player remounts
 * per puzzle (App keys it by id) — so the timeline is loaded once on mount.
 */
export function usePlayHistory(puzzle: Puzzle | undefined): PlayHistoryApi {
  const { updatePuzzle } = useLibrary()

  const [history, setHistory] = useState<History | null>(() =>
    puzzle ? loadHistory(puzzle) : null
  )

  // Latest puzzle / history for the once-bound shortcut handler and callbacks.
  const puzzleRef = useRef(puzzle)
  puzzleRef.current = puzzle
  const historyRef = useRef(history)
  historyRef.current = history
  // The snapshot an in-flight undo/redo is applying. The observer skips it so a
  // restore isn't mistaken for a fresh edit — a guard for the (rare) render where
  // the store update lands before this hook's own setHistory.
  const applyingRef = useRef<PlaySnapshot | null>(null)

  // Observe the live play maps: record any change that isn't our own undo/redo.
  useEffect(() => {
    if (!puzzle || !history) return
    const cur = snapshotOf(puzzle)
    if (sameSnapshot(cur, history.present)) return
    if (applyingRef.current && sameSnapshot(cur, applyingRef.current)) {
      applyingRef.current = null
      return
    }
    setHistory((h) => (h ? record(h, cur) : h))
  }, [puzzle, history])

  // Persist the timeline whenever it (or the puzzle it's keyed to) changes.
  useEffect(() => {
    if (puzzle && history) saveHistory(puzzle, history)
  }, [puzzle, history])

  // Restore a timeline's present to the board and adopt it as the new history.
  const apply = useCallback(
    (next: History): void => {
      const p = puzzleRef.current
      if (!p) return
      const { guesses, answers, crosses } = next.present
      applyingRef.current = next.present
      updatePuzzle(p.id, { guesses, answers, crosses })
      setHistory(next)
    },
    [updatePuzzle]
  )

  const undo = useCallback((): void => {
    const h = historyRef.current
    if (!h) return
    const next = undoOf(h)
    if (next) apply(next)
  }, [apply])

  const redo = useCallback((): void => {
    const h = historyRef.current
    if (!h) return
    const next = redoOf(h)
    if (next) apply(next)
  }, [apply])

  // Bind the global shortcuts once, reading the latest handlers through refs so
  // the listener never rebinds as the puzzle/history change on every action.
  const undoRef = useRef(undo)
  undoRef.current = undo
  const redoRef = useRef(redo)
  redoRef.current = redo
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (!(e.ctrlKey || e.metaKey)) return
      const key = e.key.toLowerCase()
      if (key !== 'z' && key !== 'y') return
      // Leave a text field's own undo alone (none in the play view today — a guard
      // against a future input landing under the shortcut).
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undoRef.current()
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault()
        redoRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return {
    canUndo: history ? canUndoOf(history) : false,
    canRedo: history ? canRedoOf(history) : false,
    undo,
    redo,
  }
}
