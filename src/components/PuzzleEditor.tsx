import { useState } from 'react'
import { useLibrary } from '../state/LibraryContext'
import { EditorBoard } from './EditorBoard'

interface PuzzleEditorProps {
  puzzleId: string
  onDone: () => void
}

/**
 * Defines a puzzle's shape. Edits apply live to the library — there is no draft
 * to commit. The "fill rectangle" control is a quick starting point; from there
 * the player paints bulges and notches directly on the board.
 */
export function PuzzleEditor({ puzzleId, onDone }: PuzzleEditorProps): JSX.Element {
  const { library, updatePuzzle, setCellExists, setRectangle, clearShape } = useLibrary()
  const puzzle = library.puzzles[puzzleId]

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

  return (
    <div className="view editor">
      <div className="view-head">
        <div className="view-head-left">
          <button type="button" className="btn btn-ghost" onClick={onDone}>← Back</button>
          <h1 className="view-title">Edit shape</h1>
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
    </div>
  )
}

function clampDim(value: string): number {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return 1
  return Math.max(1, Math.min(30, n))
}
