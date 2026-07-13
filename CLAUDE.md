# CLAUDE.md

Directives for AI agents and humans working in **Murdoku** — a static React +
TypeScript + Vite companion site for GameStateTracker (Murdle-style logic-grid
puzzles). Read it every session.

## What this is

- A **static site**: `npm run build` emits `dist/`, which works standalone AND
  dropped into `GameStateTracker/companion-sites/`. There is **no backend**.
- The entire library (folders → puzzles → cells) is one JSON blob persisted to
  `localStorage` (`src/lib/storage.ts`). Save-file sync with GameStateTracker is
  planned but not yet wired.

## Conventions (mirrors GameStateTracker)

- **TypeScript everywhere.** New files are `.ts` / `.tsx`. Strict mode plus the
  AI-stricts are on in `tsconfig.json` (`noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, etc.) — that's the source of truth, don't
  duplicate the list here.
- **`import type { … }` for type-only imports** (`verbatimModuleSyntax` is on).
- **Explicit return types on exported functions.** Named, exported types for
  shared shapes live in `src/types/`.
- **No backwards-compat shims.** Single-user local tool; prefer the clean
  redesign over bridging old shapes. If a change invalidates a user's saved
  library, say so and offer a migration.

## Rules specific to this repo

- **Keep `base: './'` in `vite.config.ts`.** The site is served from a sub-path
  (`/companion-sites/<id>/`) inside GameStateTracker; absolute asset paths 404
  there.
- **Pure logic stays pure.** `lib/gridLayout.ts`, `lib/marks.ts`, `lib/cells.ts`
  are side-effect-free and independently testable — keep React out of them.
- **The grid layout contract:** for `C` categories, block `(r, c)` exists iff
  `r + c ≤ C-2`; column groups are `categories[1..C-1]`, row groups are
  `[categories[0], categories[C-1], … categories[2]]`. Don't "simplify" this
  without re-deriving that every unordered category pair appears exactly once.
- **Pair keys are canonical** (`lib/cells.ts` `cellKey`) — order-independent.
  Always go through it; never hand-build a `"catId:itemId|…"` string.
- **Item ids are stable across relabels.** The editor preserves ids so existing
  marks survive renaming an item. Don't regenerate ids on edit.
- After changing the GameStateTracker URL-param contract (`src/lib/gst.ts`),
  update the template documented in `README.md`.

## Verify before reporting done

- `npm run typecheck` must pass (strict).
- `npm run build` must succeed.
- When practical, `npm run dev` and click through home → edit → play.
