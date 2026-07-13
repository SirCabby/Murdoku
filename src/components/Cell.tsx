import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import type { CellState } from '../types/puzzle'
import { MARK_GLYPH } from '../lib/cells'

interface CellProps {
  state: CellState
  rowLabel: string
  colLabel: string
  onCycle: () => void
  onNote: (note: string) => void
}

/** One grid square: left-click cycles the mark, right-click edits its note. */
export function Cell({ state, rowLabel, colLabel, onCycle, onNote }: CellProps): JSX.Element {
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
    onNote(draft.trim())
    setEditing(false)
  }

  const hasNote = state.note.length > 0
  const title = `${rowLabel} × ${colLabel}${hasNote ? ` — ${state.note}` : ''}`

  return (
    <div className="cell-wrap">
      <button
        type="button"
        className={`cell cell-${state.mark}`}
        title={title}
        aria-label={title}
        onClick={onCycle}
        onContextMenu={openNote}
      >
        <span className="cell-glyph">{MARK_GLYPH[state.mark]}</span>
        {hasNote && <span className="cell-note-dot" aria-hidden="true" />}
      </button>

      {editing && (
        <div className="note-popover" role="dialog">
          <div className="note-popover-head">{rowLabel} × {colLabel}</div>
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
