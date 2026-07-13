import { useState } from 'react'
import { useLibrary } from '../state/LibraryContext'
import { buildGridLayout } from '../lib/gridLayout'
import { Grid } from './Grid'

interface PuzzlePlayerProps {
  puzzleId: string
  onBack: () => void
  onEdit: () => void
}

export function PuzzlePlayer({ puzzleId, onBack, onEdit }: PuzzlePlayerProps): JSX.Element {
  const { library, cycleCell, noteCell, clearMarks } = useLibrary()
  const [autoEliminate, setAutoEliminate] = useState(true)

  const puzzle = library.puzzles[puzzleId]
  if (!puzzle) {
    return (
      <div className="view">
        <p>That puzzle no longer exists.</p>
        <button type="button" className="btn" onClick={onBack}>← Back</button>
      </div>
    )
  }

  const layout = buildGridLayout(puzzle.categories)

  return (
    <div className="view player">
      <div className="view-head">
        <div className="view-head-left">
          <button type="button" className="btn btn-ghost" onClick={onBack}>← Back</button>
          <h1 className="view-title">{puzzle.name}</h1>
        </div>
        <div className="view-head-actions">
          <label className="toggle" title="When you confirm a pairing (✓), rule out the rest of its row and column automatically">
            <input
              type="checkbox"
              checked={autoEliminate}
              onChange={(e) => setAutoEliminate(e.target.checked)}
            />
            Auto-✗ row &amp; column
          </label>
          <button type="button" className="btn" onClick={onEdit}>Edit puzzle</button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              if (confirm('Clear every mark and note on this board?')) clearMarks(puzzle.id)
            }}
          >
            Clear board
          </button>
        </div>
      </div>

      {puzzle.flavor && <p className="flavor">{puzzle.flavor}</p>}

      <p className="legend">
        Click a cell to cycle <span className="chip chip-blank">blank</span>
        <span className="chip chip-no">✗</span>
        <span className="chip chip-yes">✓</span>. Right-click a cell to add a note.
      </p>

      {layout ? (
        <div className="grid-scroll">
          <Grid
            puzzle={puzzle}
            layout={layout}
            onCycle={(catA, itemA, catB, itemB, next) =>
              cycleCell(puzzle.id, catA, itemA, catB, itemB, next, autoEliminate)
            }
            onNote={(catA, itemA, catB, itemB, note) =>
              noteCell(puzzle.id, catA, itemA, catB, itemB, note)
            }
          />
        </div>
      ) : (
        <div className="empty-state">
          <p>This puzzle needs at least two categories before it has a grid.</p>
          <button type="button" className="btn btn-primary" onClick={onEdit}>Set up categories</button>
        </div>
      )}
    </div>
  )
}
