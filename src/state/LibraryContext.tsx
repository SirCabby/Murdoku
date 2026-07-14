import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { CellObjectKind, Clue, Folder, Hint, Library, Persona, Puzzle, RoomLabel } from '../types/puzzle'
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
  isPlacementBlocked,
  pruneDoors,
  pruneObjects,
  pruneWindows,
  setDoor as setDoorOp,
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
import {
  pruneSolution,
  pruneSolutionBlocked,
  pruneSolutionPersona,
  setSolution as setSolutionOp,
} from '../lib/solution'
import { cellKey } from '../lib/coords'
import { newId } from '../lib/id'
import { clearHistory } from '../lib/historyStore'
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
  /**
   * Reset every *completed* puzzle in a folder back to a fresh replay: clears each
   * solved puzzle's play board (guesses, answers, crosses), its final accusation,
   * and its sticky solved badge, and drops its undo history. In-progress (unsolved)
   * puzzles in the folder are left untouched, as is all authoring content (shape,
   * cast, hints, answer key). Returns how many puzzles were reset.
   */
  resetSolvedInFolder: (folderId: string) => number
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
  /** Add or remove a door on an edge — legal only on an interior wall. */
  setDoor: (puzzleId: string, key: string, on: boolean) => void
  clearObjects: (puzzleId: string) => void
  // Room-name labels
  addLabel: (puzzleId: string, x: number, y: number) => RoomLabel
  moveLabel: (puzzleId: string, id: string, x: number, y: number) => void
  setLabelText: (puzzleId: string, id: string, text: string) => void
  removeLabel: (puzzleId: string, id: string) => void
  clearLabels: (puzzleId: string) => void
  // Hints (the author's ordered, numbered clues)
  addHint: (puzzleId: string) => Hint
  setHintText: (puzzleId: string, id: string, text: string) => void
  removeHint: (puzzleId: string, id: string) => void
  clearHints: (puzzleId: string) => void
  // Clues (extra room-bound facts shown beside the cast, naming no persona)
  addClue: (puzzleId: string) => Clue
  setClueText: (puzzleId: string, id: string, text: string) => void
  removeClue: (puzzleId: string, id: string) => void
  clearClues: (puzzleId: string) => void
  // Personas (cast of suspects + the victim)
  addSuspect: (puzzleId: string) => Persona
  setPersonaName: (puzzleId: string, id: string, name: string) => void
  setPersonaDescription: (puzzleId: string, id: string, description: string) => void
  removePersona: (puzzleId: string, id: string) => void
  /** Set (or clear, with `null`) the player's final accusation — always a suspect. */
  setMurderer: (puzzleId: string, personaId: string | null) => void
  /** Set the sticky "solved" completion badge (flipped true by a correct Validate). */
  setSolved: (puzzleId: string, solved: boolean) => void
  // Answer key (the author's definitive per-cell placement of the cast). Placing
  // keeps the key legal: one cell per persona, at most one per row and column (see
  // `lib/solution.ts`); re-placing the same persona in its cell clears it.
  setSolution: (puzzleId: string, x: number, y: number, personaId: string) => void
  clearSolution: (puzzleId: string) => void
  /** Set (or clear, with `null`) the answer key's murderer — always a suspect. */
  setSolutionMurderer: (puzzleId: string, personaId: string | null) => void
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

      resetSolvedInFolder(folderId) {
        const folder = library.folders.find((f) => f.id === folderId)
        if (!folder) return 0
        const solvedIds = folder.puzzleIds.filter((id) => library.puzzles[id]?.solved)
        if (solvedIds.length === 0) return 0
        setLibrary((lib) => {
          const puzzles = { ...lib.puzzles }
          const at = now()
          for (const id of solvedIds) {
            const p = puzzles[id]
            if (!p) continue
            // Back to the pristine play state a new puzzle starts with — authoring
            // content (cells, walls, objects, personas, hints, answer key) untouched.
            puzzles[id] = {
              ...p,
              guesses: {},
              answers: {},
              crosses: {},
              murderer: null,
              solved: false,
              updatedAt: at,
            }
          }
          return { ...lib, puzzles }
        })
        // Drop each reset puzzle's undo trail so the finished solve can't be undone
        // back into place the next time it's opened.
        for (const id of solvedIds) clearHistory(id)
        return solvedIds.length
      },

      addPuzzle(folderId, name) {
        const puzzle: Puzzle = {
          id: newId(),
          name: name.trim() || 'Untitled puzzle',
          cells: {},
          walls: {},
          objects: {},
          windows: {},
          doors: {},
          labels: [],
          hints: [],
          personas: defaultPersonas(),
          clues: [],
          guesses: {},
          answers: {},
          crosses: {},
          murderer: null,
          solution: {},
          solutionMurderer: null,
          solved: false,
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
          const doors = pruneDoors(p.doors, cells, walls)
          // Removing a cell also drops any guesses, answer, X, or answer-key
          // placement that sat there.
          const guesses = pruneGuesses(p.guesses, cells)
          const answers = pruneAnswers(p.answers, cells)
          const crosses = pruneCrosses(p.crosses, cells)
          const solution = pruneSolution(p.solution, cells)
          return { ...p, cells, walls, objects, windows, doors, guesses, answers, crosses, solution }
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
            doors: pruneDoors(p.doors, cells, walls),
            guesses: pruneGuesses(p.guesses, cells),
            answers: pruneAnswers(p.answers, cells),
            crosses: pruneCrosses(p.crosses, cells),
            solution: pruneSolution(p.solution, cells),
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
          doors: {},
          // Labels are anchored in lattice space, so an empty shape leaves them
          // floating over nothing — clear them out with the cells they named.
          labels: [],
          // Guesses, answers, crosses, and the answer key are keyed by cell too;
          // none survive an emptied shape.
          guesses: {},
          answers: {},
          crosses: {},
          solution: {},
        }))
      },

      setWall(puzzleId, key, on) {
        patchPuzzle(puzzleId, (p) => {
          const walls = setWallOp(p.walls, key, on)
          if (walls === p.walls) return p
          // Removing a wall can strip an interior edge's window, and always
          // strips any door that was mounted on that wall.
          return {
            ...p,
            walls,
            windows: pruneWindows(p.windows, p.cells, walls),
            doors: pruneDoors(p.doors, p.cells, walls),
          }
        })
      },

      clearWalls(puzzleId) {
        patchPuzzle(puzzleId, (p) =>
          Object.keys(p.walls).length === 0
            ? p
            : {
                ...p,
                walls: {},
                windows: pruneWindows(p.windows, p.cells, {}),
                doors: pruneDoors(p.doors, p.cells, {}),
              }
        )
      },

      setObject(puzzleId, x, y, kind) {
        patchPuzzle(puzzleId, (p) => {
          const key = cellKey(x, y)
          if (!(key in p.cells)) return p
          const objects = setObjectOp(p.objects, key, kind)
          if (objects === p.objects) return p
          // A placement-blocking object (a table etc.) can't share its cell with a
          // cast member, so furnishing a solved cell drops that answer-key entry.
          const solution = pruneSolutionBlocked(p.solution, objects)
          return { ...p, objects, solution }
        })
      },

      setWindow(puzzleId, key, on) {
        patchPuzzle(puzzleId, (p) => {
          const windows = setWindowOp(p.windows, key, on)
          return windows === p.windows ? p : { ...p, windows }
        })
      },

      setDoor(puzzleId, key, on) {
        patchPuzzle(puzzleId, (p) => {
          const doors = setDoorOp(p.doors, key, on)
          return doors === p.doors ? p : { ...p, doors }
        })
      },

      clearObjects(puzzleId) {
        patchPuzzle(puzzleId, (p) =>
          Object.keys(p.objects).length === 0 &&
          Object.keys(p.windows).length === 0 &&
          Object.keys(p.doors).length === 0
            ? p
            : { ...p, objects: {}, windows: {}, doors: {} }
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

      addHint(puzzleId) {
        // Appended to the end so it takes the next number in sequence.
        const hint: Hint = { id: newId(), text: '' }
        patchPuzzle(puzzleId, (p) => ({ ...p, hints: [...p.hints, hint] }))
        return hint
      },

      setHintText(puzzleId, id, text) {
        patchPuzzle(puzzleId, (p) => ({
          ...p,
          hints: p.hints.map((h) => (h.id === id ? { ...h, text } : h)),
        }))
      },

      removeHint(puzzleId, id) {
        patchPuzzle(puzzleId, (p) => {
          const hints = p.hints.filter((h) => h.id !== id)
          return hints.length === p.hints.length ? p : { ...p, hints }
        })
      },

      clearHints(puzzleId) {
        patchPuzzle(puzzleId, (p) => (p.hints.length === 0 ? p : { ...p, hints: [] }))
      },

      addClue(puzzleId) {
        // Appended to the end so it slots after the existing clues in the panel.
        const clue: Clue = { id: newId(), text: '' }
        patchPuzzle(puzzleId, (p) => ({ ...p, clues: [...p.clues, clue] }))
        return clue
      },

      setClueText(puzzleId, id, text) {
        patchPuzzle(puzzleId, (p) => ({
          ...p,
          clues: p.clues.map((c) => (c.id === id ? { ...c, text } : c)),
        }))
      },

      removeClue(puzzleId, id) {
        patchPuzzle(puzzleId, (p) => {
          const clues = p.clues.filter((c) => c.id !== id)
          return clues.length === p.clues.length ? p : { ...p, clues }
        })
      },

      clearClues(puzzleId) {
        patchPuzzle(puzzleId, (p) => (p.clues.length === 0 ? p : { ...p, clues: [] }))
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
          // Drop the removed suspect's letter from any cell it was guessed,
          // answered, or placed in the key, and clear either accusation (the
          // answer key's or the player's) if it named this suspect.
          return {
            ...p,
            personas: p.personas.filter((x) => x.id !== id),
            guesses: pruneGuessPersona(p.guesses, id),
            answers: pruneAnswerPersona(p.answers, id),
            solution: pruneSolutionPersona(p.solution, id),
            solutionMurderer: p.solutionMurderer === id ? null : p.solutionMurderer,
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

      setSolved(puzzleId, solved) {
        patchPuzzle(puzzleId, (p) => (p.solved === solved ? p : { ...p, solved }))
      },

      setSolution(puzzleId, x, y, personaId) {
        patchPuzzle(puzzleId, (p) => {
          // Only place on real, placeable cells, and only with a persona still in
          // the cast — a table etc. can't hold anyone.
          const key = cellKey(x, y)
          if (!(key in p.cells)) return p
          if (isPlacementBlocked(p.objects, key)) return p
          if (!p.personas.some((per) => per.id === personaId)) return p
          const solution = setSolutionOp(p.solution, x, y, personaId)
          return solution === p.solution ? p : { ...p, solution }
        })
      },

      clearSolution(puzzleId) {
        patchPuzzle(puzzleId, (p) =>
          Object.keys(p.solution).length === 0 ? p : { ...p, solution: {} }
        )
      },

      setSolutionMurderer(puzzleId, personaId) {
        patchPuzzle(puzzleId, (p) => {
          // Clearing (null) always applies; naming someone only if they're an
          // actual suspect in this cast — never the victim, never a stale id.
          if (personaId !== null && !suspectsOf(p.personas).some((s) => s.id === personaId)) {
            return p
          }
          return p.solutionMurderer === personaId ? p : { ...p, solutionMurderer: personaId }
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
        patchPuzzle(puzzleId, (p) => {
          // Nothing placed and not solved → no-op, so a reset on a pristine board
          // doesn't push a do-nothing undo step.
          const empty =
            Object.keys(p.guesses).length === 0 &&
            Object.keys(p.answers).length === 0 &&
            Object.keys(p.crosses).length === 0
          if (empty && !p.solved) return p
          // Wipe all three play maps in one update (the history observer records
          // that as a single undoable step) and drop the sticky solved badge —
          // `solved` is outside the undo snapshot, so a later undo restores the
          // marks but leaves the case unsolved until it's re-validated.
          return { ...p, guesses: {}, answers: {}, crosses: {}, solved: false }
        })
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
