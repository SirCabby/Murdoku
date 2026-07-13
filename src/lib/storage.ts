import type { CellObjectKind, CellState, Folder, Library, Persona, Puzzle, RoomLabel } from '../types/puzzle'
import { cellKey } from './coords'
import { wallKey } from './walls'
import { snapLabelToRoomBottom } from './rooms'
import { defaultPersonas } from './personas'
import { newId } from './id'

// Persistence for the whole library. For now this is localStorage, which keeps
// Murdoku fully functional standalone. When launched from GameStateTracker we
// will additionally sync this blob to the connected save file (see lib/gst.ts);
// that hook is intentionally not wired up yet.

const STORAGE_KEY = 'murdoku.library.v8'
// Older blobs still sitting in some users' storage, newest first. Each is
// upgraded forward by `coerceLibrary` and then removed once read.
const LEGACY_KEYS = [
  'murdoku.library.v7',
  'murdoku.library.v6',
  'murdoku.library.v5',
  'murdoku.library.v4',
  'murdoku.library.v3',
  'murdoku.library.v2',
]

export function emptyLibrary(): Library {
  return { version: 8, folders: [], puzzles: {} }
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
 * shape, or return null if it isn't one. Accepts the current version (8) and
 * upgrades older blobs forward one step at a time: v2 (no walls) → v3 (no
 * objects) → v4 (no room labels) → v5 (labels mid-cell) → v6 (labels snapped to
 * bottom walls) → v7 (no personas) → v8 (no persona guesses). Validation is
 * shallow — the same trust level the app has always applied to its own
 * localStorage blob.
 */
function coerceLibrary(value: unknown): Library | null {
  if (!value || typeof value !== 'object') return null
  const v = value as { version?: unknown; folders?: unknown }
  if (!Array.isArray(v.folders)) return null
  if (v.version === 8) return value as Library
  if (v.version === 7) return upgradeV7(value as LibraryV7)
  if (v.version === 6) return upgradeV7(upgradeV6(value as LibraryV6))
  if (v.version === 5) return upgradeV7(upgradeV6(upgradeV5(value as LibraryV5)))
  if (v.version === 4) return upgradeV7(upgradeV6(upgradeV5(upgradeV4(value as LibraryV4))))
  if (v.version === 3) return upgradeV7(upgradeV6(upgradeV5(upgradeV4(upgradeV3(value as LibraryV3)))))
  if (v.version === 2) return upgradeV7(upgradeV6(upgradeV5(upgradeV4(upgradeV3(upgradeV2(value as LibraryV2))))))
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
function upgradeV3(old: LibraryV3): LibraryV4 {
  const puzzles: Record<string, PuzzleV4> = {}
  for (const [id, p] of Object.entries(old.puzzles)) {
    puzzles[id] = { ...p, objects: {}, windows: {} }
  }
  return { version: 4, folders: old.folders, puzzles }
}

/** Add an empty `labels` list to every puzzle, taking v4 to v5. */
function upgradeV4(old: LibraryV4): LibraryV5 {
  const puzzles: Record<string, PuzzleV5> = {}
  for (const [id, p] of Object.entries(old.puzzles)) {
    puzzles[id] = { ...p, labels: [] }
  }
  return { version: 5, folders: old.folders, puzzles }
}

/**
 * Reposition every room label onto its room's bottom wall, taking v5 to v6.
 * Version 5 dropped labels in the middle of a room's bottom cell; this snaps
 * them down onto the bottom wall (once, on load) so they line up with new
 * labels. `snapLabelToRoomBottom` resolves each label back to its room.
 */
function upgradeV5(old: LibraryV5): LibraryV6 {
  const puzzles: Record<string, PuzzleV6> = {}
  for (const [id, p] of Object.entries(old.puzzles)) {
    puzzles[id] = {
      ...p,
      labels: p.labels.map((l) => snapLabelToRoomBottom(p.cells, p.walls, l)),
    }
  }
  return { version: 6, folders: old.folders, puzzles }
}

/**
 * Seed a starting cast on every puzzle, taking v6 to v7: one suspect and the
 * victim (see `defaultPersonas`). Existing puzzles predate personas, so they all
 * begin with the same blank cast the author can then flesh out.
 */
function upgradeV6(old: LibraryV6): LibraryV7 {
  const puzzles: Record<string, PuzzleV7> = {}
  for (const [id, p] of Object.entries(old.puzzles)) {
    puzzles[id] = { ...p, personas: defaultPersonas() }
  }
  return { version: 7, folders: old.folders, puzzles }
}

/**
 * Add an empty `guesses` map to every puzzle, taking v7 to v8. Placement guesses
 * are play state the author never sets, so every migrated puzzle simply starts
 * with none.
 */
function upgradeV7(old: LibraryV7): Library {
  const puzzles: Record<string, Puzzle> = {}
  for (const [id, p] of Object.entries(old.puzzles)) {
    puzzles[id] = { ...p, guesses: {} }
  }
  return { version: 8, folders: old.folders, puzzles }
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

/** A pre-labels (version 4) puzzle — has furnishings but no room labels. */
interface PuzzleV4 extends PuzzleV3 {
  objects: Record<string, CellObjectKind>
  windows: Record<string, true>
}

interface LibraryV4 {
  version: 4
  folders: Folder[]
  puzzles: Record<string, PuzzleV4>
}

/** A version-5 puzzle — has room labels, but positioned before the bottom-wall snap. */
interface PuzzleV5 extends PuzzleV4 {
  labels: RoomLabel[]
}

interface LibraryV5 {
  version: 5
  folders: Folder[]
  puzzles: Record<string, PuzzleV5>
}

/**
 * A version-6 puzzle — labels snapped to bottom walls, but no personas yet.
 * Structurally identical to v5's puzzle shape (v5→v6 only repositioned labels).
 */
type PuzzleV6 = PuzzleV5

interface LibraryV6 {
  version: 6
  folders: Folder[]
  puzzles: Record<string, PuzzleV6>
}

/** A version-7 puzzle — has a persona cast but no placement guesses yet. */
interface PuzzleV7 extends PuzzleV6 {
  personas: Persona[]
}

interface LibraryV7 {
  version: 7
  folders: Folder[]
  puzzles: Record<string, PuzzleV7>
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
 * furnishing features out of the box, and each of the two rooms carries a name
 * label. A small cast — two suspects and the victim — shows the personas feature.
 * Timestamps are fixed so the seed is deterministic.
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

  // A name for each room, straddling its bottom wall: the fenced 2×2 (bottom row
  // y=1, so its bottom wall is the gridline y=2) and the larger surrounding room
  // (bottom row y=3, bottom wall at the perimeter gridline y=4).
  const labels: RoomLabel[] = [
    { id: newId(), text: 'Bedroom', x: 1, y: 2 },
    { id: newId(), text: 'Parlor', x: 2, y: 4 },
  ]

  // Two suspects (lettered A, B by order) and the victim (V).
  const scarlet: Persona = {
    id: newId(),
    role: 'suspect',
    name: 'Miss Scarlet',
    description: 'A retired stage actress with a flair for the dramatic.',
  }
  const mustard: Persona = {
    id: newId(),
    role: 'suspect',
    name: 'Colonel Mustard',
    description: 'A decorated officer, quick to anger.',
  }
  const boddy: Persona = {
    id: newId(),
    role: 'victim',
    name: 'Mr. Boddy',
    description: 'The host of the evening, found in the parlor.',
  }
  const personas: Persona[] = [scarlet, mustard, boddy]

  // A few placement guesses so the play view isn't blank: suspect A in one cell,
  // both suspects sharing another (showing the multi-guess grid), and the victim
  // out in the bulge.
  const guesses: Record<string, string[]> = {
    [cellKey(2, 0)]: [scarlet.id],
    [cellKey(3, 0)]: [scarlet.id, mustard.id],
    [cellKey(4, 1)]: [boddy.id],
  }

  const puzzleId = newId()
  const folderId = newId()

  return {
    version: 8,
    folders: [{ id: folderId, name: 'My Cases', puzzleIds: [puzzleId] }],
    puzzles: {
      [puzzleId]: {
        id: puzzleId,
        name: 'Sample Shape',
        cells,
        walls,
        objects,
        windows,
        labels,
        personas,
        guesses,
        createdAt: 0,
        updatedAt: 0,
      },
    },
  }
}
