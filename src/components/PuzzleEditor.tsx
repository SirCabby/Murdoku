import { useState } from 'react'
import { useLibrary } from '../state/LibraryContext'
import { EditorBoard } from './EditorBoard'
import { WallsBoard } from './WallsBoard'

interface PuzzleEditorProps {
  puzzleId: string
  onDone: () => void
}

type EditMode = 'shape' | 'walls'

/**
 * Defines a puzzle's shape and its room walls. Edits apply live to the library —
 * there is no draft to commit. "Shape" mode paints which cells exist; "Walls"
 * mode toggles thick borders on the edges between cells to fence off rooms.
 */
export function PuzzleEditor({ puzzleId, onDone }: PuzzleEditorProps): JSX.Element {
  const { library, updatePuzzle, setCellExists, setRectangle, clearShape, setWall, clearWalls } =
    useLibrary()
  const puzzle = library.puzzles[puzzleId]

  const [mode, setMode] = useState<EditMode>('shape')
  const [rectW, setRectW] = useState(4)
  const [rectH, setRectH] = useState(4)

  if (!puzzle) {
    return (
      <div className="view">
        <p>That puzzle no longer exists.</p>
        <button type="button" className="btn" onClick={onDone}>← Back</button>
      </div>
    )
  }

  const cellCount = Object.keys(puzzle.cells).length
  const wallCount = Object.keys(puzzle.walls).length

  return (
    <div className="view editor">
      <div className="view-head">
        <div className="view-head-left">
          <button type="button" className="btn btn-ghost" onClick={onDone}>← Back</button>
          <h1 className="view-title">Edit puzzle</h1>
        </div>
        <div className="view-head-actions">
          <button type="button" className="btn btn-primary" onClick={onDone}>Done</button>
        </div>
      </div>

      <label className="field">
        <span className="field-label">Name</span>
        <input
          className="input"
          value={puzzle.name}
          onChange={(e) => updatePuzzle(puzzleId, { name: e.target.value })}
        />
      </label>

      <div className="segmented" role="tablist" aria-label="Edit mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'shape'}
          className={`seg${mode === 'shape' ? ' active' : ''}`}
          onClick={() => setMode('shape')}
        >
          Shape
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'walls'}
          className={`seg${mode === 'walls' ? ' active' : ''}`}
          onClick={() => setMode('walls')}
        >
          Walls
        </button>
      </div>

      {mode === 'shape' ? (
        <>
          <div className="toolbar">
            <span className="toolbar-label">Fill rectangle</span>
            <input
              className="input num"
              type="number"
              min={1}
              max={30}
              value={rectW}
              onChange={(e) => setRectW(clampDim(e.target.value))}
              aria-label="Rectangle width"
            />
            <span className="times">×</span>
            <input
              className="input num"
              type="number"
              min={1}
              max={30}
              value={rectH}
              onChange={(e) => setRectH(clampDim(e.target.value))}
              aria-label="Rectangle height"
            />
            <button type="button" className="btn btn-small" onClick={() => setRectangle(puzzleId, rectW, rectH)}>
              Apply
            </button>
            <button
              type="button"
              className="btn btn-small btn-ghost"
              onClick={() => {
                if (cellCount === 0 || confirm('Remove every cell from this shape?')) clearShape(puzzleId)
              }}
            >
              Clear
            </button>
            <span className="toolbar-count">{cellCount} cells</span>
          </div>

          <p className="hint">
            Click or drag empty squares to add cells; click a filled cell to remove it. Add cells past
            the edge to make bulges — the board grows as you go.
          </p>

          <div className="board-scroll">
            <EditorBoard
              puzzle={puzzle}
              onSetCell={(x, y, exists) => setCellExists(puzzleId, x, y, exists)}
            />
          </div>
        </>
      ) : (
        <>
          <div className="toolbar">
            <span className="toolbar-label">Room walls</span>
            <button
              type="button"
              className="btn btn-small btn-ghost"
              disabled={wallCount === 0}
              onClick={() => {
                if (wallCount === 0 || confirm('Remove every wall from this puzzle?')) clearWalls(puzzleId)
              }}
            >
              Clear walls
            </button>
            <span className="toolbar-count">{wallCount} walls</span>
          </div>

          <p className="hint">
            Click the line between two cells to raise a wall; click it again to remove it. Press and
            drag along the gridlines to paint a run of walls.
          </p>

          {cellCount > 0 ? (
            <div className="board-scroll">
              <WallsBoard
                puzzle={puzzle}
                onSetWall={(key, on) => setWall(puzzleId, key, on)}
              />
            </div>
          ) : (
            <p className="empty-state">Add some cells in Shape mode first, then come back to wall them off.</p>
          )}
        </>
      )}
    </div>
  )
}

function clampDim(value: string): number {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return 1
  return Math.max(1, Math.min(30, n))
}
