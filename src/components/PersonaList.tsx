import type { Persona } from '../types/puzzle'
import { personaLabel, suspectsOf, victimOf } from '../lib/personas'

interface PersonaListProps {
  personas: Persona[]
}

/**
 * Read-only cast shown alongside the board at play: every suspect (lettered A,
 * B, C…) followed by the victim (V), each a compact card with its derived label,
 * name, and description. Laid out as a 2-column grid; the caller positions the
 * whole panel to the left of the puzzle.
 */
export function PersonaList({ personas }: PersonaListProps): JSX.Element | null {
  const ordered = [...suspectsOf(personas), ...(victimOf(personas) ? [victimOf(personas)!] : [])]
  if (ordered.length === 0) return null

  return (
    <div className="persona-list">
      <h2 className="persona-list-title">People</h2>
      {ordered.map((persona) => {
        const isVictim = persona.role === 'victim'
        const label = personaLabel(personas, persona)
        const name = persona.name.trim()
        const description = persona.description.trim()
        return (
          <div key={persona.id} className={`persona-card${isVictim ? ' persona-card-victim' : ''}`}>
            <div className="persona-badge" aria-hidden="true">
              {label}
            </div>
            <div className="persona-read">
              <div className={`persona-read-name${name ? '' : ' is-empty'}`}>
                {name || (isVictim ? 'Unnamed victim' : `Suspect ${label}`)}
              </div>
              {description && <div className="persona-read-desc">{description}</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
