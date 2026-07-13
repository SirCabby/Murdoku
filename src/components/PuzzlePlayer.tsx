import { useEffect, useRef, useState } from 'react'
import { useLibrary } from '../state/LibraryContext'
import { personaLabel } from '../lib/personas'
import {
  loadAutoCleanup,
  loadHighlightPlacements,
  loadShowSummaries,
  saveAutoCleanup,
  saveHighlightPlacements,
  saveShowSummaries,
} from '../lib/prefs'
import { usePlayHistory } from '../state/usePlayHistory'
import { PlayerBoard } from './PlayerBoard'
import { PersonaList } from './PersonaList'
import type { PlaceMode } from './PersonaList'

interface PuzzlePlayerProps {
  puzzleId: string
  onBack: () => void
  onEdit: () => void
}

export function PuzzlePlayer({ puzzleId, onBack, onEdit }: PuzzlePlayerProps): JSX.Element {
  const { library, toggleGuess, setAnswer, toggleCross, clearBoard } = useLibrary()

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
  // Highlight the picked-up persona's existing placements (their guesses/answers
  // already on the board turn orange). A view preference like the summaries
  // switch, stored under its own localStorage key. Defaults on.
  const [highlight, setHighlight] = useState(loadHighlightPlacements)
  function toggleHighlight(): void {
    const next = !highlight
    setHighlight(next)
    saveHighlightPlacements(next)
  }
  // "Clean up" behaviour when committing an answer. Manual (off) leaves the board
  // as-is; Automatic (on) crosses out the rest of the answered cell's row and
  // column and drops that persona's guesses elsewhere. A view preference like the
  // summaries switch, stored under its own localStorage key.
  const [autoCleanup, setAutoCleanup] = useState(loadAutoCleanup)
  function changeCleanup(on: boolean): void {
    setAutoCleanup(on)
    saveAutoCleanup(on)
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

  // Undo/redo of board actions (guesses, answers, crosses — including an automatic
  // clean-up's whole cascade), persisted per puzzle and bound to Ctrl/Cmd+Z / +Y.
  const { canUndo, canRedo, undo, redo } = usePlayHistory(puzzle)

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
  // Anything placed on the board — enables the reset button.
  const hasMarks =
    Object.keys(puzzle.guesses).length > 0 ||
    Object.keys(puzzle.answers).length > 0 ||
    Object.keys(puzzle.crosses).length > 0

  return (
    <div className="view player">
      <div className="view-head">
        <div className="view-head-left">
          <button type="button" className="btn btn-ghost" onClick={onBack}>← Back</button>
          <h1 className="view-title">{puzzle.name}</h1>
        </div>
        <div className="view-head-actions">
          <div className="undo-redo">
            <button
              type="button"
              className="btn btn-icon"
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
            >
              ↶
            </button>
            <button
              type="button"
              className="btn btn-icon"
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y)"
              aria-label="Redo"
            >
              ↷
            </button>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!hasMarks}
            title="Clear all your marks from this board"
            onClick={() => {
              if (hasMarks && confirm('Clear all your marks from this board?')) clearBoard(puzzleId)
            }}
          >
            Reset board
          </button>
          <label className="cleanup-toggle">
            <span className="cleanup-toggle-label">Clean up:</span>
            <select
              className="cleanup-toggle-select"
              value={autoCleanup ? 'automatic' : 'manual'}
              onChange={(e) => changeCleanup(e.target.value === 'automatic')}
            >
              <option value="manual">Manual</option>
              <option value="automatic">Automatic</option>
            </select>
          </label>
          <button
            type="button"
            className={`btn${summaries ? ' is-active' : ''}`}
            aria-pressed={summaries}
            onClick={toggleSummaries}
          >
            Summaries
          </button>
          <button
            type="button"
            className={`btn${highlight ? ' is-active' : ''}`}
            aria-pressed={highlight}
            title="Highlight a picked-up person's placements in orange"
            onClick={toggleHighlight}
          >
            Highlight
          </button>
          <button type="button" className="btn" onClick={onEdit}>Edit puzzle</button>
        </div>
      </div>

      {hasCells ? (
        <div className="play-layout">
          <PersonaList
            personas={puzzle.personas}
            activeId={activePersona ? activeId : null}
            highlightId={highlight && activePersona ? activeId : null}
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
              highlightId={highlight && activePersona ? activeId : null}
              onPlace={
                holdingTool
                  ? (x, y) => {
                      if (crossActive) toggleCross(puzzleId, x, y)
                      else if (activePersona) {
                        if (effectiveMode === 'answer') setAnswer(puzzleId, x, y, activePersona.id, autoCleanup)
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
