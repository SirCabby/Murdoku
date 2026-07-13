import type { Library } from '../types/puzzle'
import { newId } from './id'

// Persistence for the whole library. For now this is localStorage, which keeps
// Murdoku fully functional standalone. When launched from GameStateTracker we
// will additionally sync this blob to the connected save file (see lib/gst.ts);
// that hook is intentionally not wired up yet.

const STORAGE_KEY = 'murdoku.library.v1'

export function emptyLibrary(): Library {
  return { version: 1, folders: [], puzzles: {} }
}

export function loadLibrary(): Library {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedLibrary()
    const parsed = JSON.parse(raw) as Library
    if (parsed && parsed.version === 1 && Array.isArray(parsed.folders)) {
      return parsed
    }
  } catch {
    // Corrupt or unreadable — fall through to a fresh library.
  }
  return seedLibrary()
}

export function saveLibrary(library: Library): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(library))
  } catch {
    // Storage full / unavailable (e.g. private mode). Non-fatal.
  }
}

/**
 * First-run content so the app isn't an empty shell. A single folder with one
 * small example puzzle using neutral placeholder names. Timestamps are fixed so
 * the seed is deterministic.
 */
function seedLibrary(): Library {
  const t = 0
  const mkCat = (name: string, labels: string[]) => ({
    id: newId(),
    name,
    items: labels.map((label) => ({ id: newId(), label })),
  })

  const puzzleId = newId()
  const folderId = newId()

  const library: Library = {
    version: 1,
    folders: [{ id: folderId, name: 'My Cases', puzzleIds: [puzzleId] }],
    puzzles: {
      [puzzleId]: {
        id: puzzleId,
        name: 'The Sample Mystery',
        flavor:
          'A demo puzzle. Click a cell to cycle blank → ✗ → ✓, right-click a cell to add a note. Edit or delete this from the home screen.',
        categories: [
          mkCat('Suspects', ['Captain Slate', 'Dr. Amber', 'Ms. Teal']),
          mkCat('Weapons', ['Candlestick', 'Rope', 'Wrench']),
          mkCat('Locations', ['Library', 'Cellar', 'Balcony']),
        ],
        cells: {},
        createdAt: t,
        updatedAt: t,
      },
    },
  }
  return library
}
