import { useEffect, useRef } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { Puzzle } from '../types/puzzle'
import { boundsOf, parseCellKey } from '../lib/coords'
import { interiorEdges, perimeterEdges } from '../lib/walls'
import { DoorDecor, LabelDecor, ObjectDecor, WindowDecor } from './BoardDecor'

interface WallsBoardProps {
  puzzle: Puzzle
  onSetWall: (key: string, on: boolean) => void
}

// A one-cell ring around the shape, matching the shape/objects boards, so all
// modes render at the same size and left/top perimeter windows (keyed off a
// cell just outside the shape) land on a real grid track.
const PAD = 1

/**
 * Walls-mode editor board. A clickable target straddles every interior edge
 * (the gridline between two existing cells); click a target to toggle its wall,
 * or press and drag across targets to paint a run — the gesture's mode (add vs
 * remove) is locked on pointer-down, exactly like the shape editor. The shape,
 * objects, windows, and room names are all drawn read-only for reference.
 */
export function WallsBoard({ puzzle, onSetWall }: WallsBoardProps): JSX.Element | null {
  const paintOn = useRef<boolean | null>(null)

  useEffect(() => {
    const stop = (): void => {
      paintOn.current = null
    }
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [])

  const keys = Object.keys(puzzle.cells)
  const bounds = boundsOf(keys)
  if (!bounds) return null

  const originX = bounds.minX - PAD
  const originY = bounds.minY - PAD
  const cols = bounds.maxX - bounds.minX + 1 + PAD * 2
  const rows = bounds.maxY - bounds.minY + 1 + PAD * 2
  const style: CSSProperties = {
    gridTemplateColumns: `repeat(${cols}, var(--cell))`,
    gridTemplateRows: `repeat(${rows}, var(--cell))`,
  }

  function onDown(e: ReactPointerEvent, key: string, on: boolean): void {
    e.preventDefault()
    paintOn.current = on
    onSetWall(key, on)
  }

  function onEnter(key: string): void {
    if (paintOn.current === null) return
    onSetWall(key, paintOn.current)
  }

  return (
    <div className="board walls-board" style={style}>
      {keys.map((key) => {
        const { x, y } = parseCellKey(key)
        const pos: CSSProperties = {
          gridColumn: x - originX + 1,
          gridRow: y - originY + 1,
        }
        return <div key={key} className="wcell" style={pos} />
      })}

      <ObjectDecor puzzle={puzzle} originX={originX} originY={originY} />

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

      <WindowDecor puzzle={puzzle} originX={originX} originY={originY} />
      <DoorDecor puzzle={puzzle} originX={originX} originY={originY} />
      <LabelDecor puzzle={puzzle} originX={originX} originY={originY} />

      {interiorEdges(puzzle.cells).map((edge) => {
        const on = edge.key in puzzle.walls
        const pos: CSSProperties = {
          gridColumn: edge.x - originX + 1,
          gridRow: edge.y - originY + 1,
        }
        return (
          <button
            key={edge.key}
            type="button"
            className={`wtarget wtarget-${edge.orient}${on ? ' on' : ''}`}
            style={pos}
            aria-label={`${on ? 'Remove' : 'Add'} wall between cells at ${edge.orient === 'v' ? `${edge.x},${edge.y} and ${edge.x + 1},${edge.y}` : `${edge.x},${edge.y} and ${edge.x},${edge.y + 1}`}`}
            aria-pressed={on}
            onPointerDown={(e) => onDown(e, edge.key, !on)}
            onPointerEnter={() => onEnter(edge.key)}
          />
        )
      })}
    </div>
  )
}
