import { useEffect, useRef } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { CellObjectKind, ObjectKind, Puzzle } from '../types/puzzle'
import { boundsOf, parseCellKey } from '../lib/coords'
import { parseWallKey, perimeterEdges } from '../lib/walls'
import { OBJECT_LABEL, doorEdges, spanPieces, windowEdges } from '../lib/objects'
import { spanImageUrl } from '../lib/objectAssets'
import { DoorDecor, LabelDecor, WindowDecor, objectCellContent } from './BoardDecor'

/** What the palette currently has selected — an object kind, or the eraser. */
export type ObjectTool = ObjectKind | 'erase'

interface ObjectsBoardProps {
  puzzle: Puzzle
  tool: ObjectTool
  onSetObject: (x: number, y: number, kind: CellObjectKind | null) => void
  onSetWindow: (key: string, on: boolean) => void
  onSetDoor: (key: string, on: boolean) => void
}

// A one-cell ring around the shape so perimeter window edges (which key off a
// cell just outside the shape) land on a real grid track.
const PAD = 1

/**
 * Object-placement editor board. When a square tool is selected, each cell is a
 * paint target that places (or, with the eraser / a repeat click, clears) the
 * object; existing walls, windows, and doors are shown read-only for reference.
 * When the Window tool is selected, the cells go quiet and a clickable target
 * appears on every wall a window may mount on — interior walls and the outer
 * perimeter — mirroring the Walls-mode paint gesture. The Door tool works the
 * same way but offers only interior walls (a door joins two rooms).
 *
 * Carpets and tables autotile: a run of them fuses into one piece using the
 * murdoku.com tile art (see `tileNumberFor`). Span kinds (bed/towel/car) fuse
 * more simply, pairing adjacent same-kind squares into one two-cell image.
 */
