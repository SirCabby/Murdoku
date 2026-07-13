import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { Folder, Library, Puzzle } from '../types/puzzle'
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
import { cellKey } from '../lib/coords'
import { newId } from '../lib/id'

// Central store for the whole library. Every mutation returns a new Library and
// is persisted via the effect below. Immutable updates on a single useState.

export interface LibraryApi {
  library: Library
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

  const api = useMemo<LibraryApi>(() => {
    return {
      library,

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
          return { ...p, cells, walls }
        })
      },

      setRectangle(puzzleId, width, height) {
        patchPuzzle(puzzleId, (p) => {
          const cells = setRectangle(p.cells, width, height)
          return { ...p, cells, walls: pruneWalls(p.walls, cells) }
        })
      },

      clearShape(puzzleId) {
        patchPuzzle(puzzleId, (p) => ({ ...p, cells: {}, walls: {} }))
      },

      setWall(puzzleId, key, on) {
        patchPuzzle(puzzleId, (p) => {
          const walls = setWallOp(p.walls, key, on)
          return walls === p.walls ? p : { ...p, walls }
        })
      },

      clearWalls(puzzleId) {
        patchPuzzle(puzzleId, (p) =>
          Object.keys(p.walls).length === 0 ? p : { ...p, walls: {} }
        )
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
  }, [library, patchPuzzle])

  return <LibraryContext.Provider value={api}>{children}</LibraryContext.Provider>
}

export function useLibrary(): LibraryApi {
  const ctx = useContext(LibraryContext)
  if (!ctx) throw new Error('useLibrary must be used within a LibraryProvider')
  return ctx
}

function now(): number {
  return Date.now()
}
