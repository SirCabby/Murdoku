import type { CSSProperties } from 'react'
import type { Persona, Puzzle } from '../types/puzzle'
import { boundsOf, parseCellKey } from '../lib/coords'
import { parseWallKey, perimeterEdges } from '../lib/walls'
import { personaLabel, suspectsOf, victimOf } from '../lib/personas'
import { isPlacementBlocked } from '../lib/objects'
import { ObjectDecor, WindowDecor } from './BoardDecor'
import { Cell } from './Cell'
import type { GuessChip } from './Cell'

interface PlayerBoardProps {
  puzzle: Puzzle
  /**
   * Whether a placement tool is held (a picked-up persona, or the X tool). When
   * true the board reads as "placing" (crosshair cursor) and a cell click fires
   * `onPlace`.
   */
  active?: boolean | undefined
  /**
   * Show per-column / per-row summaries: a strip above the board listing the
   * personas (guessed or answered) somewhere in each column, and a strip to its
   * right doing the same per row. Read-only; off by default.
   */
  summaries?: boolean | undefined
  /**
   * Persona id whose placements should be highlighted: every guess and answer of
   * that persona already on the board is drawn orange instead of blue/purple.
   * Set to the picked-up persona (when the highlight toggle is on) so its marks
   * stand out. Omit / null for no highlight.
   */
  highlightId?: string | null | undefined
  /**
   * Which per-cell placement maps to draw. Each defaults to the puzzle's own play
   * state; passing overrides lets the same renderer show a different layer — the
   * editor's Answer key tab draws `puzzle.solution` as the answers, no guesses, and
   * a derived cross on every other placeable cell (see `lib/solution.ts`).
   */
  answers?: Record<string, string> | undefined
  guesses?: Record<string, string[]> | undefined
  crosses?: Record<string, true> | undefined
  /** Place the active tool in a cell (guess, answer, or X, per the player's mode). Omit for read-only. */
  onPlace?: ((x: number, y: number) => void) | undefined
}

/** One persona letter shown in a column/row summary, flagged if any cell in the lane answered it. */
interface SummaryChip extends GuessChip {
  /** True when this persona is a committed answer in the lane (not just a tentative guess). */
  isAnswer: boolean
}

/**
 * Renders the puzzle's shape at play. Cells are placed at their real lattice
 * positions, so notches/holes show up as gaps rather than being collapsed away.
 * Objects, windows, and room names are drawn over the cells exactly as the
 * editor's read-only decor does, so the played board matches the edited one.
 * A crossed-out cell fills it with one large grey X; a committed answer fills it
 * with one large persona letter; an otherwise-bare cell shows its tentative
 * guesses as a small grid of persona letters.
 */
