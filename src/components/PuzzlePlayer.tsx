import { useEffect, useRef, useState } from 'react'
import { useLibrary } from '../state/LibraryContext'
import { personaLabel } from '../lib/personas'
import { PlayerBoard } from './PlayerBoard'
import { PersonaList } from './PersonaList'

interface PuzzlePlayerProps {
  puzzleId: string
  onBack: () => void
  onEdit: () => void
}

export function PuzzlePlayer({ puzzleId, onBack, onEdit }: PuzzlePlayerProps): JSX.Element {
  const { library, toggleGuess } = useLibrary()

  // The persona picked up as the placement tool. Its letter rides the cursor and
  // clicking a cell adds/removes that guess. Cleared on Esc or when the puzzle changes.
  const [activeId, setActiveId] = useState<string | null>(null)
  const cursorRef = useRef<HTMLDivElement | null>(null)

  const puzzle = library.puzzles[puzzleId]
  // Resolve the tool to a live persona; a stale id (e.g. removed in the editor)
  // reads as nothing picked up.
  const activePersona = activeId ? puzzle?.personas.find((p) => p.id === activeId) ?? null : null

  // Put the tool down when the puzzle changes so a letter never carries across cases.
  useEffect(() => {
    setActiveId(null)
  }, [puzzleId])

  // Esc puts the picked-up persona down.
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setActiveId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // While a persona is picked up, its letter chip follows the cursor. Positioned
  // via a ref so the constant mousemove never re-renders the board. Keyed on a
  // boolean so re-placing a guess (which re-renders) doesn't churn the listener.
  const placing = Boolean(activePersona)
  useEffect(() => {
    if (!placing) return
    function onMove(e: MouseEvent): void {
      const el = cursorRef.current
      if (el) el.style.transform = `translate(${e.clientX + 12}px, ${e.clientY + 14}px)`
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [placing])

  if (!puzzle) {
    return (
      <div className="view">
        <p>That puzzle no longer exists.</p>
        <button type="button" className="btn" onClick={onBack}>← Back</button>
      </div>
    )
  }

  const hasCells = Object.keys(puzzle.cells).length > 0

  return (
    <div className="view player">
      <div className="view-head">
        <div className="view-head-left">
          <button type="button" className="btn btn-ghost" onClick={onBack}>← Back</button>
          <h1 className="view-title">{puzzle.name}</h1>
        </div>
        <div className="view-head-actions">
          <button type="button" className="btn" onClick={onEdit}>Edit puzzle</button>
        </div>
      </div>

      {hasCells ? (
        <div className="play-layout">
          <PersonaList
            personas={puzzle.personas}
            activeId={activePersona ? activeId : null}
            onPick={(id) => setActiveId((prev) => (prev === id ? null : id))}
          />
          <div className="board-scroll">
            <PlayerBoard
              puzzle={puzzle}
              activePersonaId={activePersona ? activeId : null}
              onGuess={
                activePersona
                  ? (x, y) => toggleGuess(puzzleId, x, y, activePersona.id)
                  : undefined
              }
            />
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <p>This puzzle has no cells yet.</p>
          <button type="button" className="btn btn-primary" onClick={onEdit}>Define the shape</button>
        </div>
      )}

      {activePersona && (
        <div ref={cursorRef} className="guess-cursor" aria-hidden="true">
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
