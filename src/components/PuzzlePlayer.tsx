import { useLibrary } from '../state/LibraryContext'
import { PlayerBoard } from './PlayerBoard'

interface PuzzlePlayerProps {
  puzzleId: string
  onBack: () => void
  onEdit: () => void
}

export function PuzzlePlayer({ puzzleId, onBack, onEdit }: PuzzlePlayerProps): JSX.Element {
  const { library, cycleCell, noteCell, clearMarks } = useLibrary()

  const puzzle = library.puzzles[puzzleId]
  if (!puzzle) {
    return (
      <div className="view">
        <p>That puzzle no longer exists.</p>
        <button type="button" className="btn" onClick={onBack}>← Back</button>
      </div>
    )
  }

  const hasCells = Object.keys(puzzle.cells).length > 0

  return (
    <div className="view player">
      <div className="view-head">
        <div className="view-head-left">
          <button type="button" className="btn btn-ghost" onClick={onBack}>← Back</button>
          <h1 className="view-title">{puzzle.name}</h1>
        </div>
        <div className="view-head-actions">
          <button type="button" className="btn" onClick={onEdit}>Edit shape</button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              if (confirm('Clear every mark and note on this board?')) clearMarks(puzzle.id)
            }}
          >
            Clear marks
          </button>
        </div>
      </div>

      {hasCells ? (
        <>
          <p className="legend">
            Click a cell to cycle <span className="chip chip-blank">blank</span>
            <span className="chip chip-no">✗</span>
            <span className="chip chip-yes">✓</span>. Right-click a cell to add a note.
          </p>
          <div className="board-scroll">
            <PlayerBoard
              puzzle={puzzle}
              onCycle={(x, y) => cycleCell(puzzle.id, x, y)}
              onNote={(x, y, note) => noteCell(puzzle.id, x, y, note)}
            />
          </div>
        </>
      ) : (
        <div className="empty-state">
          <p>This puzzle has no cells yet.</p>
          <button type="button" className="btn btn-primary" onClick={onEdit}>Define the shape</button>
        </div>
      )}
    </div>
  )
}
