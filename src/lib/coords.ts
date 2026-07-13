// Cell coordinate helpers. Cells live on an integer lattice and are keyed by a
// `"x,y"` string. Keeping this in one place means the key format is defined
// exactly once.

export interface Point {
  x: number
  y: number
}

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function cellKey(x: number, y: number): string {
  return `${x},${y}`
}

export function parseCellKey(key: string): Point {
  const parts = key.split(',')
  return { x: Number(parts[0]), y: Number(parts[1]) }
}

/** Bounding box of a set of cell keys, or null when there are none. */
export function boundsOf(keys: string[]): Bounds | null {
  if (keys.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const key of keys) {
    const { x, y } = parseCellKey(key)
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY }
}
