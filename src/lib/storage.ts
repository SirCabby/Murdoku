import type { CellState, Folder, Library, Puzzle } from '../types/puzzle'
import { cellKey } from './coords'
import { wallKey } from './walls'
import { newId } from './id'

// Persistence for the whole library. For now this is localStorage, which keeps
// Murdoku fully functional standalone. When launched from GameStateTracker we
// will additionally sync this blob to the connected save file (see lib/gst.ts);
// that hook is intentionally not wired up yet.

const STORAGE_KEY = 'murdoku.library.v3'
const LEGACY_V2_KEY = 'murdoku.library.v2'

export function emptyLibrary(): Library {
  return { version: 3, folders: [], puzzles: {} }
}

export function loadLibrary(): Library {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Library
      if (parsed && parsed.version === 3 && Array.isArray(parsed.folders)) {
        return parsed
      }
    }
    // Nothing (valid) at v3 yet — pull a v2 library forward if the user has one.
    const migrated = migrateFromV2()
    if (migrated) return migrated
  } catch {
    // Corrupt or unreadable — fall through to a fresh library.
  }
  return seedLibrary()
}

/** A pre-walls (version 2) puzzle, as it still sits in some users' storage. */
interface PuzzleV2 {
  id: string
  name: string
  cells: Record<string, CellState>
  createdAt: number
  updatedAt: number
}

interface LibraryV2 {
  version: 2
  folders: Folder[]
  puzzles: Record<string, PuzzleV2>
}

/**
 * One-time upgrade of a version-2 library (no walls) to version 3: every puzzle
 * gains an empty `walls` map, so no saved case is lost. The legacy blob is
 * removed once read; the caller's mount effect persists the result under v3.
 */
function migrateFromV2(): Library | null {
  const raw = localStorage.getItem(LEGACY_V2_KEY)
  if (!raw) return null
  const old = JSON.parse(raw) as LibraryV2
  if (!old || old.version !== 2 || !Array.isArray(old.folders)) return null

  const puzzles: Record<string, Puzzle> = {}
  for (const [id, p] of Object.entries(old.puzzles)) {
    puzzles[id] = { ...p, walls: {} }
  }
  localStorage.removeItem(LEGACY_V2_KEY)
  return { version: 3, folders: old.folders, puzzles }
}

export function saveLibrary(library: Library): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(library))
  } catch {
    // Storage full / unavailable (e.g. private mode). Non-fatal.
  }
}

/**
 * First-run content so the app isn't an empty shell: one folder holding a demo
 * puzzle whose shape is a 4×4 block with a two-cell bulge on the right — enough
 * to show that grids aren't always rectangles. A few walls fence a 2×2 room off
 * the top-left corner so the feature is visible out of the box. Timestamps are
 * fixed so the seed is deterministic.
 */
function seedLibrary(): Library {
  const blank = (): CellState => ({ mark: 'blank', note: '' })
  const cells: Record<string, CellState> = {}
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) cells[cellKey(x, y)] = blank()
  }
  cells[cellKey(4, 1)] = blank()
  cells[cellKey(4, 2)] = blank()

  // Fence the top-left 2×2 block into its own room.
  const walls: Record<string, true> = {
    [wallKey(1, 0, 'v')]: true,
    [wallKey(1, 1, 'v')]: true,
    [wallKey(0, 1, 'h')]: true,
    [wallKey(1, 1, 'h')]: true,
  }

  const puzzleId = newId()
  const folderId = newId()

  return {
    version: 3,
    folders: [{ id: folderId, name: 'My Cases', puzzleIds: [puzzleId] }],
    puzzles: {
      [puzzleId]: {
        id: puzzleId,
        name: 'Sample Shape',
        cells,
        walls,
        createdAt: 0,
        updatedAt: 0,
      },
    },
  }
}
