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
      const lib = coerceLibrary(JSON.parse(raw))
      if (lib) return lib
    }
    // Nothing (valid) at v3 yet — pull a v2 library forward if the user has one.
    const migrated = migrateFromV2()
    if (migrated) return migrated
  } catch {
    // Corrupt or unreadable — fall through to a fresh library.
  }
  return seedLibrary()
}

/** Serialize the whole library for a save file (pretty-printed for humans). */
export function serializeLibrary(library: Library): string {
  return JSON.stringify(library, null, 2)
}

/**
 * Parse the text of a `.murdoku` save file into a Library, upgrading a v2 blob
 * on the way in. Throws if the text isn't a recognizable Murdoku library so the
 * caller can show the user a clear error instead of silently importing garbage.
 */
export function parseLibrary(text: string): Library {
  const lib = coerceLibrary(JSON.parse(text) as unknown)
  if (!lib) throw new Error('This file is not a Murdoku library.')
  return lib
}

/**
 * Validate an already-parsed value and normalize it to the current Library
 * shape, or return null if it isn't one. Accepts the current version (3) and
 * upgrades a version-2 blob (no walls). Validation is shallow — the same trust
 * level the app has always applied to its own localStorage blob.
 */
function coerceLibrary(value: unknown): Library | null {
  if (!value || typeof value !== 'object') return null
  const v = value as { version?: unknown; folders?: unknown }
  if (!Array.isArray(v.folders)) return null
  if (v.version === 3) return value as Library
  if (v.version === 2) return upgradeV2(value as LibraryV2)
  return null
}

/** Add an empty `walls` map to every puzzle, taking a v2 library to v3. */
function upgradeV2(old: LibraryV2): Library {
  const puzzles: Record<string, Puzzle> = {}
  for (const [id, p] of Object.entries(old.puzzles)) {
    puzzles[id] = { ...p, walls: {} }
  }
  return { version: 3, folders: old.folders, puzzles }
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
  localStorage.removeItem(LEGACY_V2_KEY)
  return upgradeV2(old)
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
