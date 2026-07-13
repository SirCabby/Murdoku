import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import type { CellState } from '../types/puzzle'
import { MARK_GLYPH } from '../lib/board'

interface CellProps {
  state: CellState
  /** Left-click handler that cycles the mark. Omit to make the cell read-only. */
  onCycle?: (() => void) | undefined
  /** Right-click handler that edits the cell's note. Omit to disable notes. */
  onNote?: ((note: string) => void) | undefined
}

/** One playable square: left-click cycles the mark, right-click edits its note (each when enabled). */
export function Cell({ state, onCycle, onNote }: CellProps): JSX.Element {
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

  return (
    <div className="cell-wrap">
      <button
        type="button"
        className={`cell cell-${state.mark}${onCycle ? '' : ' cell-readonly'}`}
        title={hasNote ? state.note : undefined}
        onClick={onCycle}
        onContextMenu={onNote ? openNote : undefined}
      >
        <span className="cell-glyph">{MARK_GLYPH[state.mark]}</span>
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
