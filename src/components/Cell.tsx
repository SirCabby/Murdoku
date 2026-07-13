import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import type { CellState } from '../types/puzzle'
import { MARK_GLYPH } from '../lib/board'

/** One persona-letter guess to draw in a cell, resolved and pre-sorted by the board. */
export interface GuessChip {
  id: string
  label: string
  isVictim: boolean
}

interface CellProps {
  state: CellState
  /** Persona-letter guesses shown as a mini grid inside the cell (display order). */
  guesses?: GuessChip[] | undefined
  /**
   * The cell's committed answer, if any, drawn as one large letter. An answered
   * cell hides its guess grid — the two are mutually exclusive.
   */
  answer?: GuessChip | null | undefined
  /**
   * Whether the cell is crossed out (ruled out entirely), drawn as one large grey
   * X. Takes over the cell, hiding any answer or guesses.
   */
  cross?: boolean | undefined
  /** Left-click handler that places the active tool (guess, answer, or X). Omit for read-only. */
  onPlace?: (() => void) | undefined
  /** Right-click handler that edits the cell's note. Omit to disable notes. */
  onNote?: ((note: string) => void) | undefined
}

/**
 * One playable square. Left-click places the active tool (a tentative guess or
 * committed answer for the picked-up persona, or a crossing-out X); right-click
 * edits the cell's note. An X or a committed answer fills the cell as one large
 * letter (X > answer); otherwise any guesses are drawn as a small grid of chips.
 */
export function Cell({ state, guesses, answer, cross, onPlace, onNote }: CellProps): JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(state.note)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (editing) {
      setDraft(state.note)
      textareaRef.current?.focus()
    }
  }, [editing, state.note])

  function openNote(e: MouseEvent): void {
    e.preventDefault()
    setEditing(true)
  }

  function commit(): void {
    onNote?.(draft.trim())
    setEditing(false)
  }

  const hasNote = state.note.length > 0
  // Precedence: an X or a committed answer takes the cell over (X wins); only a
  // bare cell shows its guesses.
  const showAnswer = !cross && Boolean(answer)
  const chips = cross || answer ? [] : guesses ?? []
  // Square-ish layout: √n columns fits the letters into a compact block.
  const cols = chips.length > 0 ? Math.ceil(Math.sqrt(chips.length)) : 1

  return (
    <div className="cell-wrap">
      <button
        type="button"
        className={`cell cell-${state.mark}${onPlace ? '' : ' cell-readonly'}`}
        title={hasNote ? state.note : undefined}
        onClick={onPlace}
        // Placement is mouse-driven — don't let the click leave the cell focused.
        // A focused cell lights up its default focus ring the instant Shift is
        // pressed (the guess/answer flip re-triggers :focus-visible), reading as a
        // stray "selected" border. Keyboard Tab still focuses (no mousedown), so
        // keyboard users keep their ring.
        onMouseDown={onPlace ? (e) => e.preventDefault() : undefined}
        onContextMenu={onNote ? openNote : undefined}
      >
        <span className="cell-glyph">{MARK_GLYPH[state.mark]}</span>
        {cross && (
          <span className="cell-answer cell-answer-cross" aria-hidden="true">
            X
          </span>
        )}
        {showAnswer && answer && (
          <span
            className={`cell-answer${answer.isVictim ? ' cell-answer-victim' : ''}`}
            aria-hidden="true"
          >
            {answer.label}
          </span>
        )}
        {chips.length > 0 && (
          <span
            className="guess-grid"
            style={{ gridTemplateColumns: `repeat(${cols}, auto)` }}
            aria-hidden="true"
          >
            {chips.map((chip) => (
              <span
                key={chip.id}
                className={`guess-chip${chip.isVictim ? ' guess-chip-victim' : ''}`}
              >
                {chip.label}
              </span>
            ))}
          </span>
        )}
        {hasNote && <span className="cell-note-dot" aria-hidden="true" />}
      </button>

      {editing && (
        <div className="note-popover" role="dialog">
          <textarea
            ref={textareaRef}
            className="note-input"
            value={draft}
            placeholder="Scratch note…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditing(false)
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit()
            }}
          />
          <div className="note-popover-actions">
            <button type="button" className="btn btn-small" onClick={commit}>
              Save
            </button>
            <button
              type="button"
              className="btn btn-small btn-ghost"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
