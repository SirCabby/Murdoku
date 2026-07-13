import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { CellObjectKind, Folder, Library, Puzzle, RoomLabel } from '../types/puzzle'
import { loadLibrary, saveLibrary } from '../lib/storage'
import {
  clearMarks as clearMarksOp,
  nextMark,
  setCellExists,
  setMark,
  setNote,
  setRectangle,
} from '../lib/board'
import { pruneWalls, setWall as setWallOp } from '../lib/walls'
import {
  pruneObjects,
  pruneWindows,
  setObject as setObjectOp,
  setWindow as setWindowOp,
} from '../lib/objects'
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
  // Play
  cycleCell: (puzzleId: string, x: number, y: number) => void
  noteCell: (puzzleId: string, x: number, y: number, note: string) => void
  clearMarks: (puzzleId: string) => void
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
          return { ...p, cells, walls, objects, windows }
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

      cycleCell(puzzleId, x, y) {
        patchPuzzle(puzzleId, (p) => {
          const current = p.cells[cellKey(x, y)]
          if (!current) return p
          return { ...p, cells: setMark(p.cells, x, y, nextMark(current.mark)) }
        })
      },

      noteCell(puzzleId, x, y, note) {
        patchPuzzle(puzzleId, (p) => ({ ...p, cells: setNote(p.cells, x, y, note) }))
      },

      clearMarks(puzzleId) {
        patchPuzzle(puzzleId, (p) => ({ ...p, cells: clearMarksOp(p.cells) }))
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
