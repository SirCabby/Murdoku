import type { CellObjectKind, CellState, ObjectKind } from '../types/puzzle'
import { cellKey, parseCellKey } from './coords'
import type { CandidateEdge } from './walls'
import { parseWallKey, setWall, wallKey } from './walls'

// Pure operations on a puzzle's furnishings. Two concerns, mirroring how cells
// and walls are split:
//   - `objects`: at most one `CellObjectKind` per square, keyed by `"x,y"`.
//   - `windows`: booleans keyed by an *edge* (the walls key format), because a
//     window mounts on a wall, not in a square.
// A window may sit on any wall — an interior edge that carries a wall, or a
// perimeter edge (where the shape simply stops; that boundary counts as a
// wall). Interior edges with no wall are open passages and hold no window.

/** The squares-only kinds, in palette order. Excludes the wall-bound window. */
export const CELL_OBJECT_KINDS: CellObjectKind[] = [
  'chair',
  'carpet',
  'bed',
  'table',
  'tv',
  'plant',
  'shelf',
  'box',
]

export const OBJECT_LABEL: Record<ObjectKind, string> = {
  chair: 'Chair',
  carpet: 'Carpet',
  bed: 'Bed',
  window: 'Window',
  table: 'Table',
  tv: 'TV',
  plant: 'Plant',
  shelf: 'Shelf',
  box: 'Box',
}

/**
 * Furnishings that fill their square so no suspect can stand there. In play mode
 * a cell holding one of these refuses every placement — persona guess, persona
 * answer, and the crossing-out X alike. The other kinds (chair, carpet, bed) are
 * things a suspect can occupy, so they never block.
 */
export const BLOCKING_OBJECT_KINDS = new Set<CellObjectKind>([
  'table',
  'tv',
  'plant',
  'shelf',
  'box',
])

/** Does the object occupying `key` (if any) forbid placing a value there? */
export function isPlacementBlocked(
  objects: Record<string, CellObjectKind>,
  key: string
): boolean {
  const kind = objects[key]
  return kind !== undefined && BLOCKING_OBJECT_KINDS.has(kind)
}

// ---- Merging ----------------------------------------------------------------
// Some furnishings fuse with same-kind neighbours so a run of them reads as one
// piece. Carpet and table use the puzzle-authoring tile art from murdoku.com
// (a 49-piece autotile set). A bed is different: on the source site a bed is a
// two-cell "domino" drawn as one image (`obj_bed` horizontal / `obj_bed_top`
// vertical), never autotiled — so adjacent beds are paired into dominoes and
// each pair (or leftover single) renders as one spanning image (see below).

/** Kinds that autotile with the carpet/table tile sets. */
export const TILE_MERGE_KINDS = new Set<CellObjectKind>(['carpet', 'table'])

export function isTileMergeKind(kind: CellObjectKind): boolean {
  return TILE_MERGE_KINDS.has(kind)
}

/**
 * Blob-autotile lookup, lifted verbatim from murdoku.com's puzzle generator.
 * Maps an 8-neighbour signature to a tile *frame*; the tile file is `frame + 1`
 * (01–49). Bit weights: N=1, NE=2, E=4, SE=8, S=16, SW=32, W=64, NW=128, where a
 * corner bit counts only when both of its adjacent edges are also present. Any
 * signature not listed falls back to 47 (a fully-surrounded interior piece).
 */
const BLOB_FRAME: Record<number, number> = {
  0: 47, 1: 43, 4: 1, 5: 35, 7: 44, 16: 7, 17: 41, 20: 8, 21: 12, 23: 28,
  28: 24, 29: 14, 31: 21, 64: 13, 65: 48, 68: 47, 69: 46, 71: 17, 80: 5,
  81: 34, 84: 36, 85: 16, 87: 9, 92: 2, 93: 37, 95: 31, 112: 20, 113: 23,
  116: 4, 117: 15, 119: 38, 124: 3, 125: 19, 127: 25, 193: 40, 197: 45,
  199: 29, 209: 27, 213: 30, 215: 39, 221: 18, 223: 10, 241: 11, 245: 33,
  247: 26, 253: 22, 255: 32,
}

/** A bed piece to draw: its anchor square and how many cells it spans. */
export interface BedPiece {
  x: number
  y: number
  /** 2×1 = horizontal domino, 1×2 = vertical, 1×1 = leftover single. */
  w: 1 | 2
  h: 1 | 2
}

/**
 * Pairs bed squares into two-cell dominoes for rendering. A deterministic
 * row-major sweep pairs each unclaimed bed with its east neighbour first, else
 * its south neighbour; anything unpaired is a single. Every bed square lands in
 * exactly one piece, so a run of beds reads as whole beds rather than repeated
 * icons.
 */
export function bedDominoes(objects: Record<string, CellObjectKind>): BedPiece[] {
  const isBed = (x: number, y: number): boolean => objects[cellKey(x, y)] === 'bed'
  const claimed = new Set<string>()
  const pieces: BedPiece[] = []
  const beds = Object.keys(objects)
    .filter((k) => objects[k] === 'bed')
    .map(parseCellKey)
    .sort((a, b) => a.y - b.y || a.x - b.x)
  for (const { x, y } of beds) {
    if (claimed.has(cellKey(x, y))) continue
    if (isBed(x + 1, y) && !claimed.has(cellKey(x + 1, y))) {
      claimed.add(cellKey(x, y)).add(cellKey(x + 1, y))
      pieces.push({ x, y, w: 2, h: 1 })
    } else if (isBed(x, y + 1) && !claimed.has(cellKey(x, y + 1))) {
      claimed.add(cellKey(x, y)).add(cellKey(x, y + 1))
      pieces.push({ x, y, w: 1, h: 2 })
    } else {
      claimed.add(cellKey(x, y))
      pieces.push({ x, y, w: 1, h: 1 })
    }
  }
  return pieces
}

