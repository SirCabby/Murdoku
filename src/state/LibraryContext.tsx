import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { CellObjectKind, Folder, Library, Persona, Puzzle, RoomLabel } from '../types/puzzle'
import { loadLibrary, saveLibrary } from '../lib/storage'
import { defaultPersonas, newSuspect, suspectsOf } from '../lib/personas'
import {
  clearMarks as clearMarksOp,
  nextMark,
  setCellExists,
  setMark,
  setRectangle,
} from '../lib/board'
import { pruneWalls, setWall as setWallOp } from '../lib/walls'
import {
  pruneObjects,
  pruneWindows,
  setObject as setObjectOp,
  setWindow as setWindowOp,
} from '../lib/objects'
import {
  clearGuessesAt,
  pruneGuessPersona,
  pruneGuesses,
  toggleGuess as toggleGuessOp,
} from '../lib/guesses'
import {
  cleanupAfterAnswer,
  clearAnswerAt,
  pruneAnswerPersona,
  pruneAnswers,
  setAnswer as setAnswerOp,
} from '../lib/answers'
import {
  clearCrossAt,
  pruneCrosses,
  toggleCross as toggleCrossOp,
} from '../lib/crosses'
import { cellKey } from '../lib/coords'
import { newId } from '../lib/id'
import { useFileSync } from './useFileSync'
import type { FileSyncApi } from './useFileSync'

// Central store for the whole library. Every mutation returns a new Library and
// is persisted via the effect below. Immutable updates on a single useState.

export interface LibraryApi {
  library: Library
  /** Replace the whole library (used when importing/opening a save file). */
  replaceLibrary: (next: Library) => void
  /** Save-to-a-chosen-file layer (File System Access API + fallbacks). */
  fileSync: FileSyncApi
  // Folders
  addFolder: (name: string) => Folder
  renameFolder: (folderId: string, name: string) => void
  deleteFolder: (folderId: string) => void
  // Puzzles
  addPuzzle: (folderId: string, name: string) => Puzzle
  updatePuzzle: (puzzleId: string, patch: Partial<Puzzle>) => void
  deletePuzzle: (puzzleId: string) => void
  // Shape editing
  setCellExists: (puzzleId: string, x: number, y: number, exists: boolean) => void
  setRectangle: (puzzleId: string, width: number, height: number) => void
  clearShape: (puzzleId: string) => void
  // Walls (room boundaries)
  setWall: (puzzleId: string, key: string, on: boolean) => void
  clearWalls: (puzzleId: string) => void
  // Objects (furnishings)
  setObject: (puzzleId: string, x: number, y: number, kind: CellObjectKind | null) => void
  setWindow: (puzzleId: string, key: string, on: boolean) => void
  clearObjects: (puzzleId: string) => void
  // Room-name labels
  addLabel: (puzzleId: string, x: number, y: number) => RoomLabel
  moveLabel: (puzzleId: string, id: string, x: number, y: number) => void
  setLabelText: (puzzleId: string, id: string, text: string) => void
  removeLabel: (puzzleId: string, id: string) => void
  clearLabels: (puzzleId: string) => void
  // Personas (cast of suspects + the victim)
  addSuspect: (puzzleId: string) => Persona
  setPersonaName: (puzzleId: string, id: string, name: string) => void
  setPersonaDescription: (puzzleId: string, id: string, description: string) => void
  removePersona: (puzzleId: string, id: string) => void
  /** Set (or clear, with `null`) the player's final accusation — always a suspect. */
  setMurderer: (puzzleId: string, personaId: string | null) => void
  // Play
  cycleCell: (puzzleId: string, x: number, y: number) => void
  clearMarks: (puzzleId: string) => void
  // Guesses (per-cell tentative persona placements at play)
  toggleGuess: (puzzleId: string, x: number, y: number, personaId: string) => void
  clearGuesses: (puzzleId: string) => void
  // Answers (per-cell definitive persona placement at play). With `autoCleanup`
  // on, committing an answer also crosses out the rest of its row and column and
  // drops the persona's guesses elsewhere (see `cleanupAfterAnswer`).
  setAnswer: (
    puzzleId: string,
    x: number,
    y: number,
    personaId: string,
    autoCleanup: boolean
  ) => void
  clearAnswers: (puzzleId: string) => void
  // Crosses (per-cell "ruled out" X at play)
  toggleCross: (puzzleId: string, x: number, y: number) => void
  clearCrosses: (puzzleId: string) => void
  // Reset the whole solve: drop every guess, answer, and X in one step (the
  // puzzle definition is untouched). Recorded as a single undo entry.
  clearBoard: (puzzleId: string) => void
}

const LibraryContext = createContext<LibraryApi | null>(null)

