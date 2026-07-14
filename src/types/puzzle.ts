// Core domain model for Murdoku.
//
// A puzzle is a *shape*: a set of cells placed on an integer lattice. The shape
// need not be a rectangle — it can have bulges, notches, or holes. Each existing
// cell also carries play state (a mark). Rows and columns are not
// labelled yet; the puzzle is, for now, purely the arrangement of cells.
//
// Cells are keyed by their coordinate string `"x,y"` (see `lib/coords.ts`). A
// key being present in `Puzzle.cells` is exactly what it means for that cell to
// exist in the shape.

/** A single cell's play state. `blank` = undecided. */
export type Mark = 'blank' | 'no' | 'yes'

export interface CellState {
  mark: Mark
}

/**
 * Every furnishing that can be placed in a puzzle. All but one sit *inside* a
 * square; a `window` is special — it lives on a wall (an edge between squares,
 * or the outer perimeter), never inside a square.
 */
export type ObjectKind =
  | 'chair'
  | 'carpet'
  | 'bed'
  | 'window'
  | 'door'
  | 'table'
  | 'tv'
  | 'plant'
  | 'shelf'
  | 'box'
  | 'register'
  | 'boulder'
  | 'rubble'
  | 'present'
  | 'statue'
  | 'locker'
  | 'punchingbag'
  | 'gaspump'
  | 'catapult'
  | 'vase'
  | 'weaponsrack'
  | 'crate'
  | 'barrel'
  | 'lion'
  | 'bush'
  | 'pumpkin'
  | 'trashcan'
  | 'cow'
  | 'pig'
  | 'tree'
  | 'horse'
  | 'mud'
  | 'oilslick'
  | 'car'
  | 'towel'

/**
 * The kinds that occupy a square — every object except the wall-bound ones. A
 * `window` and a `door` both mount on an edge (a wall), not inside a square.
 */
export type CellObjectKind = Exclude<ObjectKind, 'window' | 'door'>

/**
 * A movable room-name label that floats over the board. Its position is a
 * lattice point (`x`, `y`) in cell units measured from the shape's origin — the
 * label's *bottom-centre* sits at that point, so a label whose `y` is a wall
 * gridline rests just inside the room above it, covering that wall's upper half.
 * `x` runs 0…(width) across columns (a value like `2.5` is a column centre, `2`
 * a gridline). Positions are stored explicitly (never derived from walls), so a
 * name stays put across shape and wall edits; the editor seeds a new label on
 * the bottom wall of the room it's dropped in, then lets the user drag it
 * anywhere along the walls.
 */
export interface RoomLabel {
  id: string
  /** The room name shown on the label. Empty string while first being typed. */
  text: string
  /** Lattice x of the label's centre (cell units from the origin; may be fractional). */
  x: number
  /** Lattice y of the label's centre (cell units from the origin; may be fractional). */
  y: number
}

/**
 * An authored hint: one numbered clue the puzzle offers. Hints display in order,
 * numbered 1, 2, 3, … by their position in `Puzzle.hints` — the number is derived
 * at render, never stored, the same way persona letters are. Only `id` is stable,
 * so removing a hint renumbers the survivors without disturbing which text belongs
 * to which one.
 */
export interface Hint {
  id: string
  /** The hint's text. Empty string until the author fills it in. */
  text: string
}

/**
 * An extra clue tied to a room rather than to any cast member — a stray fact the
 * puzzle offers ("a muddy footprint by the door") that names no persona. Clues are
 * authoring content shown to the player alongside the cast, set apart from the
 * suspects and victim by a green card. Like a hint it's just a piece of text; only
 * `id` is stable, so removing one never disturbs the others.
 */
export interface Clue {
  id: string
  /** The clue's text. Empty string until the author fills it in. */
  text: string
}

/** A persona is either one of the puzzle's suspects or its single victim. */
export type PersonaRole = 'suspect' | 'victim'

