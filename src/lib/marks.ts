import type { Category, CellState, Item, Mark, Puzzle } from '../types/puzzle'
import { cellKey } from './cells'

// Pure helpers that produce the next `cells` map for a puzzle. Everything here
// is immutable — callers replace `puzzle.cells` with the returned object.

export function getCell(
  cells: Record<string, CellState>,
  categoryA: string,
  itemA: string,
  categoryB: string,
  itemB: string
): CellState {
  return cells[cellKey(categoryA, itemA, categoryB, itemB)] ?? { mark: 'blank', note: '' }
}

function withCell(
  cells: Record<string, CellState>,
  key: string,
  patch: Partial<CellState>
): Record<string, CellState> {
  const prev = cells[key] ?? { mark: 'blank', note: '' }
  return { ...cells, [key]: { ...prev, ...patch } }
}

/**
 * Sets a single pairing's mark. When `mark === 'yes'` and `autoEliminate` is on,
 * every other pairing in the same block row and column is set to `no` — but only
 * where it is currently `blank`, so we never clobber a mark the player set by
 * hand. This is the one-per-row / one-per-column rule that makes a confirmed
 * pairing rule out its neighbours.
 */
export function setMark(
  puzzle: Puzzle,
  catA: Category,
  itemA: Item,
  catB: Category,
  itemB: Item,
  mark: Mark,
  autoEliminate: boolean
): Record<string, CellState> {
  const key = cellKey(catA.id, itemA.id, catB.id, itemB.id)
  let cells = withCell(puzzle.cells, key, { mark })

  if (mark === 'yes' && autoEliminate) {
    // Same row: itemA paired with every *other* item of catB.
    for (const other of catB.items) {
      if (other.id === itemB.id) continue
      const k = cellKey(catA.id, itemA.id, catB.id, other.id)
      if ((cells[k]?.mark ?? 'blank') === 'blank') {
        cells = withCell(cells, k, { mark: 'no' })
      }
    }
    // Same column: itemB paired with every *other* item of catA.
    for (const other of catA.items) {
      if (other.id === itemA.id) continue
      const k = cellKey(catA.id, other.id, catB.id, itemB.id)
      if ((cells[k]?.mark ?? 'blank') === 'blank') {
        cells = withCell(cells, k, { mark: 'no' })
      }
    }
  }

  return cells
}

export function setNote(
  puzzle: Puzzle,
  catA: Category,
  itemA: Item,
  catB: Category,
  itemB: Item,
  note: string
): Record<string, CellState> {
  const key = cellKey(catA.id, itemA.id, catB.id, itemB.id)
  return withCell(puzzle.cells, key, { note })
}
