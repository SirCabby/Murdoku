import type { Clue } from '../types/puzzle'

interface CluesPanelProps {
  /** The puzzle's authored room clues. */
  clues: Clue[]
}

/**
 * Play-mode room clues, shown full-width in the cast column beneath the persona
 * list (including its cross-out tool) and above the hint dispenser. Each clue is
 * its own green card spanning the whole panel width — deliberately outside
 * PersonaList's two-column persona grid, since a clue names no cast member and
 * isn't a placement tool. Empty-text clues (authored but never filled in) are
 * skipped; with none to show the panel renders nothing.
 */
export function CluesPanel({ clues }: CluesPanelProps): JSX.Element | null {
  const shown = clues.filter((c) => c.text.trim().length > 0)
  if (shown.length === 0) return null

  return (
    <div className="clues-panel">
      {shown.map((clue) => (
        <div key={clue.id} className="persona-card persona-card-clue">
          <div className="persona-badge persona-badge-clue" aria-hidden="true">
            🔍
          </div>
          <div className="persona-read">
            <div className="persona-clue-text">{clue.text.trim()}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
