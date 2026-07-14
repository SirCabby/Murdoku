import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { Puzzle, RoomLabel } from '../types/puzzle'
import { boundsOf, parseCellKey } from '../lib/coords'
import { parseWallKey, perimeterEdges } from '../lib/walls'
import { roomBottomCenter, roomOf } from '../lib/rooms'
import { DoorDecor, ObjectDecor, WindowDecor } from './BoardDecor'

interface RoomsBoardProps {
  puzzle: Puzzle
  /** Drop a new (empty) label at a lattice point; returns it so it can be focused. */
  onAddLabel: (x: number, y: number) => RoomLabel
  onMoveLabel: (id: string, x: number, y: number) => void
  onSetLabelText: (id: string, text: string) => void
  onRemoveLabel: (id: string) => void
}

/** Label positions land on this lattice step, so names align to cell centres and gridlines. */
const SNAP = 0.5

/** In-flight drag: the label id plus the live snapped position and the anchors to derive it. */
interface DragState {
  id: string
  startX: number
  startY: number
  pointerX: number
  pointerY: number
  cellPx: number
  x: number
  y: number
}

function snap(v: number): number {
  return Math.round(v / SNAP) * SNAP
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/**
 * Rooms-mode editor board. The shape, walls, objects, and windows are drawn
 * read-only; every cell is a target that, on click, drops a room-name label
 * along the bottom of the room it belongs to (a wall-bounded flood fill — see
 * `lib/rooms.ts`). Each label is a draggable pill carrying a text input and a
 * delete button, so the author can rename it and slide it anywhere along the
 * walls to taste.
 */
export function RoomsBoard({
  puzzle,
  onAddLabel,
  onMoveLabel,
  onSetLabelText,
  onRemoveLabel,
}: RoomsBoardProps): JSX.Element | null {
  const boardRef = useRef<HTMLDivElement>(null)
  // Newly added labels ask their input to grab focus once, so typing can begin
  // immediately after dropping one.
  const focusId = useRef<string | null>(null)
  // Live drag position is kept local so dragging doesn't thrash the library (and
  // localStorage) on every pointer move; the final spot is committed on release.
  const drag = useRef<DragState | null>(null)
  const [dragTick, setDragTick] = useState<DragState | null>(null)

  const bounds = boundsOf(Object.keys(puzzle.cells))

  const isDragging = dragTick !== null
  // Shape bounds — labels clamp to these so they stay over the actual rooms.
  const minX = bounds ? bounds.minX : 0
  const maxX = bounds ? bounds.maxX : 0
  const minY = bounds ? bounds.minY : 0
  const maxY = bounds ? bounds.maxY : 0
  // The board hugs the shape's own bounds — no padding ring. A top-/left-perimeter
  // window is the only decor that would fall outside; WindowDecor re-seats it onto
  // a real cell (`anchorInCell`) as the play board does.
  const originX = minX
  const originY = minY
  const cols = maxX - minX + 1

  useEffect(() => {
    if (!isDragging) return
    const move = (e: PointerEvent): void => {
      const d = drag.current
      if (!d) return
      const dx = (e.clientX - d.pointerX) / d.cellPx
      const dy = (e.clientY - d.pointerY) / d.cellPx
      const x = clamp(snap(d.startX + dx), minX, maxX + 1)
      const y = clamp(snap(d.startY + dy), minY, maxY + 1)
      const next: DragState = { ...d, x, y }
      drag.current = next
      setDragTick(next)
    }
    const up = (): void => {
      const d = drag.current
      drag.current = null
      setDragTick(null)
      if (d) onMoveLabel(d.id, d.x, d.y)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [isDragging, minX, maxX, minY, maxY, onMoveLabel])

  if (!bounds) return null

  const rows = maxY - minY + 1
  const style: CSSProperties = {
    gridTemplateColumns: `repeat(${cols}, var(--cell))`,
    gridTemplateRows: `repeat(${rows}, var(--cell))`,
  }

  /** Turn a lattice point into a position over the (relative) board. */
  function anchorStyle(x: number, y: number): CSSProperties {
    return {
      left: `calc(var(--cell) * ${x - originX})`,
      top: `calc(var(--cell) * ${y - originY})`,
    }
  }

  function addLabelInRoom(startKey: string): void {
    const room = roomOf(puzzle.cells, puzzle.walls, startKey)
    const { x, y } = roomBottomCenter(room)
    const label = onAddLabel(x, y)
    focusId.current = label.id
  }

  function onLabelDown(e: ReactPointerEvent, label: RoomLabel): void {
    // Ignore drags that start on the input or delete button (they stop
    // propagation), so only a grab on the pill body begins a move.
    e.preventDefault()
    const board = boardRef.current
    if (!board) return
    const rect = board.getBoundingClientRect()
    const cellPx = cols > 0 ? rect.width / cols : 1
    const state: DragState = {
      id: label.id,
      startX: label.x,
      startY: label.y,
      pointerX: e.clientX,
      pointerY: e.clientY,
      cellPx,
      x: label.x,
      y: label.y,
    }
    drag.current = state
    setDragTick(state)
  }

  return (
    <div ref={boardRef} className="board rooms-board" style={style}>
      {Object.keys(puzzle.cells).map((key) => {
        const { x, y } = parseCellKey(key)
        const pos: CSSProperties = {
          gridColumn: x - originX + 1,
          gridRow: y - originY + 1,
        }
        return (
          <button
            key={key}
            type="button"
            className="rcell"
            style={pos}
            aria-label={`Name the room containing cell ${x},${y}`}
            onClick={() => addLabelInRoom(key)}
          />
        )
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

      <WindowDecor puzzle={puzzle} originX={originX} originY={originY} anchorInCell />
      <DoorDecor puzzle={puzzle} originX={originX} originY={originY} />

      {puzzle.labels.map((label) => {
        const live = dragTick && dragTick.id === label.id ? dragTick : label
        return (
          <div
            key={label.id}
            className={`rlabel${isDragging && dragTick?.id === label.id ? ' dragging' : ''}`}
            style={anchorStyle(live.x, live.y)}
            onPointerDown={(e) => onLabelDown(e, label)}
          >
            <input
              className="rlabel-input"
              value={label.text}
              placeholder="Room"
              aria-label="Room name"
              size={Math.max(1, label.text.length)}
              ref={(el) => {
                if (el && focusId.current === label.id) {
                  el.focus()
                  focusId.current = null
                }
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onChange={(e) => onSetLabelText(label.id, e.target.value)}
            />
            <button
              type="button"
              className="rlabel-del"
              aria-label="Delete room label"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onRemoveLabel(label.id)}
            >
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}
