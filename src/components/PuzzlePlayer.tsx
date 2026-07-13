import { useEffect, useRef, useState } from 'react'
import { useLibrary } from '../state/LibraryContext'
import { personaLabel } from '../lib/personas'
import { loadShowSummaries, saveShowSummaries } from '../lib/prefs'
import { PlayerBoard } from './PlayerBoard'
import { PersonaList } from './PersonaList'
import type { PlaceMode } from './PersonaList'

interface PuzzlePlayerProps {
  puzzleId: string
  onBack: () => void
  onEdit: () => void
}

export function PuzzlePlayer({ puzzleId, onBack, onEdit }: PuzzlePlayerProps): JSX.Element {
  const { library, toggleGuess, setAnswer, toggleCross } = useLibrary()

  // The tool picked up for placing. Either a persona (its letter rides the cursor)
  // or the X tool (`crossActive`) — mutually exclusive. Cleared on Esc or when the
  // puzzle changes. `mode` only governs how a *persona* lands (guess vs answer).
  const [activeId, setActiveId] = useState<string | null>(null)
  const [crossActive, setCrossActive] = useState(false)
  const [mode, setMode] = useState<PlaceMode>('guess')
  // Show per-column / per-row persona summaries around the board. A view
  // preference (not puzzle content), so it's read from / written to its own
  // localStorage key and survives refreshes.
  const [summaries, setSummaries] = useState(loadShowSummaries)
  function toggleSummaries(): void {
    const next = !summaries
    setSummaries(next)
    saveShowSummaries(next)
  }
  // Holding Shift temporarily flips guess↔answer, so you can drop the opposite of
  // the picked mode without touching the dropdown.
  const [shiftHeld, setShiftHeld] = useState(false)
  const cursorRef = useRef<HTMLDivElement | null>(null)

  const puzzle = library.puzzles[puzzleId]
  // Resolve the tool to a live persona; a stale id (e.g. removed in the editor)
  // reads as nothing picked up.
  const activePersona = activeId ? puzzle?.personas.find((p) => p.id === activeId) ?? null : null
  // A tool is in hand when a persona is picked up or the X tool is active. That's
  // when the board is clickable.
  const holdingTool = crossActive || Boolean(activePersona)
  // The mode a click actually lands in: holding Shift flips guess↔answer while the
  // key is down (the X tool ignores mode, so this only matters with a persona).
  const effectiveMode: PlaceMode = shiftHeld ? (mode === 'answer' ? 'guess' : 'answer') : mode

  // Pick up a persona (dropping the X tool), or the X tool (dropping the persona).
  function pickPersona(id: string): void {
    setActiveId((prev) => (prev === id ? null : id))
    setCrossActive(false)
  }
  function pickCross(): void {
    setCrossActive((prev) => !prev)
    setActiveId(null)
  }

  // Put every tool down when the puzzle changes so nothing carries across cases.
  useEffect(() => {
    setActiveId(null)
    setCrossActive(false)
  }, [puzzleId])

  // Esc puts the picked-up tool down.
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        setActiveId(null)
        setCrossActive(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Track whether Shift is down so a click can land in the inverted mode. Listened
  // for globally (not gated on holding a tool) so picking one up mid-hold already
  // reflects the key; reset on blur since an alt-tab can swallow the keyup.
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Shift') setShiftHeld(e.type === 'keydown')
    }
    function onBlur(): void {
      setShiftHeld(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  // While a tool is in hand, its chip follows the cursor. Positioned via a ref so
  // the constant mousemove never re-renders the board. Keyed on a boolean so
  // re-placing (which re-renders) doesn't churn the listener.
  useEffect(() => {
    if (!holdingTool) return
    function onMove(e: MouseEvent): void {
      const el = cursorRef.current
      if (el) el.style.transform = `translate(${e.clientX + 12}px, ${e.clientY + 14}px)`
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [holdingTool])

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
          <button
            type="button"
            className={`btn${summaries ? ' is-active' : ''}`}
            aria-pressed={summaries}
            onClick={toggleSummaries}
          >
            Summaries
          </button>
          <button type="button" className="btn" onClick={onEdit}>Edit puzzle</button>
        </div>
      </div>

      {hasCells ? (
        <div className="play-layout">
          <PersonaList
            personas={puzzle.personas}
            activeId={activePersona ? activeId : null}
            onPick={pickPersona}
            mode={mode}
            onModeChange={setMode}
            crossActive={crossActive}
            onPickCross={pickCross}
          />
          <div className="board-scroll">
            <PlayerBoard
              puzzle={puzzle}
              active={holdingTool}
              summaries={summaries}
              onPlace={
                holdingTool
                  ? (x, y) => {
                      if (crossActive) toggleCross(puzzleId, x, y)
                      else if (activePersona) {
                        if (effectiveMode === 'answer') setAnswer(puzzleId, x, y, activePersona.id)
                        else toggleGuess(puzzleId, x, y, activePersona.id)
                      }
                    }
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

      {holdingTool && (
        <div
          ref={cursorRef}
          className={
            `guess-cursor` +
            (crossActive ? ' guess-cursor-cross' : effectiveMode === 'answer' ? ' guess-cursor-answer' : '')
          }
          aria-hidden="true"
        >
          {crossActive ? (
            <span className="guess-chip guess-chip-cross">X</span>
          ) : (
            activePersona && (
              <span
                className={`guess-chip${activePersona.role === 'victim' ? ' guess-chip-victim' : ''}`}
              >
                {personaLabel(puzzle.personas, activePersona)}
              </span>
            )
          )}
        </div>
      )}
    </div>
  )
}