export function PlayerBoard({
  puzzle,
  active,
  summaries,
  highlightId,
  answers: answersProp,
  guesses: guessesProp,
  crosses: crossesProp,
  onPlace,
}: PlayerBoardProps): JSX.Element | null {
  // Which layer to draw: the puzzle's own play state unless the caller overrides
  // it (the editor's Answer key tab points these at the solution instead).
  const answers = answersProp ?? puzzle.answers
  const guesses = guessesProp ?? puzzle.guesses
  const crosses = crossesProp ?? puzzle.crosses

  const keys = Object.keys(puzzle.cells)
  const bounds = boundsOf(keys)
  if (!bounds) return null

  // Unlike the editor — whose one-cell ring is the interactive "add cell" slots
  // you paint to grow the shape — the play board reserves no space around the
  // rooms: it's exactly the shape's bounding box. Perimeter windows would normally
  // key off the (nonexistent) cell just outside the shape, but here `WindowDecor`
  // re-seats those onto the existing neighbour instead (`anchorInCell`), so nothing
  // ever needs an outside track and the summaries can hug the outer wall.
  const originX = bounds.minX
  const originY = bounds.minY
  const cols = bounds.maxX - bounds.minX + 1
  const rows = bounds.maxY - bounds.minY + 1

  const style: CSSProperties = {
    gridTemplateColumns: `repeat(${cols}, var(--cell))`,
    gridTemplateRows: `repeat(${rows}, var(--cell))`,
  }

  // Resolve guessed ids to display chips: the persona's derived letter plus its
  // role, in a stable A, B, C… then V order regardless of the click order.
  const byId = new Map(puzzle.personas.map((p) => [p.id, p]))
  const order = new Map<string, number>()
  const ordered: Persona[] = [
    ...suspectsOf(puzzle.personas),
    ...(victimOf(puzzle.personas) ? [victimOf(puzzle.personas)!] : []),
  ]
  ordered.forEach((p, i) => order.set(p.id, i))

  function chipFor(id: string): GuessChip | null {
    const p = byId.get(id)
    if (!p) return null
    return { id: p.id, label: personaLabel(puzzle.personas, p), isVictim: p.role === 'victim' }
  }

  function chipsFor(key: string): GuessChip[] {
    const ids = guesses[key] ?? []
    return ids
      .map((id) => chipFor(id))
      .filter((c): c is GuessChip => Boolean(c))
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
  }

  // The one committed answer for a cell, drawn as a big letter (null if none).
  function answerFor(key: string): GuessChip | null {
    const id = answers[key]
    return id ? chipFor(id) : null
  }

  // Collapse a lane's cells (a whole column or row) into the distinct personas
  // used there: each answered or guessed id once, answers taking precedence, in
  // the same A, B, C… V order the cells use. Feeds the summary strips.
  function laneSummary(laneKeys: string[]): SummaryChip[] {
    const answered = new Map<string, boolean>() // id → committed as an answer somewhere in the lane
    for (const key of laneKeys) {
      const ans = answers[key]
      if (ans) answered.set(ans, true)
      for (const id of guesses[key] ?? []) if (!answered.has(id)) answered.set(id, false)
    }
    return [...answered.entries()]
      .map(([id, isAnswer]) => {
        const chip = chipFor(id)
        return chip ? { ...chip, isAnswer } : null
      })
      .filter((c): c is SummaryChip => Boolean(c))
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
  }

  // Group the existing cells by column (x) and row (y) so each lane summarises
  // exactly the cells the board draws there.
  const colKeys = new Map<number, string[]>()
  const rowKeys = new Map<number, string[]>()
  if (summaries) {
    for (const key of keys) {
      const { x, y } = parseCellKey(key)
      ;(colKeys.get(x) ?? colKeys.set(x, []).get(x)!).push(key)
      ;(rowKeys.get(y) ?? rowKeys.set(y, []).get(y)!).push(key)
    }
  }

  const placing = Boolean(active)

  const board = (
    <div className={`board player-board${placing ? ' is-placing' : ''}`} style={style}>
      {keys.map((key) => {
        const { x, y } = parseCellKey(key)
        const state = puzzle.cells[key]
        if (!state) return null
        // A furnishing like a table fills its square, so no value (guess, answer,
        // or X) may land there — the cell reads as unplaceable while a tool's held.
        const blocked = isPlacementBlocked(puzzle.objects, key)
        const pos: CSSProperties = {
          gridColumn: x - originX + 1,
          gridRow: y - originY + 1,
        }
        return (
          <div key={key} className={`cell-pos${blocked ? ' cell-blocked' : ''}`} style={pos}>
            <Cell
              state={state}
              guesses={chipsFor(key)}
              answer={answerFor(key)}
              cross={crosses[key] === true}
              highlightId={highlightId}
              onPlace={placing && !blocked && onPlace ? () => onPlace(x, y) : undefined}
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

      <WindowDecor puzzle={puzzle} originX={originX} originY={originY} anchorInCell />

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

  if (!summaries) return board

  // Wrap the board with two summary strips that share its column / row tracks:
  // one above listing each column's personas, one to the right listing each
  // row's. Both reuse the board's origin so a lane lines up with its cells.
  const colStyle: CSSProperties = { gridTemplateColumns: `repeat(${cols}, var(--cell))` }
  const rowStyle: CSSProperties = { gridTemplateRows: `repeat(${rows}, var(--cell))` }

  return (
    <div className="player-board-frame">
      <div className="summary-cols" style={colStyle} aria-hidden="true">
        {[...colKeys].map(([x, laneKeys]) => {
          const chips = laneSummary(laneKeys)
          if (chips.length === 0) return null
          return (
            <div key={`col-${x}`} className="summary-lane summary-col" style={{ gridColumn: x - originX + 1 }}>
              {chips.map((c) => (
                <span
                  key={c.id}
                  className={
                    `guess-chip${c.isVictim ? ' guess-chip-victim' : ''}` +
                    `${c.isAnswer ? ' summary-chip-answer' : ''}` +
                    `${c.id === highlightId ? ' guess-chip-highlight' : ''}`
                  }
                >
                  {c.label}
                </span>
              ))}
            </div>
          )
        })}
      </div>

      {board}

      <div className="summary-rows" style={rowStyle} aria-hidden="true">
        {[...rowKeys].map(([y, laneKeys]) => {
          const chips = laneSummary(laneKeys)
          if (chips.length === 0) return null
          return (
            <div key={`row-${y}`} className="summary-lane summary-row" style={{ gridRow: y - originY + 1 }}>
              {chips.map((c) => (
                <span
                  key={c.id}
                  className={
                    `guess-chip${c.isVictim ? ' guess-chip-victim' : ''}` +
                    `${c.isAnswer ? ' summary-chip-answer' : ''}` +
                    `${c.id === highlightId ? ' guess-chip-highlight' : ''}`
                  }
                >
                  {c.label}
                </span>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