export function ObjectsBoard({
  puzzle,
  tool,
  onSetObject,
  onSetWindow,
  onSetDoor,
}: ObjectsBoardProps): JSX.Element | null {
  // Painted value locked on pointer-down, exactly like the shape/walls editors.
  const paintCell = useRef<{ kind: CellObjectKind | null } | null>(null)
  const paintWindow = useRef<boolean | null>(null)
  const paintDoor = useRef<boolean | null>(null)

  useEffect(() => {
    const stop = (): void => {
      paintCell.current = null
      paintWindow.current = null
      paintDoor.current = null
    }
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [])

  const bounds = boundsOf(Object.keys(puzzle.cells))
  if (!bounds) return null

  const originX = bounds.minX - PAD
  const originY = bounds.minY - PAD
  const cols = bounds.maxX - bounds.minX + 1 + PAD * 2
  const rows = bounds.maxY - bounds.minY + 1 + PAD * 2
  const style: CSSProperties = {
    gridTemplateColumns: `repeat(${cols}, var(--cell))`,
    gridTemplateRows: `repeat(${rows}, var(--cell))`,
  }

  const windowTool = tool === 'window'
  const doorTool = tool === 'door'
  // Either edge tool (window/door) quiets the cells and paints on wall targets.
  const edgeTool = windowTool || doorTool

  /** The square kind this tool would place, or null when it erases/edits edges. */
  function toolKind(): CellObjectKind | null {
    if (tool === 'erase' || tool === 'window' || tool === 'door') return null
    return tool
  }

  function onCellDown(e: ReactPointerEvent, x: number, y: number, key: string): void {
    e.preventDefault()
    const kind = toolKind()
    // A repeat click with the same object clears it; otherwise place (or erase).
    const apply = kind !== null && puzzle.objects[key] === kind ? null : kind
    paintCell.current = { kind: apply }
    onSetObject(x, y, apply)
  }

  function onCellEnter(x: number, y: number): void {
    if (!paintCell.current) return
    onSetObject(x, y, paintCell.current.kind)
  }

  function onWindowDown(e: ReactPointerEvent, key: string, on: boolean): void {
    e.preventDefault()
    paintWindow.current = on
    onSetWindow(key, on)
  }

  function onWindowEnter(key: string): void {
    if (paintWindow.current === null) return
    onSetWindow(key, paintWindow.current)
  }

  function onDoorDown(e: ReactPointerEvent, key: string, on: boolean): void {
    e.preventDefault()
    paintDoor.current = on
    onSetDoor(key, on)
  }

  function onDoorEnter(key: string): void {
    if (paintDoor.current === null) return
    onSetDoor(key, paintDoor.current)
  }

  return (
    <div className="board objects-board" style={style}>
      {Object.keys(puzzle.cells).map((key) => {
        const { x, y } = parseCellKey(key)
        const kind = puzzle.objects[key]
        const pos: CSSProperties = {
          gridColumn: x - originX + 1,
          gridRow: y - originY + 1,
        }
        const { cls, img } = kind
          ? objectCellContent(puzzle.objects, x, y, kind, puzzle.walls)
          : { cls: '', img: null }

        if (edgeTool) {
          return (
            <div key={key} className={`ocell${cls}`} style={pos}>
              {img}
            </div>
          )
        }
        const label = kind ? OBJECT_LABEL[kind] : 'empty'
        return (
          <button
            key={key}
            type="button"
            className={`ocell ocell-btn${cls}`}
            style={pos}
            aria-label={`Cell ${x},${y} (${label})`}
            onPointerDown={(e) => onCellDown(e, x, y, key)}
            onPointerEnter={() => onCellEnter(x, y)}
          >
            {img}
          </button>
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

      {perimeterEdges(puzzle.cells).map(({ x, y, side }) => {
        const pos: CSSProperties = {
          gridColumn: x - originX + 1,
          gridRow: y - originY + 1,
        }
        return (
          <div
            key={`perim-${x},${y},${side}`}
            className={`wall-line wall-perim-${side}`}
            style={pos}
            aria-hidden="true"
          />
        )
      })}

      {Object.keys(puzzle.walls).map((key) => {
        const { x, y, orient } = parseWallKey(key)
        const pos: CSSProperties = {
          gridColumn: x - originX + 1,
          gridRow: y - originY + 1,
        }
        return (
          <div
            key={`wall-${key}`}
            className={`wall-line wall-line-${orient}`}
            style={pos}
            aria-hidden="true"
          />
        )
      })}

      <WindowDecor puzzle={puzzle} originX={originX} originY={originY} />
      <DoorDecor puzzle={puzzle} originX={originX} originY={originY} />
      <LabelDecor puzzle={puzzle} originX={originX} originY={originY} />

      {windowTool &&
        windowEdges(puzzle.cells, puzzle.walls).map((edge) => {
          const on = edge.key in puzzle.windows
          const pos: CSSProperties = {
            gridColumn: edge.x - originX + 1,
            gridRow: edge.y - originY + 1,
          }
          const a = `${edge.x},${edge.y}`
          const b = edge.orient === 'v' ? `${edge.x + 1},${edge.y}` : `${edge.x},${edge.y + 1}`
          return (
            <button
              key={edge.key}
              type="button"
              className={`wtarget wtarget-${edge.orient} window${on ? ' on' : ''}`}
              style={pos}
              aria-label={`${on ? 'Remove' : 'Add'} window on the wall between ${a} and ${b}`}
              aria-pressed={on}
              onPointerDown={(e) => onWindowDown(e, edge.key, !on)}
              onPointerEnter={() => onWindowEnter(edge.key)}
            />
          )
        })}

      {doorTool &&
        doorEdges(puzzle.cells, puzzle.walls).map((edge) => {
          const on = edge.key in puzzle.doors
          const pos: CSSProperties = {
            gridColumn: edge.x - originX + 1,
            gridRow: edge.y - originY + 1,
          }
          const a = `${edge.x},${edge.y}`
          const b = edge.orient === 'v' ? `${edge.x + 1},${edge.y}` : `${edge.x},${edge.y + 1}`
          return (
            <button
              key={edge.key}
              type="button"
              className={`wtarget wtarget-${edge.orient} door${on ? ' on' : ''}`}
              style={pos}
              aria-label={`${on ? 'Remove' : 'Add'} door on the wall between ${a} and ${b}`}
              aria-pressed={on}
              onPointerDown={(e) => onDoorDown(e, edge.key, !on)}
              onPointerEnter={() => onDoorEnter(edge.key)}
            />
          )
        })}
    </div>
  )
}
