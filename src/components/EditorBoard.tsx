import { useEffect, useRef } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { Puzzle } from '../types/puzzle'
import { boundsOf, cellKey } from '../lib/coords'
import { parseWallKey, perimeterEdges } from '../lib/walls'
import { DoorDecor, LabelDecor, ObjectDecor, WindowDecor } from './BoardDecor'

interface EditorBoardProps {
  puzzle: Puzzle
  onSetCell: (x: number, y: number, exists: boolean) => void
}

// How many empty "add" slots to show around the current shape so it can grow
// outward (bulges). Every time the shape reaches the padding, the bounds
// recompute and a fresh ring appears.
const PAD = 1

/**
 * Paint-style shape editor. Click or drag across empty slots to add cells;
 * click or drag across existing cells to remove them. The gesture's mode is
 * locked on pointer-down (add vs remove) so a drag does one consistent thing.
 *
 * Existing walls, objects, windows, and room names are drawn read-only for
 * reference (each is edited in its own mode); only the shape is interactive here.
 */
export function EditorBoard({ puzzle, onSetCell }: EditorBoardProps): JSX.Element {
  const paintMode = useRef<'add' | 'remove' | null>(null)

  // Stop painting whenever the pointer is released, even outside the board.
  useEffect(() => {
    const stop = (): void => {
      paintMode.current = null
    }
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [])

  const bounds = boundsOf(Object.keys(puzzle.cells))
  const minX = (bounds ? bounds.minX : 0) - PAD
  const minY = (bounds ? bounds.minY : 0) - PAD
  const maxX = (bounds ? bounds.maxX : 5) + PAD
  const maxY = (bounds ? bounds.maxY : 5) + PAD

  const cols = maxX - minX + 1
  const rows = maxY - minY + 1

  const style: CSSProperties = {
    gridTemplateColumns: `repeat(${cols}, var(--cell))`,
    gridTemplateRows: `repeat(${rows}, var(--cell))`,
  }

  function onDown(e: ReactPointerEvent, x: number, y: number, exists: boolean): void {
    e.preventDefault()
    const mode = exists ? 'remove' : 'add'
    paintMode.current = mode
    onSetCell(x, y, mode === 'add')
  }

  function onEnter(x: number, y: number): void {
    if (!paintMode.current) return
    onSetCell(x, y, paintMode.current === 'add')
  }

  // Slots are placed explicitly (not auto-flowed) so the wall overlay below can
  // share the same grid cells without bumping them out of position.
  const slots: JSX.Element[] = []
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const exists = cellKey(x, y) in puzzle.cells
      const pos: CSSProperties = {
        gridColumn: x - minX + 1,
        gridRow: y - minY + 1,
      }
      slots.push(
        <button
          key={cellKey(x, y)}
          type="button"
          className={`eslot${exists ? ' active' : ''}`}
          style={pos}
          aria-label={`${exists ? 'Remove' : 'Add'} cell ${x},${y}`}
          onPointerDown={(e) => onDown(e, x, y, exists)}
          onPointerEnter={() => onEnter(x, y)}
        />
      )
    }
  }

  return (
    <div className="board editor-board" style={style}>
      {slots}

      <ObjectDecor puzzle={puzzle} originX={minX} originY={minY} />

      {perimeterEdges(puzzle.cells).map(({ x, y, side }) => {
        const pos: CSSProperties = {
          gridColumn: x - minX + 1,
          gridRow: y - minY + 1,
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
          gridColumn: x - minX + 1,
          gridRow: y - minY + 1,
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

      <WindowDecor puzzle={puzzle} originX={minX} originY={minY} />
      <DoorDecor puzzle={puzzle} originX={minX} originY={minY} />
      <LabelDecor puzzle={puzzle} originX={minX} originY={minY} />
    </div>
  )
}
