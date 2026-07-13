import { useState } from 'react'
import type { Hint } from '../types/puzzle'

interface HintsPanelProps {
  /** The puzzle's authored hints, in order. */
  hints: Hint[]
}

/**
 * Play-mode hint dispenser, shown beneath the cast. Hints stay hidden until the
 * player asks for them: "Show hints" reveals every clue at once but collapsed —
 * each shows only its number, and the player expands the ones they want to read
 * by clicking its header. "Hide hints" tucks the whole panel away again. All of
 * this is ephemeral view state: it lives here, not in the puzzle, and is not
 * persisted — leaving the puzzle and returning starts collapsed again, since
 * PuzzlePlayer remounts per id.
 */
export function HintsPanel({ hints }: HintsPanelProps): JSX.Element | null {
  // Whether the panel is expanded to show the (collapsed) clue list.
  const [open, setOpen] = useState(false)
  // Which hints the player has expanded to read. Default empty → all collapsed.
  // Keyed by hint id so the set survives renumbering.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  // No clues authored → no dispenser to show.
  if (hints.length === 0) return null

  function toggleExpand(id: string): void {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (!open) {
    return (
      <div className="hints-panel">
        <button type="button" className="btn btn-small hints-show" onClick={() => setOpen(true)}>
          Show hints
        </button>
      </div>
    )
  }

  return (
    <div className="hints-panel is-open">
      <div className="hints-panel-head">
        <h2 className="hints-panel-title">Hints</h2>
        <button type="button" className="btn btn-small btn-ghost" onClick={() => setOpen(false)}>
          Hide hints
        </button>
      </div>
      {hints.map((hint, i) => {
        const isExpanded = expanded.has(hint.id)
        const text = hint.text.trim()
        return (
          <div key={hint.id} className={`play-hint${isExpanded ? '' : ' is-zipped'}`}>
            <button
              type="button"
              className="play-hint-head"
              aria-expanded={isExpanded}
              title={isExpanded ? 'Zip this hint back up' : 'Show this hint'}
              onClick={() => toggleExpand(hint.id)}
            >
              <span className="play-hint-num" aria-hidden="true">
                {i + 1}
              </span>
              <span className="play-hint-toggle" aria-hidden="true">
                {isExpanded ? '▾' : '▸'}
              </span>
            </button>
            {isExpanded && (
              <div className={`play-hint-text${text ? '' : ' is-empty'}`}>
                {text || 'This hint has no text yet.'}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
