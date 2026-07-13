import type { CellObjectKind, CellState, Folder, Library, Puzzle } from '../types/puzzle'
import { cellKey } from './coords'
import { wallKey } from './walls'
import { newId } from './id'

// Persistence for the whole library. For now this is localStorage, which keeps
// Murdoku fully functional standalone. When launched from GameStateTracker we
// will additionally sync this blob to the connected save file (see lib/gst.ts);
// that hook is intentionally not wired up yet.

const STORAGE_KEY = 'murdoku.library.v4'
// Older blobs still sitting in some users' storage, newest first. Each is
// upgraded forward by `coerceLibrary` and then removed once read.
const LEGACY_KEYS = ['murdoku.library.v3', 'murdoku.library.v2']

export function emptyLibrary(): Library {
  return { version: 4, folders: [], puzzles: {} }
}

export function loadLibrary(): Library {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const lib = coerceLibrary(JSON.parse(raw))
      if (lib) return lib
    }
    // Nothing (valid) at v4 yet — pull an older library forward if present.
    for (const key of LEGACY_KEYS) {
      const legacyRaw = localStorage.getItem(key)
      if (!legacyRaw) continue
      const lib = coerceLibrary(JSON.parse(legacyRaw))
      if (lib) {
        localStorage.removeItem(key)
        return lib
      }
    }
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
 * Parse the text of a `.murdoku` save file into a Library, upgrading an older
 * blob on the way in. Throws if the text isn't a recognizable Murdoku library
 * so the caller can show the user a clear error instead of importing garbage.
 */
export function parseLibrary(text: string): Library {
  const lib = coerceLibrary(JSON.parse(text) as unknown)
  if (!lib) throw new Error('This file is not a Murdoku library.')
  return lib
}

/**
 * Validate an already-parsed value and normalize it to the current Library
 * shape, or return null if it isn't one. Accepts the current version (4) and
 * upgrades a version-2 blob (no walls) or version-3 blob (no objects) forward.
 * Validation is shallow — the same trust level the app has always applied to
 * its own localStorage blob.
 */
function coerceLibrary(value: unknown): Library | null {
  if (!value || typeof value !== 'object') return null
  const v = value as { version?: unknown; folders?: unknown }
  if (!Array.isArray(v.folders)) return null
  if (v.version === 4) return value as Library
  if (v.version === 3) return upgradeV3(value as LibraryV3)
  if (v.version === 2) return upgradeV3(upgradeV2(value as LibraryV2))
  return null
}

/** Add an empty `walls` map to every puzzle, taking a v2 library to v3. */
function upgradeV2(old: LibraryV2): LibraryV3 {
  const puzzles: Record<string, PuzzleV3> = {}
  for (const [id, p] of Object.entries(old.puzzles)) {
    puzzles[id] = { ...p, walls: {} }
  }
  return { version: 3, folders: old.folders, puzzles }
}

/** Add empty `objects` / `windows` maps to every puzzle, taking v3 to v4. */
function upgradeV3(old: LibraryV3): Library {
  const puzzles: Record<string, Puzzle> = {}
  for (const [id, p] of Object.entries(old.puzzles)) {
    puzzles[id] = { ...p, objects: {}, windows: {} }
  }
  return { version: 4, folders: old.folders, puzzles }
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

/** A pre-objects (version 3) puzzle — has walls but no furnishings. */
interface PuzzleV3 extends PuzzleV2 {
  walls: Record<string, true>
}

interface LibraryV3 {
  version: 3
  folders: Folder[]
  puzzles: Record<string, PuzzleV3>
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
 * the top-left corner, and a couple of objects plus a perimeter window show the
 * furnishing features out of the box. Timestamps are fixed so the seed is
 * deterministic.
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

  // A two-cell bed in the fenced-off room, a 2×2 carpet and a two-wide table
  // that show off merging, and a plant out in the bulge.
  const objects: Record<string, CellObjectKind> = {
    [cellKey(0, 0)]: 'bed',
    [cellKey(1, 0)]: 'bed',
    [cellKey(2, 2)]: 'carpet',
    [cellKey(3, 2)]: 'carpet',
    [cellKey(2, 3)]: 'carpet',
    [cellKey(3, 3)]: 'carpet',
    [cellKey(0, 3)]: 'table',
    [cellKey(1, 3)]: 'table',
    [cellKey(4, 2)]: 'plant',
  }

  // A window on the top perimeter of the fenced room.
  const windows: Record<string, true> = {
    [wallKey(0, -1, 'h')]: true,
  }

  const puzzleId = newId()
  const folderId = newId()

  return {
    version: 4,
    folders: [{ id: folderId, name: 'My Cases', puzzleIds: [puzzleId] }],
    puzzles: {
      [puzzleId]: {
        id: puzzleId,
        name: 'Sample Shape',
        cells,
        walls,
        objects,
        windows,
        createdAt: 0,
        updatedAt: 0,
      },
    },
  }
}
