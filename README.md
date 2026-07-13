# Murdoku

A static web app for playing Murdle-style logic-grid deduction puzzles. Set up a
grid, drop your guesses into the boxes (✓ / ✗ / notes), and revise as you deduce
— no eraser required.

### ▶ [Play it now](https://sircabby.github.io/Murdoku/)

Your library autosaves in your browser (`localStorage`), and you can also **save
it to a file you choose** (see [Saving your library](#saving-your-library)).

## How to play

1. **Home** — folders hold puzzles. Create a folder, add a puzzle.
2. **Edit** — define the puzzle's categories (e.g. Suspects, Weapons,
   Locations) and the items in each. Logic grids normally use the same number of
   items in every category.
3. **Play** — the categories are laid out as the classic staircase grid where
   every pair of categories meets in a block of cells:
   - **Left-click** a cell to cycle it: blank → ✗ (ruled out) → ✓ (confirmed).
   - **Right-click** a cell to attach a scratch note.
   - **Auto-✗ row & column** (on by default): confirming a pairing with ✓
     automatically rules out the rest of that pairing's row and column.

## Saving your library

Your whole library (folders → puzzles → cells → walls → objects → room names) is one JSON blob. It
autosaves to the browser's `localStorage` on every edit, so nothing is lost on a
refresh. But `localStorage` is tied to one browser on one origin, and clearing
site data wipes it. To keep a durable, portable copy you control, use the bar at
the top:

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

Static React + TypeScript + Vite app. No backend — the whole library is a
single JSON blob.

```bash
npm install
npm run dev        # dev server with hot reload
npm run build      # type-check + emit static site to dist/
npm run preview    # serve the built dist/ locally
npm run typecheck  # tsc --noEmit only
```

```
src/
  types/puzzle.ts        Domain model: Library, Folder, Puzzle, Category, Item, CellState
  lib/
    gridLayout.ts        The staircase layout algorithm (pairs → blocks)
    marks.ts             Applying marks + the auto-eliminate rule (pure)
    cells.ts             Canonical pair keys + mark cycling
    storage.ts           localStorage persistence + first-run seed
    id.ts                Id generation
  state/LibraryContext.tsx   React store; every mutation persists
  components/
    HomeView.tsx         Folder / puzzle browser
    PuzzleEditor.tsx     Define categories & items
    PuzzlePlayer.tsx     Controls + grid
    Grid.tsx             Renders the staircase
    Cell.tsx             One square (mark + note popover)
```

The layout rule: for `C` categories, column groups are `categories[1..C-1]`
and row groups are `[categories[0], categories[C-1], categories[C-2], …]`; a
block exists at `(r, c)` iff `r + c ≤ C-2`. That produces the triangular grid
where the last category appears twice so every unordered pair shows once.

## Roadmap (next steps)

- Full transitive constraint propagation (cross-category deductions), not just
  per-block row/column elimination.
- Compact the header labels / optional zoom for large grids.
- Import/export a puzzle definition.
