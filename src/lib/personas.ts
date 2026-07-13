import type { Persona } from '../types/puzzle'
import { newId } from './id'

// Pure helpers for a puzzle's cast. Personas are just a list on the puzzle; this
// module owns the two rules that govern it — the derived display labels and the
// default cast — and stays free of React so it can be tested on its own.

/** The victim's label is fixed; only suspects are lettered. */
export const VICTIM_LABEL = 'V'

/** The suspects, in the order that sets their letters. */
export function suspectsOf(personas: Persona[]): Persona[] {
  return personas.filter((p) => p.role === 'suspect')
}

/** The single victim, if one is present. */
export function victimOf(personas: Persona[]): Persona | undefined {
  return personas.find((p) => p.role === 'victim')
}

/**
 * The spreadsheet-style letter for a zero-based index: 0→`A`, 25→`Z`, 26→`AA`.
 * A puzzle will never have anywhere near 26 suspects, but the wrap keeps the
 * label total and collision-free regardless.
 */
export function letterLabel(index: number): string {
  let n = Math.max(0, Math.trunc(index))
  let label = ''
  do {
    label = String.fromCharCode(65 + (n % 26)) + label
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return label
}

/**
 * The derived label for one persona within its cast: `V` for the victim, or the
 * suspect's letter by its position among the suspects. Labels are never stored,
 * so deleting a suspect simply re-letters those after it.
 */
export function personaLabel(personas: Persona[], persona: Persona): string {
  if (persona.role === 'victim') return VICTIM_LABEL
  const index = suspectsOf(personas).findIndex((p) => p.id === persona.id)
  return letterLabel(index < 0 ? 0 : index)
}

/** A fresh, unnamed suspect. */
export function newSuspect(): Persona {
  return { id: newId(), role: 'suspect', name: '', description: '' }
}

/** A fresh, unnamed victim. */
export function newVictim(): Persona {
  return { id: newId(), role: 'victim', name: '', description: '' }
}

/**
 * The starting cast for a new (or migrated) puzzle: one suspect `A` and the
 * victim `V`, matching the "always one or more suspects, always one victim"
 * rule.
 */
export function defaultPersonas(): Persona[] {
  return [newSuspect(), newVictim()]
}