/** The complete, all-sides-closed standalone rug — used for a lone carpet. */
const LONE_CARPET_TILE = 1

/**
 * The autotile file number (1–49) for a carpet/table cell given its same-kind
 * neighbours, or `null` when the piece is isolated *and* uses a standalone base
 * icon instead of a tile (tables do). An isolated carpet uses the closed-rug
 * tile; the blob table's own entry for the empty signature is an edge fragment,
 * not a standalone piece, so it is special-cased.
 */
export function tileNumberFor(
  objects: Record<string, CellObjectKind>,
  x: number,
  y: number,
  kind: CellObjectKind
): number | null {
  const same = (cx: number, cy: number): boolean => objects[cellKey(cx, cy)] === kind
  const n = same(x, y - 1)
  const e = same(x + 1, y)
  const s = same(x, y + 1)
  const w = same(x - 1, y)
  const ne = same(x + 1, y - 1) && n && e
  const se = same(x + 1, y + 1) && s && e
  const sw = same(x - 1, y + 1) && s && w
  const nw = same(x - 1, y - 1) && n && w
  const idx =
    (n ? 1 : 0) + (ne ? 2 : 0) + (e ? 4 : 0) + (se ? 8 : 0) +
    (s ? 16 : 0) + (sw ? 32 : 0) + (w ? 64 : 0) + (nw ? 128 : 0)
  if (idx === 0) return kind === 'table' ? null : LONE_CARPET_TILE
  return (BLOB_FRAME[idx] ?? 47) + 1
}

/**
 * Place (`kind`) or clear (`null`) the object in a square. Idempotent — returns
 * the same map when nothing changes. Callers guard that the cell exists.
 */
export function setObject(
  objects: Record<string, CellObjectKind>,
  key: string,
  kind: CellObjectKind | null
): Record<string, CellObjectKind> {
  if (kind === null) {
    if (!(key in objects)) return objects
    const next = { ...objects }
    delete next[key]
    return next
  }
  if (objects[key] === kind) return objects
  return { ...objects, [key]: kind }
}

/** Drops any object whose square no longer exists. Same map if unchanged. */
export function pruneObjects(
  objects: Record<string, CellObjectKind>,
  cells: Record<string, CellState>
): Record<string, CellObjectKind> {
  const next: Record<string, CellObjectKind> = {}
  let changed = false
  for (const [key, kind] of Object.entries(objects)) {
    if (key in cells) next[key] = kind
    else changed = true
  }
  return changed ? next : objects
}

/**
 * Add or remove a window on an edge. A window is pure edge-membership, exactly
 * like a wall, so the wall setter does the work.
 */
export const setWindow = setWall

/**
 * Is `key` a legal window mount given the current shape and walls? True for a
 * perimeter edge (exactly one adjacent cell exists) or an interior edge that
 * carries a wall; false for an open interior edge or a fully-detached edge.
 */
export function isWindowEdge(
  key: string,
  cells: Record<string, CellState>,
  walls: Record<string, true>
): boolean {
  const { x, y, orient } = parseWallKey(key)
  const aExists = cellKey(x, y) in cells
  const bExists =
    (orient === 'v' ? cellKey(x + 1, y) : cellKey(x, y + 1)) in cells
  if (aExists && bExists) return key in walls
  return aExists || bExists
}

/**
 * Every edge a window may be dropped on: each perimeter edge of the shape plus
 * every interior edge carrying a wall. Interior edges are emitted once (from
 * their top-left cell); perimeter edges touch a single cell, so also once.
 */
export function windowEdges(
  cells: Record<string, CellState>,
  walls: Record<string, true>
): CandidateEdge[] {
  const edges: CandidateEdge[] = []
  for (const key of Object.keys(cells)) {
    const { x, y } = parseCellKey(key)
    // Right / down: interior when the neighbour exists (walled only), else a
    // perimeter edge keyed from this cell.
    if (cellKey(x + 1, y) in cells) {
      const k = wallKey(x, y, 'v')
      if (k in walls) edges.push({ x, y, orient: 'v', key: k })
    } else {
      edges.push({ x, y, orient: 'v', key: wallKey(x, y, 'v') })
    }
    if (cellKey(x, y + 1) in cells) {
      const k = wallKey(x, y, 'h')
      if (k in walls) edges.push({ x, y, orient: 'h', key: k })
    } else {
      edges.push({ x, y, orient: 'h', key: wallKey(x, y, 'h') })
    }
    // Left / up: only the perimeter case (the interior edge, if any, is emitted
    // by the neighbour above).
    if (!(cellKey(x - 1, y) in cells)) {
      edges.push({ x: x - 1, y, orient: 'v', key: wallKey(x - 1, y, 'v') })
    }
    if (!(cellKey(x, y - 1) in cells)) {
      edges.push({ x, y: y - 1, orient: 'h', key: wallKey(x, y - 1, 'h') })
    }
  }
  return edges
}

/** Drops any window whose edge is no longer a legal mount. Same map if unchanged. */
export function pruneWindows(
  windows: Record<string, true>,
  cells: Record<string, CellState>,
  walls: Record<string, true>
): Record<string, true> {
  const next: Record<string, true> = {}
  let changed = false
  for (const key of Object.keys(windows)) {
    if (isWindowEdge(key, cells, walls)) next[key] = true
    else changed = true
  }
  return changed ? next : windows
}
