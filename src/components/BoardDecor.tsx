import type { CSSProperties } from 'react'
import type { CellObjectKind, Puzzle } from '../types/puzzle'
import { cellKey, parseCellKey } from '../lib/coords'
import { parseWallKey } from '../lib/walls'
import { bedDominoes, isTileMergeKind, tileNumberFor } from '../lib/objects'
import { baseIconUrl, bedImageUrl, tileUrl } from '../lib/objectAssets'

// Read-only overlays so every editor mode can show the whole puzzle — objects,
// windows, and room names — not just the layer it edits. Each takes the board's
// grid origin (its top-left lattice coord, which differs per board because of
// the padding ring) so positions line up regardless of which board hosts it.
// All decor is `aria-hidden` and click-through, so the active layer beneath it
// keeps every pointer event.

interface DecorProps {
  puzzle: Puzzle
  originX: number
  originY: number
}

const WINDOW_ICON = baseIconUrl('window')

/**
 * The artwork (and border-affecting classes) for one placed object — shared by
 * the interactive `ObjectsBoard` and the read-only `ObjectDecor` so both draw a
 * carpet/table/bed identically. Beds return no image; they're drawn by the
 * spanning-domino layer instead.
 */
export function objectCellContent(
  objects: Record<string, CellObjectKind>,
  x: number,
  y: number,
  kind: CellObjectKind
): { cls: string; img: JSX.Element | null } {
  if (isTileMergeKind(kind)) {
    const tile = tileNumberFor(objects, x, y, kind)
    if (tile === null) {
      // A lone table has no tile; show its standalone icon in a normal cell.
      return { cls: '', img: <img className="obj-fit" src={baseIconUrl(kind)} alt="" /> }
    }
    return { cls: ' ocell-tile', img: <img className="obj-fill" src={tileUrl(kind, tile)} alt="" /> }
  }
  if (kind === 'bed') {
    return { cls: ' ocell-bed', img: null }
  }
  return { cls: '', img: <img className="obj-fit" src={baseIconUrl(kind)} alt="" /> }
}

/**
 * Read-only object artwork (icons + autotiled carpets/tables + bed dominoes)
 * drawn over a board's cells for reference. Uses the `ocell-ghost` variant so
 * there's no floor tile and clicks fall through to the board's own cells.
 */
export function ObjectDecor({ puzzle, originX, originY }: DecorProps): JSX.Element {
  return (
    <>
      {Object.entries(puzzle.objects).map(([key, kind]) => {
        const { x, y } = parseCellKey(key)
        const { cls, img } = objectCellContent(puzzle.objects, x, y, kind)
        if (!img) return null // beds are drawn by the domino layer below
        const pos: CSSProperties = {
          gridColumn: x - originX + 1,
          gridRow: y - originY + 1,
        }
        return (
          <div key={`obj-${key}`} className={`ocell ocell-ghost${cls}`} style={pos} aria-hidden="true">
            {img}
          </div>
        )
      })}

      {bedDominoes(puzzle.objects).map((piece) => {
        const pos: CSSProperties = {
          gridColumn: `${piece.x - originX + 1} / span ${piece.w}`,
          gridRow: `${piece.y - originY + 1} / span ${piece.h}`,
        }
        return (
          <img
            key={`bed-${piece.x},${piece.y}`}
            className="bed-span"
            style={pos}
            src={bedImageUrl(piece.h > piece.w)}
            alt=""
            aria-hidden="true"
          />
        )
      })}
    </>
  )
}

/**
 * Read-only window icons sitting on their walls, facing inward. Identical to the
 * icons `ObjectsBoard` draws, so windows look the same in every mode.
 */
export function WindowDecor({ puzzle, originX, originY }: DecorProps): JSX.Element {
  return (
    <>
      {Object.keys(puzzle.windows).map((key) => {
        const { x, y, orient } = parseWallKey(key)
        const pos: CSSProperties = {
          gridColumn: x - originX + 1,
          gridRow: y - originY + 1,
        }
        // A window faces into the room. The art defaults to facing up (h) /
        // right (v), toward the wall's top/right cell; flip it when that cell is
        // outside the shape (top- and right-perimeter walls), so it always
        // faces inward. Interior walls keep the default.
        const inwardCell = orient === 'h' ? cellKey(x, y) : cellKey(x + 1, y)
        const flip = !(inwardCell in puzzle.cells)
        return (
          <img
            key={`win-${key}`}
            className={`window-icon window-icon-${orient}${flip ? ' window-icon-flip' : ''}`}
            style={pos}
            src={WINDOW_ICON}
            alt=""
            aria-hidden="true"
          />
        )
      })}
    </>
  )
}

/**
 * Read-only room-name labels, anchored bottom-centre exactly like the play view
 * and the draggable editor pills. Blank labels are skipped.
 */
export function LabelDecor({ puzzle, originX, originY }: DecorProps): JSX.Element {
  return (
    <>
      {puzzle.labels.map((label) => {
        const text = label.text.trim()
        if (!text) return null
        const pos: CSSProperties = {
          left: `calc(var(--cell) * ${label.x - originX})`,
          top: `calc(var(--cell) * ${label.y - originY})`,
        }
        return (
          <div key={label.id} className="rlabel-static" style={pos}>
            {text}
          </div>
        )
      })}
    </>
  )
}
