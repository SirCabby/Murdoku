import { useRef } from 'react'
import type { Hint, Puzzle } from '../types/puzzle'

interface HintsEditorProps {
  puzzle: Puzzle
  /** Append a new hint; returns it so its text field can grab focus. */
  onAddHint: () => Hint
  onSetText: (id: string, text: string) => void
  onRemove: (id: string) => void
}

/**
 * The Hints tab: the puzzle's clues as an ordered list of numbered cards. The
 * number shown on each card is its 1-based position (derived here, never stored),
 * so removing a hint renumbers the rest. Like the People tab there's no board — a
 * hint list is independent of the shape, so this renders even before any cells
 * exist.
 */
export function HintsEditor({
  puzzle,
  onAddHint,
  onSetText,
  onRemove,
}: HintsEditorProps): JSX.Element {
  // A freshly added hint asks its text input to grab focus once, so the author
  // can start typing straight away (mirrors the personas/room-label editors).
  const focusId = useRef<string | null>(null)

  function addHint(): void {
    const hint = onAddHint()
    focusId.current = hint.id
  }

  return (
    <div className="hint-editor">
      {puzzle.hints.length === 0 ? (
        <p className="empty-state">No hints yet. Add one to start writing clues.</p>
      ) : (
        puzzle.hints.map((hint, i) => (
          <div key={hint.id} className="hint-card">
            <div className="hint-num" aria-hidden="true">
              {i + 1}
            </div>
            <textarea
              className="input hint-text"
              value={hint.text}
              placeholder="Hint text"
              aria-label={`Hint ${i + 1}`}
              rows={2}
              ref={(el) => {
                if (el && focusId.current === hint.id) {
                  el.focus()
                  focusId.current = null
                }
              }}
              onChange={(e) => onSetText(hint.id, e.target.value)}
            />
            <button
              type="button"
              className="hint-del"
              aria-label={`Remove hint ${i + 1}`}
              title="Remove hint"
              onClick={() => onRemove(hint.id)}
            >
              ✕
            </button>
          </div>
        ))
      )}
      <button type="button" className="btn btn-small hint-add" onClick={addHint}>
        + Add hint
      </button>
    </div>
  )
}