export function LibraryProvider({ children }: { children: ReactNode }): JSX.Element {
  const [library, setLibrary] = useState<Library>(() => loadLibrary())

  useEffect(() => {
    saveLibrary(library)
  }, [library])

  const replaceLibrary = useCallback((next: Library): void => {
    setLibrary(next)
  }, [])

  const fileSync = useFileSync(library, replaceLibrary)

  // Update a single puzzle immutably and bump its timestamp.
  const patchPuzzle = useCallback(
    (puzzleId: string, update: (p: Puzzle) => Puzzle): void => {
      setLibrary((lib) => {
        const puzzle = lib.puzzles[puzzleId]
        if (!puzzle) return lib
        const next = update(puzzle)
        return {
          ...lib,
          puzzles: { ...lib.puzzles, [puzzleId]: { ...next, updatedAt: now() } },
        }
      })
    },
    []
  )

  const api = useMemo<Omit<LibraryApi, 'fileSync'>>(() => {
    return {
      library,
      replaceLibrary,

      addFolder(name) {
        const folder: Folder = { id: newId(), name: name.trim() || 'Untitled folder', puzzleIds: [] }
        setLibrary((lib) => ({ ...lib, folders: [...lib.folders, folder] }))
        return folder
      },

      renameFolder(folderId, name) {
        setLibrary((lib) => ({
          ...lib,
          folders: lib.folders.map((f) =>
            f.id === folderId ? { ...f, name: name.trim() || f.name } : f
          ),
        }))
      },

      deleteFolder(folderId) {
        setLibrary((lib) => {
          const folder = lib.folders.find((f) => f.id === folderId)
          const puzzles = { ...lib.puzzles }
          if (folder) for (const id of folder.puzzleIds) delete puzzles[id]
          return { ...lib, folders: lib.folders.filter((f) => f.id !== folderId), puzzles }
        })
      },

      addPuzzle(folderId, name) {
        const puzzle: Puzzle = {
          id: newId(),
          name: name.trim() || 'Untitled puzzle',
          cells: {},
          walls: {},
          objects: {},
          windows: {},
          labels: [],
          personas: defaultPersonas(),
          guesses: {},
          answers: {},
          crosses: {},
          murderer: null,
          createdAt: now(),
          updatedAt: now(),
        }
        setLibrary((lib) => ({
          ...lib,
          puzzles: { ...lib.puzzles, [puzzle.id]: puzzle },
          folders: lib.folders.map((f) =>
            f.id === folderId ? { ...f, puzzleIds: [...f.puzzleIds, puzzle.id] } : f
          ),
        }))
        return puzzle
      },

      updatePuzzle(puzzleId, patch) {
        patchPuzzle(puzzleId, (p) => ({ ...p, ...patch }))
      },

      deletePuzzle(puzzleId) {
        setLibrary((lib) => {
          const puzzles = { ...lib.puzzles }
          delete puzzles[puzzleId]
          return {
            ...lib,
            puzzles,
            folders: lib.folders.map((f) => ({
              ...f,
              puzzleIds: f.puzzleIds.filter((id) => id !== puzzleId),
            })),
          }
        })
      },

      setCellExists(puzzleId, x, y, exists) {
        patchPuzzle(puzzleId, (p) => {
          const cells = setCellExists(p.cells, x, y, exists)
          if (cells === p.cells) return p
          // Removing a cell can orphan walls; adding one never does.
          const walls = exists ? p.walls : pruneWalls(p.walls, cells)
          // Either add or remove can invalidate furnishings: removing takes a
          // cell's object with it, and either edit reshapes which edges qualify
          // as window mounts.
          const objects = pruneObjects(p.objects, cells)
          const windows = pruneWindows(p.windows, cells, walls)
          // Removing a cell also drops any guesses, answer, or X that sat there.
          const guesses = pruneGuesses(p.guesses, cells)
          const answers = pruneAnswers(p.answers, cells)
          const crosses = pruneCrosses(p.crosses, cells)
          return { ...p, cells, walls, objects, windows, guesses, answers, crosses }
        })
      },

      setRectangle(puzzleId, width, height) {
        patchPuzzle(puzzleId, (p) => {
          const cells = setRectangle(p.cells, width, height)
          const walls = pruneWalls(p.walls, cells)
          return {
            ...p,
            cells,
            walls,
            objects: pruneObjects(p.objects, cells),
            windows: pruneWindows(p.windows, cells, walls),
            guesses: pruneGuesses(p.guesses, cells),
            answers: pruneAnswers(p.answers, cells),
            crosses: pruneCrosses(p.crosses, cells),
          }
        })
      },

      clearShape(puzzleId) {
        patchPuzzle(puzzleId, (p) => ({
          ...p,
          cells: {},
          walls: {},
          objects: {},
          windows: {},
          // Labels are anchored in lattice space, so an empty shape leaves them
          // floating over nothing — clear them out with the cells they named.
          labels: [],
          // Guesses, answers, and crosses are keyed by cell too; none survive an emptied shape.
          guesses: {},
          answers: {},
          crosses: {},
        }))
      },

      setWall(puzzleId, key, on) {
        patchPuzzle(puzzleId, (p) => {
          const walls = setWallOp(p.walls, key, on)
          if (walls === p.walls) return p
          // Removing a wall can strip an interior edge's window.
          return { ...p, walls, windows: pruneWindows(p.windows, p.cells, walls) }
        })
      },

      clearWalls(puzzleId) {
        patchPuzzle(puzzleId, (p) =>
          Object.keys(p.walls).length === 0
            ? p
            : { ...p, walls: {}, windows: pruneWindows(p.windows, p.cells, {}) }
        )
      },

      setObject(puzzleId, x, y, kind) {
        patchPuzzle(puzzleId, (p) => {
          const key = cellKey(x, y)
          if (!(key in p.cells)) return p
          const objects = setObjectOp(p.objects, key, kind)
          return objects === p.objects ? p : { ...p, objects }
        })
      },

      setWindow(puzzleId, key, on) {
        patchPuzzle(puzzleId, (p) => {
          const windows = setWindowOp(p.windows, key, on)
          return windows === p.windows ? p : { ...p, windows }
        })
      },

      clearObjects(puzzleId) {
        patchPuzzle(puzzleId, (p) =>
          Object.keys(p.objects).length === 0 && Object.keys(p.windows).length === 0
            ? p
            : { ...p, objects: {}, windows: {} }
        )
      },

      addLabel(puzzleId, x, y) {
        const label: RoomLabel = { id: newId(), text: '', x, y }
        patchPuzzle(puzzleId, (p) => ({ ...p, labels: [...p.labels, label] }))
        return label
      },

      moveLabel(puzzleId, id, x, y) {
        patchPuzzle(puzzleId, (p) => ({
          ...p,
          labels: p.labels.map((l) => (l.id === id ? { ...l, x, y } : l)),
        }))
      },

      setLabelText(puzzleId, id, text) {
        patchPuzzle(puzzleId, (p) => ({
          ...p,
          labels: p.labels.map((l) => (l.id === id ? { ...l, text } : l)),
        }))
      },

      removeLabel(puzzleId, id) {
        patchPuzzle(puzzleId, (p) => {
          const labels = p.labels.filter((l) => l.id !== id)
          return labels.length === p.labels.length ? p : { ...p, labels }
        })
      },

      clearLabels(puzzleId) {
        patchPuzzle(puzzleId, (p) => (p.labels.length === 0 ? p : { ...p, labels: [] }))
      },

      addSuspect(puzzleId) {
        const suspect = newSuspect()
        // Keep suspects together ahead of the victim so the raw array reads in
        // label order (A, B, C, … then V); display filters by role regardless.
        patchPuzzle(puzzleId, (p) => ({
          ...p,
          personas: [
            ...p.personas.filter((x) => x.role === 'suspect'),
            suspect,
            ...p.personas.filter((x) => x.role === 'victim'),
          ],
        }))
        return suspect
      },

      setPersonaName(puzzleId, id, name) {
        patchPuzzle(puzzleId, (p) => ({
          ...p,
          personas: p.personas.map((x) => (x.id === id ? { ...x, name } : x)),
        }))
      },

      setPersonaDescription(puzzleId, id, description) {
        patchPuzzle(puzzleId, (p) => ({
          ...p,
          personas: p.personas.map((x) => (x.id === id ? { ...x, description } : x)),
        }))
      },

      removePersona(puzzleId, id) {
        patchPuzzle(puzzleId, (p) => {
          const target = p.personas.find((x) => x.id === id)
          // The victim is permanent, and at least one suspect must remain.
          if (!target || target.role === 'victim') return p
          if (suspectsOf(p.personas).length <= 1) return p
          // Drop the removed suspect's letter from any cell it was guessed or
          // answered in, and clear the accusation if it named this suspect.
          return {
            ...p,
            personas: p.personas.filter((x) => x.id !== id),
            guesses: pruneGuessPersona(p.guesses, id),
            answers: pruneAnswerPersona(p.answers, id),
            murderer: p.murderer === id ? null : p.murderer,
          }
        })
      },

      setMurderer(puzzleId, personaId) {
        patchPuzzle(puzzleId, (p) => {
          // Clearing (null) always applies; naming someone only if they're an
          // actual suspect in this cast — never the victim, never a stale id.
          if (personaId !== null && !suspectsOf(p.personas).some((s) => s.id === personaId)) {
            return p
          }
          return p.murderer === personaId ? p : { ...p, murderer: personaId }
        })
      },

      cycleCell(puzzleId, x, y) {
        patchPuzzle(puzzleId, (p) => {
          const current = p.cells[cellKey(x, y)]
          if (!current) return p
          return { ...p, cells: setMark(p.cells, x, y, nextMark(current.mark)) }
        })
      },

      clearMarks(puzzleId) {
        patchPuzzle(puzzleId, (p) => ({ ...p, cells: clearMarksOp(p.cells) }))
      },

      toggleGuess(puzzleId, x, y, personaId) {
        patchPuzzle(puzzleId, (p) => {
          // Only guess on real cells, and only with personas still in the cast.
          if (!(cellKey(x, y) in p.cells)) return p
          if (!p.personas.some((per) => per.id === personaId)) return p
          const guesses = toggleGuessOp(p.guesses, x, y, personaId)
          // A guess, an answer, and an X are mutually exclusive in a cell — start
          // guessing here and any committed answer or X gives way.
          const answers = clearAnswerAt(p.answers, x, y)
          const crosses = clearCrossAt(p.crosses, x, y)
          if (guesses === p.guesses && answers === p.answers && crosses === p.crosses) return p
          return { ...p, guesses, answers, crosses }
        })
      },

      clearGuesses(puzzleId) {
        patchPuzzle(puzzleId, (p) =>
          Object.keys(p.guesses).length === 0 ? p : { ...p, guesses: {} }
        )
      },

      setAnswer(puzzleId, x, y, personaId, autoCleanup) {
        patchPuzzle(puzzleId, (p) => {
          // Only answer on real cells, and only with personas still in the cast.
          if (!(cellKey(x, y) in p.cells)) return p
          if (!p.personas.some((per) => per.id === personaId)) return p
          // Clicking the persona already answered here toggles it back off — a
          // removal, so the automatic clean-up (which follows *committing* an
          // answer) sits this one out.
          const toggledOff = p.answers[cellKey(x, y)] === personaId
          const answers = setAnswerOp(p.answers, x, y, personaId)
          if (answers === p.answers) return p
          // Committing an answer supersedes any tentative guesses or X in that cell.
          const guesses = clearGuessesAt(p.guesses, x, y)
          const crosses = clearCrossAt(p.crosses, x, y)
          if (!autoCleanup || toggledOff) return { ...p, answers, guesses, crosses }
          // Automatic clean-up: cross out the rest of this row and column and
          // drop the just-placed persona's guesses from every other cell.
          const cleaned = cleanupAfterAnswer(
            x,
            y,
            personaId,
            p.cells,
            p.objects,
            answers,
            guesses,
            crosses
          )
          return { ...p, answers: cleaned.answers, guesses: cleaned.guesses, crosses: cleaned.crosses }
        })
      },

      clearAnswers(puzzleId) {
        patchPuzzle(puzzleId, (p) =>
          Object.keys(p.answers).length === 0 ? p : { ...p, answers: {} }
        )
      },

      toggleCross(puzzleId, x, y) {
        patchPuzzle(puzzleId, (p) => {
          // Only cross out real cells.
          if (!(cellKey(x, y) in p.cells)) return p
          const crosses = toggleCrossOp(p.crosses, x, y)
          // Marking an X supersedes any guesses or answer in that cell. (Toggling
          // one off leaves the — already empty — guesses/answer untouched.)
          const guesses = clearGuessesAt(p.guesses, x, y)
          const answers = clearAnswerAt(p.answers, x, y)
          if (crosses === p.crosses && guesses === p.guesses && answers === p.answers) return p
          return { ...p, crosses, guesses, answers }
        })
      },

      clearCrosses(puzzleId) {
        patchPuzzle(puzzleId, (p) =>
          Object.keys(p.crosses).length === 0 ? p : { ...p, crosses: {} }
        )
      },

      clearBoard(puzzleId) {
        patchPuzzle(puzzleId, (p) =>
          // Nothing placed → no-op, so a reset on an empty board doesn't push a
          // do-nothing undo step. Otherwise wipe all three play maps in one
          // update, which the history observer records as a single undoable step.
          Object.keys(p.guesses).length === 0 &&
          Object.keys(p.answers).length === 0 &&
          Object.keys(p.crosses).length === 0
            ? p
            : { ...p, guesses: {}, answers: {}, crosses: {} }
        )
      },
    }
  }, [library, patchPuzzle, replaceLibrary])

  const value = useMemo<LibraryApi>(() => ({ ...api, fileSync }), [api, fileSync])

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}

export function useLibrary(): LibraryApi {
  const ctx = useContext(LibraryContext)
  if (!ctx) throw new Error('useLibrary must be used within a LibraryProvider')
  return ctx
}

function now(): number {
  return Date.now()
}
