import type { Mark } from '../types/puzzle'

// A cell records the relationship between two items from two different
// categories. The relationship is symmetric — (Suspect A, Weapon B) is the same
// cell as (Weapon B, Suspect A) — so we build a canonical, order-independent key
// by sorting the two endpoints.

function endpoint(categoryId: string, itemId: string): string {
  return `${categoryId}:${itemId}`
}

export function cellKey(
  categoryA: string,
  itemA: string,
  categoryB: string,
  itemB: string
): string {
  const a = endpoint(categoryA, itemA)
  const b = endpoint(categoryB, itemB)
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/** Cycle order used when a cell is clicked: undecided → ruled out → confirmed. */
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
