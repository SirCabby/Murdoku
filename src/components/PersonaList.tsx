import type { Persona } from '../types/puzzle'
import { personaLabel, suspectsOf, victimOf } from '../lib/personas'

interface PersonaListProps {
  personas: Persona[]
  /** The persona currently picked up as the placement tool, if any. */
  activeId?: string | null
  /** Pick up a persona (or, when it's already active, drop it) as the placement tool. */
  onPick?: ((id: string) => void) | undefined
}

/**
 * The cast shown alongside the board at play: every suspect (lettered A, B, C…)
 * followed by the victim (V), each a compact card with its derived label, name,
 * and description. When `onPick` is given the cards are buttons — clicking one
 * picks that persona up as the placement tool (clicking cells then drops the
 * letter into them); clicking the active card again puts it down.
 */
export function PersonaList({ personas, activeId, onPick }: PersonaListProps): JSX.Element | null {
  const ordered = [...suspectsOf(personas), ...(victimOf(personas) ? [victimOf(personas)!] : [])]
  if (ordered.length === 0) return null

  return (
    <div className="persona-list">
      <h2 className="persona-list-title">People</h2>
      {onPick && (
        <p className="persona-list-hint">
          {activeId
            ? 'Click cells to place · Esc to put down'
            : 'Click a person, then click cells to place them.'}
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
