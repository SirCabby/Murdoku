import type { CSSProperties } from 'react'
import type { Puzzle } from '../types/puzzle'
import { boundsOf, parseCellKey } from '../lib/coords'
import { parseWallKey } from '../lib/walls'
import { Cell } from './Cell'

interface PlayerBoardProps {
  puzzle: Puzzle
  /** Cycle a cell's mark. Omit to render the board read-only (marks can't be changed). */
  onCycle?: ((x: number, y: number) => void) | undefined
  /** Edit a cell's note. Omit to disable notes. */
  onNote?: ((x: number, y: number, note: string) => void) | undefined
}

/**
 * Renders the puzzle's shape at play. Cells are placed at their real lattice
 * positions, so notches/holes show up as gaps rather than being collapsed away.
 */
export function PlayerBoard({ puzzle, onCycle, onNote }: PlayerBoardProps): JSX.Element | null {
  const keys = Object.keys(puzzle.cells)
  const bounds = boundsOf(keys)
  if (!bounds) return null

  const cols = bounds.maxX - bounds.minX + 1
  const rows = bounds.maxY - bounds.minY + 1

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
          gridColumn: x - bounds.minX + 1,
          gridRow: y - bounds.minY + 1,
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

      {Object.keys(puzzle.walls).map((key) => {
        const { x, y, orient } = parseWallKey(key)
        const pos: CSSProperties = {
          gridColumn: x - bounds.minX + 1,
          gridRow: y - bounds.minY + 1,
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
    </div>
  )
}
