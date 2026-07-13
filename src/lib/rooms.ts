import type { CellState, RoomLabel } from '../types/puzzle'
import { cellKey, parseCellKey } from './coords'
import { wallKey } from './walls'

// Rooms are the regions the walls carve the shape into: two orthogonally
// adjacent cells share a room exactly when no wall sits on the edge between
// them. That's the same adjacency `lib/walls.ts` defines, run as a flood fill.
// Pure and side-effect-free (React stays out), so it's independently testable —
// this is what lets the editor drop a name label along a room's bottom.

/**
 * Every cell in the same room as `startKey`: the flood-fill closure over
 * orthogonal neighbours that exist and aren't fenced off by a wall. `startKey`
 * is assumed to be an existing cell, so the result always includes it.
 */
export function roomOf(
  cells: Record<string, CellState>,
  walls: Record<string, true>,
  startKey: string
): string[] {
  const seen = new Set<string>([startKey])
  const stack: string[] = [startKey]
  while (stack.length > 0) {
    const key = stack.pop() as string
    const { x, y } = parseCellKey(key)
    // Each neighbour is reachable when its cell exists and the shared edge
    // carries no wall. Wall keys are anchored to the pair's top-left cell.
    const steps: ReadonlyArray<{ nx: number; ny: number; wall: string }> = [
      { nx: x + 1, ny: y, wall: wallKey(x, y, 'v') },
      { nx: x - 1, ny: y, wall: wallKey(x - 1, y, 'v') },
      { nx: x, ny: y + 1, wall: wallKey(x, y, 'h') },
      { nx: x, ny: y - 1, wall: wallKey(x, y - 1, 'h') },
    ]
    for (const { nx, ny, wall } of steps) {
      const nk = cellKey(nx, ny)
      if (seen.has(nk) || !(nk in cells) || wall in walls) continue
      seen.add(nk)
      stack.push(nk)
    }
  }
  return [...seen]
}

/** A lattice point (cell units from the origin) where a label's centre renders. */
export interface RoomAnchor {
  x: number
  y: number
}

/**
 * The default resting point for a room's name label: horizontally centred on
 * the room's bottom-most row of cells and vertically **on that row's bottom
 * wall** (the gridline just below it). Since a label renders centred on this
 * point, the pill straddles the wall — overlapping it partway while the wall
 * line stays visible to either side. `roomKeys` must be non-empty (pass a
 * `roomOf` result). The user can drag the label off this point afterwards.
 */
export function roomBottomCenter(roomKeys: string[]): RoomAnchor {
  let maxY = -Infinity
  for (const key of roomKeys) {
    const { y } = parseCellKey(key)
    if (y > maxY) maxY = y
  }
  let minX = Infinity
  let maxX = -Infinity
  for (const key of roomKeys) {
    const { x, y } = parseCellKey(key)
    if (y !== maxY) continue
    if (x < minX) minX = x
    if (x > maxX) maxX = x
  }
  return { x: (minX + maxX + 1) / 2, y: maxY + 1 }
}

/** The existing cell whose centre is nearest `point`, or null if there are none. */
function nearestCell(cells: Record<string, CellState>, point: RoomAnchor): string | null {
  let best: string | null = null
  let bestDist = Infinity
  for (const key of Object.keys(cells)) {
    const { x, y } = parseCellKey(key)
    const dx = x + 0.5 - point.x
    const dy = y + 0.5 - point.y
    const d = dx * dx + dy * dy
    if (d < bestDist) {
      bestDist = d
      best = key
    }
  }
  return best
}

/**
 * Reposition a label onto its room's bottom wall — used by the one-time upgrade
 * that pulled older, mid-cell labels down onto the wall. The label's room is the
 * one whose bottom cell sits just above it, so we probe a hair *above* the
 * label's point (a label already straddling a wall then still resolves to the
 * room above, not the one below) and re-anchor to that room's bottom-wall
 * centre. Labels with no cells to attach to are returned unchanged.
 */
export function snapLabelToRoomBottom(
  cells: Record<string, CellState>,
  walls: Record<string, true>,
  label: RoomLabel
): RoomLabel {
  const start = nearestCell(cells, { x: label.x, y: label.y - 0.25 })
  if (!start) return label
  const { x, y } = roomBottomCenter(roomOf(cells, walls, start))
  return { ...label, x, y }
}
