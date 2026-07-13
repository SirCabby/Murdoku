# Murdoku

A static web app for playing — and building — Murdle-style **murder-mystery logic
puzzles**. Each case is a floor plan (rooms, walls, windows and furniture) with a
cast of suspects and one victim. Deduce where everyone was, then unmask the
murderer, one clue at a time.

### ▶ [Play it now](https://sircabby.github.io/Murdoku/)

A sample case ships with the app to get you started. Your own puzzles autosave in
the browser (`localStorage`), and you can also **save them to a file you choose**
(see [Saving your library](#saving-your-library)).

## How to play

Open a case from the home screen (a **Sample Shape** puzzle is included). The
board is a floor plan; the cast is listed down the side as lettered **suspects**
(A, B, C…) plus the **victim** (V). Each person was in exactly one place — their
own row and column of the board — and your job is to place everyone, then name
the killer.

1. **Read the hints.** The panel beside the board holds the clues you reason from.
2. **Pick someone up, then click a cell to place them.** Click a suspect (or the
   victim) in the side list; the mode dropdown decides how a click lands:
   - **Guess** — a tentative mark; drawn as a small letter, and a cell can hold
     several. Click the same cell again to remove it.
   - **Answer** — your committed placement; fills the cell with one big letter.
   - Hold **Shift** to momentarily flip between the two; press **Esc** to put the
     person back down.
3. **Rule cells out.** Pick up the **✗ tool** and click a cell to cross it off.
   Furniture (a table, a bed…) fills its square, so nobody can stand there.
4. **Let it tidy up (optional).** With **Clean up: Automatic**, committing an
   answer automatically crosses out the rest of that person's row and column.
5. **Name the murderer.** Choose a suspect from **“The murderer is…”** below the
   board.
6. **Check yourself.** **Validate** grades the whole solve — get it right and a
   sticky green ✓ appears by the puzzle's name. Stuck? **Show errors** reddens the
   committed answers that don't match, and **Show answer key** reveals the
   author's solution.

Handy extras: **Undo / Redo** (Ctrl+Z / Ctrl+Y), **Reset board**, **Summaries**
(lists who's in each row and column around the edges), and **Highlight** (the
picked-up person's existing marks glow orange).

## Build your own puzzle

Press **Edit puzzle** (or add a new one from the home screen) to author a case:
lay out the floor plan and interior **walls**, drop in **furniture**, **windows**
and **room names**, define the **cast**, write the **hints**, and set the
**solution** the validator grades against.

## Saving your library

Your whole library (folders → puzzles → boards → cast → hints → solutions) is one
JSON blob. It autosaves to the browser's `localStorage` on every edit, so nothing
is lost on a refresh. But `localStorage` is tied to one browser on one origin, and
clearing site data wipes it. To keep a durable, portable copy you control, use the
bar at the top:

- **Save to file…** — pick a location and start auto-saving there. Every edit is
  written back to that `.murdoku` file (it's plain JSON). The file you picked is
  remembered across sessions; after a reload, click **Reconnect** once to let the
  browser re-grant write access (a security requirement), then auto-saving
  resumes.
- **Open file…** — load a `.murdoku` file, replacing the current library, and
  keep saving to it.

Choosing a location needs the **File System Access API** (Chrome, Edge, and other
Chromium browsers). On Firefox/Safari the bar falls back to **Download file** /
**Import file…** instead.

`.murdoku` files are your own puzzle data and are git-ignored — they're never
committed even if you save one inside this repo.

## Development

Static React + TypeScript + Vite app. No backend — the whole library is a single
JSON blob in `localStorage` (optionally mirrored to a `.murdoku` file).

```bash
npm install
npm run dev        # dev server with hot reload
npm run build      # type-check + emit static site to dist/
npm run preview    # serve the built dist/ locally
npm run typecheck  # tsc --noEmit only
```

Pushing to `main` builds and publishes `dist/` to GitHub Pages via
`.github/workflows/deploy.yml`.

```
src/
  types/puzzle.ts            Domain model: Library, Folder, Puzzle, Persona, and the
                             board maps (cells, walls, objects, labels, hints,
                             guesses, answers, crosses, solution)
  lib/                       Pure, side-effect-free logic (independently testable):
    board.ts, coords.ts        the cell lattice + coordinate / pair-key helpers
    walls.ts, rooms.ts         wall edges and wall-based room flood fill
    objects.ts, objectAssets.ts  furniture / window placement + vendored icons
    personas.ts                suspects + victim, derived A / B / C / V labels
    guesses.ts, answers.ts, crosses.ts   the player's per-cell marks
    solution.ts, validate.ts   the author's answer key + grading a solve
    storage.ts, fileStore.ts, handleDb.ts   localStorage + File System Access saves
    history.ts, prefs.ts, id.ts   undo history, view prefs, id generation
  state/                     React stores: LibraryContext, file sync, play history
  components/
    HomeView.tsx             folder / puzzle browser
    PuzzleEditor.tsx + *Board/Editor   author the board, cast, hints, solution
    PuzzlePlayer.tsx + PlayerBoard, PersonaList, HintsPanel   play a case
    Cell.tsx, BoardDecor.tsx, FileBar.tsx   a square, its decor, the save bar
```
