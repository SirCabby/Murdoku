import type { Persona } from '../types/puzzle'
import { personaLabel, suspectsOf, victimOf } from '../lib/personas'

/** Whether clicking a cell drops a tentative guess or commits a definitive answer. */
export type PlaceMode = 'guess' | 'answer'

interface PersonaListProps {
  personas: Persona[]
  /** The persona currently picked up as the placement tool, if any. */
  activeId?: string | null
  /** Pick up a persona (or, when it's already active, drop it) as the placement tool. */
  onPick?: ((id: string) => void) | undefined
  /** The current placement mode. Only meaningful alongside `onPick`. */
  mode?: PlaceMode | undefined
  /** Switch placement mode. Omit (with `onPick`) to hide the mode control. */
  onModeChange?: ((mode: PlaceMode) => void) | undefined
}

/**
 * The cast shown alongside the board at play: every suspect (lettered A, B, C…)
 * followed by the victim (V), each a compact card with its derived label, name,
 * and description. When `onPick` is given the cards are buttons — clicking one
 * picks that persona up as the placement tool (clicking cells then drops the
 * letter into them); clicking the active card again puts it down.
 */
export function PersonaList({
  personas,
  activeId,
  onPick,
  mode = 'guess',
  onModeChange,
}: PersonaListProps): JSX.Element | null {
  const ordered = [...suspectsOf(personas), ...(victimOf(personas) ? [victimOf(personas)!] : [])]
  if (ordered.length === 0) return null

  const activeHint =
    mode === 'answer'
      ? 'Click cells to set the answer · Esc to put down'
      : 'Click cells to add a guess · Esc to put down'

  return (
    <div className="persona-list">
      <h2 className="persona-list-title">People</h2>
      {onPick && onModeChange && (
        <label className="place-mode">
          <span className="place-mode-label">Placing as</span>
          <select
            className="place-mode-select"
            value={mode}
            onChange={(e) => onModeChange(e.target.value as PlaceMode)}
          >
            <option value="guess">Guess</option>
            <option value="answer">Answer</option>
          </select>
        </label>
      )}
      {onPick && (
        <p className="persona-list-hint">
          {activeId ? activeHint : 'Click a person, then click cells to place them.'}
        </p>
      )}
      {ordered.map((persona) => {
        const isVictim = persona.role === 'victim'
        const label = personaLabel(personas, persona)
        const name = persona.name.trim()
        const description = persona.description.trim()
        const isActive = activeId === persona.id
        const cls =
          `persona-card${isVictim ? ' persona-card-victim' : ''}` +
          `${onPick ? ' persona-card-btn' : ''}${isActive ? ' is-active' : ''}`
        const body = (
          <>
            <div className="persona-badge" aria-hidden="true">
              {label}
            </div>
            <div className="persona-read">
              <div className={`persona-read-name${name ? '' : ' is-empty'}`}>
                {name || (isVictim ? 'Unnamed victim' : `Suspect ${label}`)}
              </div>
              {description && <div className="persona-read-desc">{description}</div>}
            </div>
          </>
        )
        if (!onPick) {
          return (
            <div key={persona.id} className={cls}>
              {body}
            </div>
          )
        }
        return (
          <button
            key={persona.id}
            type="button"
            className={cls}
            aria-pressed={isActive}
            onClick={() => onPick(persona.id)}
          >
            {body}
          </button>
        )
      })}
    </div>
  )
}
