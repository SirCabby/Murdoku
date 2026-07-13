import { useRef } from 'react'
import type { Clue, Persona, Puzzle } from '../types/puzzle'
import { personaLabel, suspectsOf, victimOf } from '../lib/personas'

interface PersonasEditorProps {
  puzzle: Puzzle
  /** Append a new suspect; returns it so its name field can grab focus. */
  onAddSuspect: () => Persona
  onSetName: (id: string, name: string) => void
  onSetDescription: (id: string, description: string) => void
  onRemove: (id: string) => void
  /** Append a new room clue; returns it so its text field can grab focus. */
  onAddClue: () => Clue
  onSetClueText: (id: string, text: string) => void
  onRemoveClue: (id: string) => void
}

/**
 * The People tab: the puzzle's cast as three plain sections — the suspects (each a
 * card lettered A, B, C, … by order, add/remove enabled), the single victim
 * (labelled V, permanent), and any extra room clues (green cards that name no one).
 * Unlike the other edit modes there's no board; a cast is independent of the shape,
 * so this renders even before any cells exist. Labels are derived on the fly from
 * the list (see `lib/personas.ts`).
 */
export function PersonasEditor({
  puzzle,
  onAddSuspect,
  onSetName,
  onSetDescription,
  onRemove,
  onAddClue,
  onSetClueText,
  onRemoveClue,
}: PersonasEditorProps): JSX.Element {
  // A freshly added suspect or clue asks its first field to grab focus once, so the
  // author can start typing straight away (mirrors the room-label editor). Ids are
  // globally unique, so one ref serves both the name inputs and the clue textareas.
  const focusId = useRef<string | null>(null)

  const suspects = suspectsOf(puzzle.personas)
  const victim = victimOf(puzzle.personas)
  const clues = puzzle.clues
  const canRemove = suspects.length > 1

  function addSuspect(): void {
    const suspect = onAddSuspect()
    focusId.current = suspect.id
  }

  function addClue(): void {
    const clue = onAddClue()
    focusId.current = clue.id
  }

  function card(persona: Persona): JSX.Element {
    const isVictim = persona.role === 'victim'
    return (
      <div key={persona.id} className={`persona-card${isVictim ? ' persona-card-victim' : ''}`}>
        <div className="persona-badge" aria-hidden="true">
          {personaLabel(puzzle.personas, persona)}
        </div>
        <div className="persona-fields">
          <input
            className="input persona-name"
            value={persona.name}
            placeholder={isVictim ? 'Victim name' : 'Suspect name'}
            aria-label={`${isVictim ? 'Victim' : 'Suspect'} ${personaLabel(puzzle.personas, persona)} name`}
            ref={(el) => {
              if (el && focusId.current === persona.id) {
                el.focus()
                focusId.current = null
              }
            }}
            onChange={(e) => onSetName(persona.id, e.target.value)}
          />
          <textarea
            className="input persona-desc"
            value={persona.description}
            placeholder="Description"
            aria-label={`${isVictim ? 'Victim' : 'Suspect'} ${personaLabel(puzzle.personas, persona)} description`}
            rows={2}
            onChange={(e) => onSetDescription(persona.id, e.target.value)}
          />
        </div>
        {!isVictim && (
          <button
            type="button"
            className="persona-del"
            aria-label={`Remove suspect ${personaLabel(puzzle.personas, persona)}`}
            disabled={!canRemove}
            title={canRemove ? 'Remove suspect' : 'A puzzle needs at least one suspect'}
            onClick={() => onRemove(persona.id)}
          >
            ✕
          </button>
        )}
      </div>
    )
  }

  function clueCard(clue: Clue): JSX.Element {
    return (
      <div key={clue.id} className="persona-card persona-card-clue">
        <div className="persona-badge persona-badge-clue" aria-hidden="true">
          🔍
        </div>
        <div className="persona-fields">
          <textarea
            className="input persona-desc"
            value={clue.text}
            placeholder="Clue text"
            aria-label="Clue text"
            rows={2}
            ref={(el) => {
              if (el && focusId.current === clue.id) {
                el.focus()
                focusId.current = null
              }
            }}
            onChange={(e) => onSetClueText(clue.id, e.target.value)}
          />
        </div>
        <button
          type="button"
          className="persona-del"
          aria-label="Remove clue"
          title="Remove clue"
          onClick={() => onRemoveClue(clue.id)}
        >
          ✕
        </button>
      </div>
    )
  }

  return (
    <div className="personas">
      <div className="persona-group">
        <div className="persona-group-head">
          <h2 className="persona-group-title">Suspects</h2>
          <span className="persona-group-count">
            {suspects.length} suspect{suspects.length === 1 ? '' : 's'}
          </span>
        </div>
        {suspects.map(card)}
        <button type="button" className="btn btn-small persona-add" onClick={addSuspect}>
          + Add suspect
        </button>
      </div>

      <div className="persona-group">
        <div className="persona-group-head">
          <h2 className="persona-group-title">Victim</h2>
        </div>
        {victim && card(victim)}
      </div>

      <div className="persona-group">
        <div className="persona-group-head">
          <h2 className="persona-group-title">Clues</h2>
          <span className="persona-group-count">
            {clues.length} clue{clues.length === 1 ? '' : 's'}
          </span>
        </div>
        <p className="persona-group-note">
          Extra clues tied to a room, not to any person. They show up beside the cast at play, each
          on a green card.
        </p>
        {clues.map(clueCard)}
        <button type="button" className="btn btn-small persona-add" onClick={addClue}>
          + Add clue
        </button>
      </div>
    </div>
  )
}
