import { useEffect, useRef, useState } from 'react'
import type { Puzzle } from '../types/puzzle'
import { personaLabel } from '../lib/personas'
import { solutionCrosses } from '../lib/solution'
import { PlayerBoard } from './PlayerBoard'
import { PersonaList } from './PersonaList'

interface SolutionEditorProps {
  puzzle: Puzzle
  /** Place the picked-up persona in a cell of the answer key (the store keeps it legal). */
  onPlace: (x: number, y: number, personaId: string) => void
}

// The answer-key board never draws guesses — the author only commits definitive
// placements — so it always passes the same empty guess map.
const NO_GUESSES: Record<string, string[]> = {}

/**
 * The editor's Answer key tab: pick a cast member, then click rooms to place the
 * puzzle's definitive solution. Placement is authoritative and self-correcting —
 * the store enforces one cell per persona and at most one per row / column (see
 * `lib/solution.ts`) — and every other placeable room is X'd automatically to show
 * the ruled-out cells. Reuses the play board and persona list so the key looks
 * exactly like the solved puzzle a player is working toward.
 */
export function SolutionEditor({ puzzle, onPlace }: SolutionEditorProps): JSX.Element {
  // The persona picked up as the placement tool, if any. Cleared on Esc or when
  // the puzzle changes, mirroring the play view.
  const [activeId, setActiveId] = useState<string | null>(null)
  const cursorRef = useRef<HTMLDivElement | null>(null)

  const activePersona = activeId ? puzzle.personas.find((p) => p.id === activeId) ?? null : null
  const holding = Boolean(activePersona)

  function pick(id: string): void {
    setActiveId((prev) => (prev === id ? null : id))
  }

  // Put the tool down when the puzzle changes so nothing carries across cases.
  useEffect(() => {
    setActiveId(null)
  }, [puzzle.id])

  // Esc puts the picked-up persona down.
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setActiveId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // While a persona is held, its chip follows the cursor. Positioned via a ref so
  // the constant mousemove never re-renders the board.
  useEffect(() => {
    if (!holding) return
    function onMove(e: MouseEvent): void {
      const el = cursorRef.current
      if (el) el.style.transform = `translate(${e.clientX + 12}px, ${e.clientY + 14}px)`
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [holding])

  // Every placeable room with no persona is ruled out — derived fresh each render.
  const crosses = solutionCrosses(puzzle.solution, puzzle.cells, puzzle.objects)

  return (
    <div className="play-layout">
      <PersonaList personas={puzzle.personas} activeId={activeId} onPick={pick} />
      <div className="play-board-col">
        <div className="board-scroll">
          <PlayerBoard
            puzzle={puzzle}
            active={holding}
            answers={puzzle.solution}
            guesses={NO_GUESSES}
            crosses={crosses}
            onPlace={holding && activePersona ? (x, y) => onPlace(x, y, activePersona.id) : undefined}
          />
        </div>
      </div>

      {holding && activePersona && (
        <div ref={cursorRef} className="guess-cursor guess-cursor-answer" aria-hidden="true">
          <span
            className={`guess-chip${activePersona.role === 'victim' ? ' guess-chip-victim' : ''}`}
          >
            {personaLabel(puzzle.personas, activePersona)}
          </span>
        </div>
      )}
    </div>
  )
}