/**
 * A character in the puzzle: a suspect or the victim. A puzzle always has one or
 * more suspects and exactly one victim.
 *
 * Display labels are *derived*, never stored: the victim is always `V`, and the
 * suspects are lettered `A`, `B`, `C`, … by their order among the suspects (see
 * `lib/personas.ts`). Only the identity (`id`) is stable — relettering a suspect
 * after a deletion doesn't disturb the others' ids, matching how item ids stay
 * put across relabels elsewhere in the app.
 */
export interface Persona {
  id: string
  role: PersonaRole
  /** The character's name. Empty string until the author fills it in. */
  name: string
  /** Free-text description / backstory. Empty string = none. */
  description: string
}

export interface Puzzle {
  id: string
  name: string
  /**
   * The grid shape *and* its play state. Keyed by `"x,y"`. A present key means
   * the cell exists; its value holds the mark. Absent = no cell there.
   */
  cells: Record<string, CellState>
  /**
   * Thick borders between adjacent cells that fence off rooms. Keyed by a
   * canonical edge string (`"x,y,v"` / `"x,y,h"`, see `lib/walls.ts`); a present
   * key means a wall sits on that edge. Only interior edges (both cells exist)
   * are ever stored — removing a cell prunes any wall touching it.
   */
  walls: Record<string, true>
  /**
   * Furnishings placed inside squares — at most one per square. Keyed by `"x,y"`
   * (always an existing cell); removing a cell prunes its object. A carpet is not
   * stored here — it's a floor underlay in its own `carpets` map, so an object can
   * sit *on top of* a carpet in the same square.
   */
  objects: Record<string, CellObjectKind>
  /**
   * Carpets — the one floor-covering furnishing, kept in its own boolean layer
   * (keyed by `"x,y"`, presence means a rug covers that square) rather than in
   * `objects`, so a carpet and an object can share a square: the object is drawn
   * on top of the rug. Carpets autotile among themselves like tables do (walls
   * fence separate rugs apart). Removing a cell prunes its carpet.
   */
  carpets: Record<string, true>
  /**
   * Windows, which sit on walls rather than in squares. Keyed by an edge string
   * in the walls key format (`lib/walls.ts`). An edge qualifies as a window
   * mount when it is a perimeter edge (one cell exists) or an interior edge that
   * carries a wall; a window is pruned once its edge stops qualifying.
   */
  windows: Record<string, true>
  /**
   * Doors, which — like windows — sit on a wall rather than in a square, keyed by
   * an edge string in the walls key format (`lib/walls.ts`). Unlike a window, a
   * door mounts only on an *interior* wall: an edge whose two cells both exist and
   * that carries a wall (doors connect two rooms, so they never sit on the outer
   * perimeter). A door is pruned once its edge stops being a walled interior edge.
   */
  doors: Record<string, true>
  /**
   * Movable room-name labels floating over the board. Positioned in lattice
   * space (see `RoomLabel`) rather than tied to a single cell, so a name
   * survives shape and wall edits and can be slid freely along the walls.
   */
  labels: RoomLabel[]
  /**
   * The author's hints: an ordered list of clues, numbered 1, 2, 3, … by their
   * position (see `Hint`). Authoring content, independent of the shape and cast;
   * the author writes them in the editor's Hints tab.
   */
  hints: Hint[]
  /**
   * The puzzle's cast: one or more suspects plus exactly one victim. Order among
   * the suspects sets their derived letters (see `Persona`); the array as a whole
   * has no spatial meaning, unlike the maps above.
   */
  personas: Persona[]
  /**
   * Extra room-bound clues that name no cast member (see `Clue`). Authoring
   * content like `hints`, but surfaced in the play-mode cast panel — below the
   * victim, on green cards — rather than in the hint dispenser. Independent of the
   * shape and the cast; the author writes them in the editor's People tab.
   */
  clues: Clue[]
  /**
   * The player's placement guesses: which personas they think occupy each cell.
   * Keyed by `"x,y"` (always an existing cell) to an array of persona ids; a cell
   * can hold several guesses at once, so the value is a list rather than a single
   * id. The ids point into `personas` — the letters shown in a cell are derived
   * from them (see `lib/personas.ts`), never stored. Removing a cell drops its
   * entry, and removing a persona strips its id from every cell.
   */
  guesses: Record<string, string[]>
  /**
   * The player's definitive answers: the one persona they've committed to for a
   * cell. Keyed by `"x,y"` (always an existing cell) to a single persona id —
   * unlike `guesses`, at most one per cell, mirroring `objects`. An answer and a
   * guess are mutually exclusive in a cell: committing an answer clears that
   * cell's guesses, and adding a guess clears its answer. The letter shown is
   * derived from the id (see `lib/personas.ts`), never stored. Removing a cell
   * drops its entry, and removing a persona clears any answer naming it.
   */
  answers: Record<string, string>
  /**
   * The player's crossed-out cells: rooms they've ruled out entirely (a big grey
   * "X"). Keyed by `"x,y"` (always an existing cell); a present key means an X
   * sits there. Persona-independent — unlike guesses/answers it names no cast
   * member. An X is mutually exclusive with a cell's guesses and answer: marking
   * an X clears both, and placing a guess or answer clears the X. Removing a cell
   * drops its entry.
   */
  crosses: Record<string, true>
  /**
   * The author's answer key: the definitive placement of the cast, one persona
   * per cell. Keyed by `"x,y"` (always an existing, placeable cell) to a single
   * persona id — the same shape as `answers`, but *authoring* content rather than
   * play state. Its invariants are stricter than the player's board: each persona
   * appears at most once across the whole key, and at most one persona sits in any
   * row or column (see `lib/solution.ts`). Every other placeable cell — one with
   * no persona and no blocking object — is implicitly ruled out (a big "X" derived
   * at render, never stored). The victim is placed here too. Kept apart from the
   * player's `answers`/`crosses` so revealing or checking the solution never
   * disturbs a solve in progress. Removing a cell drops its entry, and removing a
   * persona clears any placement naming it.
   */
  solution: Record<string, string>
  /**
   * The author's answer key for the accusation: the id of the suspect who is
   * actually the murderer, or `null` while the author hasn't decided. Always a
   * *suspect* — the victim is never a valid choice. This is the authoritative
   * answer the player's `murderer` accusation is checked against, kept apart from
   * it just as `solution` is kept apart from the play `answers`. Removing that
   * suspect from the cast clears it back to `null`.
   */
  solutionMurderer: string | null
  /**
   * The player's final accusation: the id of the suspect they've concluded is
   * the murderer, or `null` while undecided. Always a *suspect* — the victim is
   * never a valid choice — and only one at a time. Unlike the per-cell play maps
   * above this names the whole solve's answer, so it sits below the board rather
   * than in a cell. Removing the accused suspect from the cast clears it back to
   * `null`.
   */
  murderer: string | null
  /**
   * Whether the player has ever validated a fully-correct solve of this puzzle —
   * every persona placed in the cell the answer key assigns them and the right
   * suspect accused (see `lib/validate.ts`). Set true by the play-mode Validate
   * button and thereafter sticky: a completion badge, not live play state, so it
   * survives resetting the board and drives the green check shown before the
   * puzzle's name in play mode and on the home page. The author never sets it;
   * new and migrated puzzles start `false`.
   */
  solved: boolean
  createdAt: number
  updatedAt: number
}

export interface Folder {
  id: string
  name: string
  /** Puzzle ids in display order. */
  puzzleIds: string[]
}

/** The entire persisted library — one blob in localStorage / a save file. */
export interface Library {
  version: 18
  folders: Folder[]
  puzzles: Record<string, Puzzle>
}
