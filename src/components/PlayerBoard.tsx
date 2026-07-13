import type { CSSProperties } from 'react'
import type { Puzzle } from '../types/puzzle'
import { boundsOf, parseCellKey } from '../lib/coords'
import { parseWallKey, perimeterEdges } from '../lib/walls'
import { ObjectDecor, WindowDecor } from './BoardDecor'
import { Cell } from './Cell'

interface PlayerBoardProps {
  puzzle: Puzzle
  /** Cycle a cell's mark. Omit to render the board read-only (marks can't be changed). */
  onCycle?: ((x: number, y: number) => void) | undefined
  /** Edit a cell's note. Omit to disable notes. */
  onNote?: ((x: number, y: number, note: string) => void) | undefined
}

// A one-cell ring around the shape, matching every editor board, so top-/left-
// perimeter windows (keyed off a cell just outside the shape) land on a real
// grid track and the puzzle renders at the same size players saw while editing.
const PAD = 1

/**
 * Renders the puzzle's shape at play. Cells are placed at their real lattice
 * positions, so notches/holes show up as gaps rather than being collapsed away.
 * Objects, windows, and room names are drawn over the cells exactly as the
 * editor's read-only decor does, so the played board matches the edited one.
 */
export function PlayerBoard({ puzzle, onCycle, onNote }: PlayerBoardProps): JSX.Element | null {
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

  return (
    <div className="board player-board" style={style}>
      {keys.map((key) => {
        const { x, y } = parseCellKey(key)
        const state = puzzle.cells[key]
        if (!state) return null
        const pos: CSSProperties = {
          gridColumn: x - originX + 1,
          gridRow: y - originY + 1,
        }
        return (
          <div key={key} className="cell-pos" style={pos}>
            <Cell
              state={state}
              onCycle={onCycle ? () => onCycle(x, y) : undefined}
              onNote={onNote ? (note) => onNote(x, y, note) : undefined}
            />
          </div>
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

      <WindowDecor puzzle={puzzle} originX={originX} originY={originY} />

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
    </div>
  )
}
