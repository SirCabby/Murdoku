import type { CellState } from '../types/puzzle'
import type { Point } from './coords'
import { cellKey, parseCellKey } from './coords'

// Pure operations on a puzzle's `walls` map. A wall lives on the *edge* between
// two lattice-adjacent cells and fences off rooms. Every edge has exactly one
// canonical key, referenced from the top-left cell of the pair:
//   - `"x,y,v"`  vertical wall between (x,y) [left]  and (x+1,y) [right]
//   - `"x,y,h"`  horizontal wall between (x,y) [top] and (x,y+1) [bottom]
// Always build keys through `wallKey` / `edgeBetween` — never hand-assemble the
// string — so the canonical form is defined exactly once (mirrors `cellKey`).

export type WallOrient = 'v' | 'h'

export interface WallEdge {
  x: number
  y: number
  orient: WallOrient
}

/** An interior edge plus its canonical key, ready to render/toggle. */
export interface CandidateEdge extends WallEdge {
  key: string
}

/** One of a cell's four sides. */
export type WallSide = 'top' | 'right' | 'bottom' | 'left'

/** Booleans for which of a cell's four sides carry a wall. */
export interface WallSides {
  top: boolean
  right: boolean
  bottom: boolean
  left: boolean
}

/** A permanent boundary wall: the `side` of an existing cell that faces outside the shape. */
export interface PerimeterEdge {
  x: number
  y: number
  side: WallSide
}

export function wallKey(x: number, y: number, orient: WallOrient): string {
  return `${x},${y},${orient}`
}

export function parseWallKey(key: string): WallEdge {
  const parts = key.split(',')
  return {
    x: Number(parts[0]),
    y: Number(parts[1]),
    orient: parts[2] === 'v' ? 'v' : 'h',
  }
}

/**
 * Canonical wall edge between two cells, or null if they aren't orthogonally
 * adjacent. Order-independent: `edgeBetween(a, b)` === `edgeBetween(b, a)`.
 */
export function edgeBetween(a: Point, b: Point): WallEdge | null {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (dy === 0 && Math.abs(dx) === 1) {
    return { x: Math.min(a.x, b.x), y: a.y, orient: 'v' }
  }
  if (dx === 0 && Math.abs(dy) === 1) {
    return { x: a.x, y: Math.min(a.y, b.y), orient: 'h' }
  }
  return null
}

/** Add or remove a wall on an edge. Idempotent; returns the same map if unchanged. */
export function setWall(
  walls: Record<string, true>,
  key: string,
  on: boolean
): Record<string, true> {
  const has = key in walls
  if (on === has) return walls
  const next = { ...walls }
  if (on) next[key] = true
  else delete next[key]
  return next
}

/** Which of cell (x,y)'s four sides carry a wall. */
export function wallSides(walls: Record<string, true>, x: number, y: number): WallSides {
  return {
    right: wallKey(x, y, 'v') in walls,
    left: wallKey(x - 1, y, 'v') in walls,
    bottom: wallKey(x, y, 'h') in walls,
    top: wallKey(x, y - 1, 'h') in walls,
  }
}

/**
 * Every interior edge of the shape — the edges where both cells exist and a
 * wall may therefore be placed. Each edge is emitted once, keyed from its
 * top-left cell (right/down neighbours only).
 */
export function interiorEdges(cells: Record<string, CellState>): CandidateEdge[] {
  const edges: CandidateEdge[] = []
  for (const key of Object.keys(cells)) {
    const { x, y } = parseCellKey(key)
    if (cellKey(x + 1, y) in cells) {
      edges.push({ x, y, orient: 'v', key: wallKey(x, y, 'v') })
    }
    if (cellKey(x, y + 1) in cells) {
      edges.push({ x, y, orient: 'h', key: wallKey(x, y, 'h') })
    }
  }
  return edges
}

/**
 * The room's outer boundary: every cell side that faces outside the shape (the
 * neighbour across it doesn't exist). These walls are implied by the shape, so
 * they're always present and can't be toggled — user-editable walls live only on
 * interior edges (see `interiorEdges`). Anchored to the existing cell + side so
 * the render never has to place anything outside the shape's grid tracks.
 */
export function perimeterEdges(cells: Record<string, CellState>): PerimeterEdge[] {
  const edges: PerimeterEdge[] = []
  for (const key of Object.keys(cells)) {
    const { x, y } = parseCellKey(key)
    if (!(cellKey(x, y - 1) in cells)) edges.push({ x, y, side: 'top' })
    if (!(cellKey(x + 1, y) in cells)) edges.push({ x, y, side: 'right' })
    if (!(cellKey(x, y + 1) in cells)) edges.push({ x, y, side: 'bottom' })
    if (!(cellKey(x - 1, y) in cells)) edges.push({ x, y, side: 'left' })
  }
  return edges
}

/**
 * Drops any wall whose edge is no longer interior — i.e. either of its two
 * cells has been removed from the shape. Returns the same map if nothing changed.
 */
export function pruneWalls(
  walls: Record<string, true>,
  cells: Record<string, CellState>
): Record<string, true> {
  const next: Record<string, true> = {}
  let changed = false
  for (const key of Object.keys(walls)) {
    const { x, y, orient } = parseWallKey(key)
    const bExists =
      orient === 'v' ? cellKey(x + 1, y) in cells : cellKey(x, y + 1) in cells
    if (cellKey(x, y) in cells && bExists) next[key] = true
    else changed = true
  }
  return changed ? next : walls
}
