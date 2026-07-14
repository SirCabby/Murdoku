import type { CSSProperties } from 'react'
import type { CellObjectKind, Puzzle } from '../types/puzzle'
import { cellKey, parseCellKey } from '../lib/coords'
import { parseWallKey } from '../lib/walls'
import { isSpanKind, isTileMergeKind, spanPieces, tileNumberFor } from '../lib/objects'
import { baseIconUrl, spanImageUrl, tileUrl } from '../lib/objectAssets'

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

interface WindowDecorProps extends DecorProps {
  /**
   * Re-seat top-/left-perimeter windows onto their existing neighbour cell rather
   * than the (nonexistent) cell just outside the shape. Boards that render a
   * one-cell padding ring (every editor board) leave this off, so a perimeter
   * window lands on the outside pad track as usual. The play board draws no such
   * ring, so it turns this on to keep those windows on a real cell — the icon
   * still sits on the same wall line, facing the same way.
   */
  anchorInCell?: boolean | undefined
}

const WINDOW_ICON = baseIconUrl('window')
const DOOR_ICON = baseIconUrl('door')

/**
 * The artwork (and border-affecting classes) for one placed object — shared by
 * the interactive `ObjectsBoard` and the read-only `ObjectDecor` so both draw a
 * carpet/table/bed identically. Span kinds (bed/car/tower) return no image;
 * they're drawn by the spanning-piece layer instead.
 */
export function objectCellContent(
  objects: Record<string, CellObjectKind>,
  x: number,
  y: number,
  kind: CellObjectKind,
  walls: Record<string, true>
): { cls: string; img: JSX.Element | null } {
  if (isTileMergeKind(kind)) {
    const tile = tileNumberFor(objects, x, y, kind, walls)
    if (tile === null) {
      // A lone table has no tile; show its standalone icon in a normal cell.
      return { cls: '', img: <img className="obj-fit" src={baseIconUrl(kind)} alt="" /> }
    }
    return { cls: ' ocell-tile', img: <img className="obj-fill" src={tileUrl(kind, tile)} alt="" /> }
  }
  if (isSpanKind(kind)) {
    return { cls: ' ocell-span', img: null }
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
        const { cls, img } = objectCellContent(puzzle.objects, x, y, kind, puzzle.walls)
        if (!img) return null // span kinds are drawn by the piece layer below
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

      {spanPieces(puzzle.objects, puzzle.walls).map((piece) => {
        const pos: CSSProperties = {
          gridColumn: `${piece.x - originX + 1} / span ${piece.w}`,
          gridRow: `${piece.y - originY + 1} / span ${piece.h}`,
        }
        return (
          <img
            key={`span-${piece.x},${piece.y}`}
            className="obj-span"
            style={pos}
            src={spanImageUrl(piece.kind, piece.h > piece.w)}
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
export function WindowDecor({ puzzle, originX, originY, anchorInCell }: WindowDecorProps): JSX.Element {
  return (
    <>
      {Object.keys(puzzle.windows).map((key) => {
        const { x, y, orient } = parseWallKey(key)
        // A window faces into the room. The art defaults to facing up (h) /
        // right (v), toward the wall's top/right cell; flip it when that cell is
        // outside the shape (top- and right-perimeter walls), so it always
        // faces inward. Interior walls keep the default.
        const inwardCell = orient === 'h' ? cellKey(x, y) : cellKey(x + 1, y)
        const flip = !(inwardCell in puzzle.cells)

        // The window normally hangs on the *far* edge of its keyed (top-left)
        // cell. For a top-/left-perimeter wall that keyed cell is outside the
        // shape, so on a padless board we re-seat the icon onto the near edge of
        // the existing neighbour — the same wall line, still facing inward — so it
        // needs no outside track.
        let gx = x
        let gy = y
        let cls = `window-icon window-icon-${orient}${flip ? ' window-icon-flip' : ''}`
        if (anchorInCell && !(cellKey(x, y) in puzzle.cells)) {
          if (orient === 'h') {
            gy = y + 1 // top-perimeter: drop onto the cell below, on its top edge
            cls = 'window-icon window-icon-h-below'
          } else {
            gx = x + 1 // left-perimeter: shift onto the cell right, on its left edge
            cls = 'window-icon window-icon-v-right'
          }
        }
        const pos: CSSProperties = {
          gridColumn: gx - originX + 1,
          gridRow: gy - originY + 1,
        }
        return (
          <img key={`win-${key}`} className={cls} style={pos} src={WINDOW_ICON} alt="" aria-hidden="true" />
        )
      })}
    </>
  )
}

/**
 * Read-only door icons sitting on their interior walls. A door always divides two
 * existing cells, so — unlike a window — it never needs perimeter re-seating or
 * flipping: it is keyed from its top-left cell and drawn on that cell's right (v)
 * or bottom (h) edge, the same wall line in every mode (padded editor boards and
 * the padless play board alike, since that keyed cell always exists).
 */
export function DoorDecor({ puzzle, originX, originY }: DecorProps): JSX.Element {
  return (
    <>
      {Object.keys(puzzle.doors).map((key) => {
        const { x, y, orient } = parseWallKey(key)
        const pos: CSSProperties = {
          gridColumn: x - originX + 1,
          gridRow: y - originY + 1,
        }
        return (
          <img
            key={`door-${key}`}
            className={`door-icon door-icon-${orient}`}
            style={pos}
            src={DOOR_ICON}
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
