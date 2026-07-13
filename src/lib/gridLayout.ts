import type { Category } from '../types/puzzle'

// The classic logic-grid layout.
//
// For C categories, every unordered pair of *distinct* categories must appear
// exactly once. Puzzle books arrange these pairs into a staircase:
//
//   - Column groups (top → across), left to right:  categories[1 .. C-1]
//   - Row groups   (left → down),   top to bottom:  [ categories[0],
//                                                     categories[C-1],
//                                                     categories[C-2], ... ]
//
//   A block at (row group r, column group c) exists iff  r + c <= C - 2.
//
// That yields the familiar triangular staircase where the last category is
// listed twice (once across the top, once down the left) so the bottom-left
// pairs fill in without duplicating any pairing. Example, C = 3:
//
//                 catB        catC
//        catA   [A×B block] [A×C block]
//        catC   [C×B block]
//
// Pairs covered: {A,B}, {A,C}, {C,B} == all 3 pairs of {A,B,C}.

export interface LayoutBlock {
  /** Whether a real block of cells lives here (vs. an alignment spacer). */
  exists: boolean
  leftCat: Category
  topCat: Category
}

export interface GridLayout {
  /** Column-group categories, left → right. */
  topCats: Category[]
  /** Row-group categories, top → bottom. */
  leftCats: Category[]
  /** `blocks[r][c]` — same shape as leftCats × topCats. */
  blocks: LayoutBlock[][]
}

/**
 * Builds the staircase layout for the given categories (order matters — it is
 * the order the user arranged them in). Returns null when there are fewer than
 * two categories, since there are no pairs to compare.
 */
export function buildGridLayout(categories: Category[]): GridLayout | null {
  const count = categories.length
  if (count < 2) return null

  const head = categories[0]
  if (!head) return null

  const topCats = categories.slice(1) // categories[1 .. C-1]

  // leftCats = [ categories[0], categories[C-1], categories[C-2], ... ]
  const leftCats: Category[] = [head]
  for (let r = 1; r <= count - 2; r++) {
    const cat = categories[count - r]
    if (cat) leftCats.push(cat)
  }

  const blocks: LayoutBlock[][] = leftCats.map((leftCat, r) =>
    topCats.map((topCat, c) => ({
      exists: r + c <= count - 2,
      leftCat,
      topCat,
    }))
  )

  return { topCats, leftCats, blocks }
}
