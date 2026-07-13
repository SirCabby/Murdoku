import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type {
  Category,
  Folder,
  Item,
  Library,
  Mark,
  Puzzle,
} from '../types/puzzle'
import { loadLibrary, saveLibrary } from '../lib/storage'
import { setMark, setNote } from '../lib/marks'
import { newId } from '../lib/id'

// Central store for the whole library. Every mutation returns a new Library and
// is persisted to storage via the effect below. Kept deliberately simple —
// immutable updates on a single useState value.

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
  // Play
  cycleCell: (
    puzzleId: string,
    catA: Category,
    itemA: Item,
    catB: Category,
    itemB: Item,
    nextMark: Mark,
    autoEliminate: boolean
  ) => void
  noteCell: (
    puzzleId: string,
    catA: Category,
    itemA: Item,
    catB: Category,
    itemB: Item,
    note: string
  ) => void
  clearMarks: (puzzleId: string) => void
}

const LibraryContext = createContext<LibraryApi | null>(null)

export function LibraryProvider({ children }: { children: ReactNode }): JSX.Element {
  const [library, setLibrary] = useState<Library>(() => loadLibrary())

  useEffect(() => {
    saveLibrary(library)
  }, [library])

  // Small helper to update a single puzzle immutably and bump its timestamp.
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
          return {
            ...lib,
            folders: lib.folders.filter((f) => f.id !== folderId),
            puzzles,
          }
        })
      },

      addPuzzle(folderId, name) {
        const puzzle: Puzzle = {
          id: newId(),
          name: name.trim() || 'Untitled puzzle',
          flavor: '',
          categories: [],
          cells: {},
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

      cycleCell(puzzleId, catA, itemA, catB, itemB, nextMark, autoEliminate) {
        patchPuzzle(puzzleId, (p) => ({
          ...p,
          cells: setMark(p, catA, itemA, catB, itemB, nextMark, autoEliminate),
        }))
      },

      noteCell(puzzleId, catA, itemA, catB, itemB, note) {
        patchPuzzle(puzzleId, (p) => ({
          ...p,
          cells: setNote(p, catA, itemA, catB, itemB, note),
        }))
      },

      clearMarks(puzzleId) {
        patchPuzzle(puzzleId, (p) => ({ ...p, cells: {} }))
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
