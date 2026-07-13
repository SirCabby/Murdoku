// Lightweight, un-versioned UI preferences. Unlike the library (see
// `lib/storage.ts`), these are view toggles — not puzzle content — so they live
// under their own localStorage keys and never travel with a save file or a
// GameStateTracker sync. Reads/writes are wrapped like the library's, so a
// storage-less environment (private mode) just falls back to the default.

const SUMMARIES_KEY = 'murdoku.ui.summaries'
const CLEANUP_KEY = 'murdoku.ui.cleanup'

/** Whether the play view shows its per-column / per-row summaries. Defaults off. */
export function loadShowSummaries(): boolean {
  try {
    return localStorage.getItem(SUMMARIES_KEY) === '1'
  } catch {
    return false
  }
}

export function saveShowSummaries(on: boolean): void {
  try {
    localStorage.setItem(SUMMARIES_KEY, on ? '1' : '0')
  } catch {
    // Storage full / unavailable (e.g. private mode). Non-fatal.
  }
}

/**
 * Whether committing an answer auto-cleans the board — crossing out the rest of
 * that cell's row and column and dropping the persona's guesses elsewhere. The
 * "Manual" (off) setting is the plain behaviour; "Automatic" (on) is the tidy-up.
 * A view preference like the summaries switch, so it lives under its own key and
 * never travels with a save file. Defaults off (manual).
 */
export function loadAutoCleanup(): boolean {
  try {
    return localStorage.getItem(CLEANUP_KEY) === '1'
  } catch {
    return false
  }
}

export function saveAutoCleanup(on: boolean): void {
  try {
    localStorage.setItem(CLEANUP_KEY, on ? '1' : '0')
  } catch {
    // Storage full / unavailable (e.g. private mode). Non-fatal.
  }
}
