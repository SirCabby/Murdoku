import type { CellState, Mark } from '../types/puzzle'
import { cellKey } from './coords'

// Pure operations on a puzzle's `cells` map. Each returns a new map — callers
// replace `puzzle.cells` with the result. Two concerns live here:
//   - shape editing: which cells exist (setCellExists / setRectangle / clear)
//   - play:          the mark/note on an existing cell (setMark / setNote)

const BLANK: CellState = { mark: 'blank', note: '' }

/** Cycle order when a cell is clicked in play: undecided → ruled out → chosen. */
export function nextMark(mark: Mark): Mark {
  switch (mark) {
    case 'blank':
      return 'no'
    case 'no':
      return 'yes'
    case 'yes':
      return 'blank'
  }
}

export const MARK_GLYPH: Record<Mark, string> = {
  blank: '',
  no: '✗',
  yes: '✓',
}

/** Add or remove a cell from the shape. New cells start blank. Idempotent. */
export function setCellExists(
  cells: Record<string, CellState>,
  x: number,
  y: number,
  exists: boolean
): Record<string, CellState> {
  const key = cellKey(x, y)
  const has = key in cells
  if (exists === has) return cells
  const next = { ...cells }
  if (exists) {
    next[key] = { ...BLANK }
  } else {
    delete next[key]
  }
  return next
}

/**
 * Replaces the shape with a `width × height` rectangle anchored at (0,0),
 * preserving the play state of any cell that survives the change.
 */
export function setRectangle(
  cells: Record<string, CellState>,
  width: number,
  height: number
): Record<string, CellState> {
  const next: Record<string, CellState> = {}
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const key = cellKey(x, y)
      next[key] = cells[key] ?? { ...BLANK }
    }
  }
  return next
}

/** Sets a mark on an existing cell. No-op if the cell isn't part of the shape. */
export function setMark(
  cells: Record<string, CellState>,
  x: number,
  y: number,
  mark: Mark
): Record<string, CellState> {
  const key = cellKey(x, y)
  const prev = cells[key]
  if (!prev) return cells
  return { ...cells, [key]: { ...prev, mark } }
}

/** Sets a note on an existing cell. No-op if the cell isn't part of the shape. */
export function setNote(
  cells: Record<string, CellState>,
  x: number,
  y: number,
  note: string
): Record<string, CellState> {
  const key = cellKey(x, y)
  const prev = cells[key]
  if (!prev) return cells
  return { ...cells, [key]: { ...prev, note } }
}

/** Resets every cell's mark/note to blank, keeping the shape intact. */
export function clearMarks(
  cells: Record<string, CellState>
): Record<string, CellState> {
  const next: Record<string, CellState> = {}
  for (const key of Object.keys(cells)) next[key] = { ...BLANK }
  return next
}
