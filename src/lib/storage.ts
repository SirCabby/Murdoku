import type { CellObjectKind, CellState, Folder, Hint, Library, Persona, Puzzle, RoomLabel } from '../types/puzzle'
import { cellKey } from './coords'
import { wallKey } from './walls'
import { snapLabelToRoomBottom } from './rooms'
import { defaultPersonas } from './personas'
import { newId } from './id'

// Persistence for the whole library. For now this is localStorage, which keeps
// Murdoku fully functional standalone. When launched from GameStateTracker we
// will additionally sync this blob to the connected save file (see lib/gst.ts);
// that hook is intentionally not wired up yet.

const STORAGE_KEY = 'murdoku.library.v14'
// Older blobs still sitting in some users' storage, newest first. Each is
// upgraded forward by `coerceLibrary` and then removed once read.
const LEGACY_KEYS = [
  'murdoku.library.v13',
  'murdoku.library.v12',
  'murdoku.library.v11',
  'murdoku.library.v10',
  'murdoku.library.v9',
  'murdoku.library.v8',
  'murdoku.library.v7',
  'murdoku.library.v6',
  'murdoku.library.v5',
  'murdoku.library.v4',
  'murdoku.library.v3',
  'murdoku.library.v2',
]

export function emptyLibrary(): Library {
  return { version: 14, folders: [], puzzles: {} }
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
 * shape, or return null if it isn't one. Accepts the current version (14) and
 * upgrades older blobs forward one step at a time: v2 (no walls) → v3 (no
 * objects) → v4 (no room labels) → v5 (labels mid-cell) → v6 (labels snapped to
 * bottom walls) → v7 (no personas) → v8 (no persona guesses) → v9 (no persona
 * answers) → v10 (no crossed-out cells) → v11 (no murderer accusation) → v12 (no
 * answer key) → v13 (no hints) → v14 (no answer-key murderer). Validation is
 * shallow — the same trust level the app has always applied to its own
 * localStorage blob.
 */
function coerceLibrary(value: unknown): Library | null {
  if (!value || typeof value !== 'object') return null
  const v = value as { version?: unknown; folders?: unknown }
  if (!Array.isArray(v.folders)) return null
  if (v.version === 14) return value as Library
  if (v.version === 13) return upgradeV13(value as LibraryV13)
  if (v.version === 12) return upgradeV13(upgradeV12(value as LibraryV12))
  if (v.version === 11) return upgradeV13(upgradeV12(upgradeV11(value as LibraryV11)))
  if (v.version === 10) return upgradeV13(upgradeV12(upgradeV11(upgradeV10(value as LibraryV10))))
  if (v.version === 9) return upgradeV13(upgradeV12(upgradeV11(upgradeV10(upgradeV9(value as LibraryV9)))))
  if (v.version === 8) return upgradeV13(upgradeV12(upgradeV11(upgradeV10(upgradeV9(upgradeV8(value as LibraryV8))))))
  if (v.version === 7) return upgradeV13(upgradeV12(upgradeV11(upgradeV10(upgradeV9(upgradeV8(upgradeV7(value as LibraryV7)))))))
  if (v.version === 6) return upgradeV13(upgradeV12(upgradeV11(upgradeV10(upgradeV9(upgradeV8(upgradeV7(upgradeV6(value as LibraryV6))))))))
  if (v.version === 5) return upgradeV13(upgradeV12(upgradeV11(upgradeV10(upgradeV9(upgradeV8(upgradeV7(upgradeV6(upgradeV5(value as LibraryV5)))))))))
  if (v.version === 4) return upgradeV13(upgradeV12(upgradeV11(upgradeV10(upgradeV9(upgradeV8(upgradeV7(upgradeV6(upgradeV5(upgradeV4(value as LibraryV4))))))))))
  if (v.version === 3) return upgradeV13(upgradeV12(upgradeV11(upgradeV10(upgradeV9(upgradeV8(upgradeV7(upgradeV6(upgradeV5(upgradeV4(upgradeV3(value as LibraryV3)))))))))))
  if (v.version === 2) return upgradeV13(upgradeV12(upgradeV11(upgradeV10(upgradeV9(upgradeV8(upgradeV7(upgradeV6(upgradeV5(upgradeV4(upgradeV3(upgradeV2(value as LibraryV2))))))))))))
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
function upgradeV7(old: LibraryV7): LibraryV8 {
  const puzzles: Record<string, PuzzleV8> = {}
  for (const [id, p] of Object.entries(old.puzzles)) {
    puzzles[id] = { ...p, guesses: {} }
  }
  return { version: 8, folders: old.folders, puzzles }
}

/**
 * Add an empty `answers` map to every puzzle, taking v8 to v9. Definitive
 * answers are play state the author never sets, so every migrated puzzle simply
 * starts with none.
 */
function upgradeV8(old: LibraryV8): LibraryV9 {
  const puzzles: Record<string, PuzzleV9> = {}
  for (const [id, p] of Object.entries(old.puzzles)) {
    puzzles[id] = { ...p, answers: {} }
  }
  return { version: 9, folders: old.folders, puzzles }
}

/**
 * Add an empty `crosses` map to every puzzle, taking v9 to v10. Crossed-out cells
 * are play state the author never sets, so every migrated puzzle simply starts
 * with none.
 */
function upgradeV9(old: LibraryV9): LibraryV10 {
  const puzzles: Record<string, PuzzleV10> = {}
  for (const [id, p] of Object.entries(old.puzzles)) {
    puzzles[id] = { ...p, crosses: {} }
  }
  return { version: 10, folders: old.folders, puzzles }
}

/**
 * Add a null `murderer` accusation to every puzzle, taking v10 to v11. The final
 * accusation is play state the author never sets, so every migrated puzzle starts
 * undecided.
 */
function upgradeV10(old: LibraryV10): LibraryV11 {
  const puzzles: Record<string, PuzzleV11> = {}
  for (const [id, p] of Object.entries(old.puzzles)) {
    puzzles[id] = { ...p, murderer: null }
  }
  return { version: 11, folders: old.folders, puzzles }
}

/**
 * Add an empty `solution` answer key to every puzzle, taking v11 to v12. The key
 * is authoring content that predates this version, so every migrated puzzle starts
 * with none — the author fills it in from the editor's Answer key tab.
 */
function upgradeV11(old: LibraryV11): LibraryV12 {
  const puzzles: Record<string, PuzzleV12> = {}
  for (const [id, p] of Object.entries(old.puzzles)) {
    puzzles[id] = { ...p, solution: {} }
  }
  return { version: 12, folders: old.folders, puzzles }
}

/**
 * Add an empty `hints` list to every puzzle, taking v12 to v13. Hints are
 * authoring content that predates this version, so every migrated puzzle starts
 * with none — the author writes them in the editor's Hints tab.
 */
function upgradeV12(old: LibraryV12): LibraryV13 {
  const puzzles: Record<string, PuzzleV13> = {}
  for (const [id, p] of Object.entries(old.puzzles)) {
    puzzles[id] = { ...p, hints: [] }
  }
  return { version: 13, folders: old.folders, puzzles }
}

/**
 * Add a null `solutionMurderer` to every puzzle, taking v13 to v14. The answer
 * key's murderer is authoring content that predates this version, so every
 * migrated puzzle starts undecided — the author names it in the editor's Answer
 * key tab.
 */
function upgradeV13(old: LibraryV13): Library {
  const puzzles: Record<string, Puzzle> = {}
  for (const [id, p] of Object.entries(old.puzzles)) {
    puzzles[id] = { ...p, solutionMurderer: null }
  }
  return { version: 14, folders: old.folders, puzzles }
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

/** A version-8 puzzle — has placement guesses but no definitive answers yet. */
interface PuzzleV8 extends PuzzleV7 {
  guesses: Record<string, string[]>
}

interface LibraryV8 {
  version: 8
  folders: Folder[]
  puzzles: Record<string, PuzzleV8>
}

/** A version-9 puzzle — has definitive answers but no crossed-out cells yet. */
interface PuzzleV9 extends PuzzleV8 {
  answers: Record<string, string>
}

interface LibraryV9 {
  version: 9
  folders: Folder[]
  puzzles: Record<string, PuzzleV9>
}

/** A version-10 puzzle — has crossed-out cells but no murderer accusation yet. */
interface PuzzleV10 extends PuzzleV9 {
  crosses: Record<string, true>
}

interface LibraryV10 {
  version: 10
  folders: Folder[]
  puzzles: Record<string, PuzzleV10>
}

/** A version-11 puzzle — has a murderer accusation but no answer key yet. */
interface PuzzleV11 extends PuzzleV10 {
  murderer: string | null
}

interface LibraryV11 {
  version: 11
  folders: Folder[]
  puzzles: Record<string, PuzzleV11>
}

/** A version-12 puzzle — has an answer key but no authored hints yet. */
interface PuzzleV12 extends PuzzleV11 {
  solution: Record<string, string>
}

interface LibraryV12 {
  version: 12
  folders: Folder[]
  puzzles: Record<string, PuzzleV12>
}

/** A version-13 puzzle — has authored hints but no answer-key murderer yet. */
interface PuzzleV13 extends PuzzleV12 {
  hints: Hint[]
}

interface LibraryV13 {
  version: 13
  folders: Folder[]
  puzzles: Record<string, PuzzleV13>
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
  const blank = (): CellState => ({ mark: 'blank' })
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

  // One committed answer, showing the big-letter placement next to the small
  // guesses. A guess and an answer never share a cell, so this sits on its own.
  const answers: Record<string, string> = {
    [cellKey(0, 2)]: mustard.id,
  }

  // One crossed-out cell, ruling a room out entirely — a big grey X. Like an
  // answer it's alone in its cell (no guess or answer shares it).
  const crosses: Record<string, true> = {
    [cellKey(1, 2)]: true,
  }

  // The final accusation, showing the murderer picker with a suspect chosen:
  // Colonel Mustard (the one already committed as an answer above).
  const murderer = mustard.id

  // The author's answer key: each of the three cast members in a distinct room,
  // no two sharing a row or column, on placeable (non-blocking) cells. Every other
  // placeable cell is X'd automatically in the Answer key tab.
  const solution: Record<string, string> = {
    [cellKey(3, 0)]: scarlet.id,
    [cellKey(0, 1)]: mustard.id,
    [cellKey(2, 2)]: boddy.id,
  }

  // The answer key's murderer: the definitive culprit the play accusation is
  // checked against — Colonel Mustard, shown selected in the Answer key tab.
  const solutionMurderer = mustard.id

  // A couple of authored hints, numbered 1 and 2 by order, showing the Hints tab.
  const hints: Hint[] = [
    { id: newId(), text: 'The victim was found in the parlor.' },
    { id: newId(), text: 'Colonel Mustard was never in the bedroom.' },
  ]

  const puzzleId = newId()
  const folderId = newId()

  return {
    version: 14,
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
        hints,
        personas,
        guesses,
        answers,
        crosses,
        murderer,
        solution,
        solutionMurderer,
        createdAt: 0,
        updatedAt: 0,
      },
    },
  }
}
