import { useState } from 'react'
import { useLibrary } from '../state/LibraryContext'
import { CELL_OBJECT_KINDS, OBJECT_LABEL } from '../lib/objects'
import { baseIconUrl } from '../lib/objectAssets'
import { EditorBoard } from './EditorBoard'
import { WallsBoard } from './WallsBoard'
import { ObjectsBoard } from './ObjectsBoard'
import type { ObjectTool } from './ObjectsBoard'
import { RoomsBoard } from './RoomsBoard'
import { PersonasEditor } from './PersonasEditor'
import { SolutionEditor } from './SolutionEditor'

interface PuzzleEditorProps {
  puzzleId: string
  onDone: () => void
}

type EditMode = 'shape' | 'walls' | 'objects' | 'rooms' | 'people' | 'solution'

/**
 * Defines a puzzle's shape and its room walls. Edits apply live to the library —
 * there is no draft to commit. "Shape" mode paints which cells exist; "Walls"
 * mode toggles thick borders on the edges between cells to fence off rooms.
 */
export function PuzzleEditor({ puzzleId, onDone }: PuzzleEditorProps): JSX.Element {
  const {
    library,
    updatePuzzle,
    setCellExists,
    setRectangle,
    clearShape,
    setWall,
    clearWalls,
    setObject,
    setWindow,
    clearObjects,
    addLabel,
    moveLabel,
    setLabelText,
    removeLabel,
    clearLabels,
    addSuspect,
    setPersonaName,
    setPersonaDescription,
    removePersona,
    setSolution,
    clearSolution,
  } = useLibrary()
  const puzzle = library.puzzles[puzzleId]

  const [mode, setMode] = useState<EditMode>('shape')
  const [rectW, setRectW] = useState(4)
  const [rectH, setRectH] = useState(4)
  const [tool, setTool] = useState<ObjectTool>('chair')

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
  const objectCount = Object.keys(puzzle.objects).length
  const windowCount = Object.keys(puzzle.windows).length
  const labelCount = puzzle.labels.length
  const solutionCount = Object.keys(puzzle.solution).length
  const personaCount = puzzle.personas.length

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
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'objects'}
          className={`seg${mode === 'objects' ? ' active' : ''}`}
          onClick={() => setMode('objects')}
        >
          Objects
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'rooms'}
          className={`seg${mode === 'rooms' ? ' active' : ''}`}
          onClick={() => setMode('rooms')}
        >
          Rooms
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'people'}
          className={`seg${mode === 'people' ? ' active' : ''}`}
          onClick={() => setMode('people')}
        >
          People
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'solution'}
          className={`seg${mode === 'solution' ? ' active' : ''}`}
          onClick={() => setMode('solution')}
        >
          Answer key
        </button>
      </div>

      {mode === 'shape' && (
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
      )}

      {mode === 'walls' && (
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

      {mode === 'objects' && (
        <>
          <div className="toolbar">
            <span className="toolbar-label">Objects</span>
            <button
              type="button"
              className="btn btn-small btn-ghost"
              disabled={objectCount + windowCount === 0}
              onClick={() => {
                if (
                  objectCount + windowCount === 0 ||
                  confirm('Remove every object and window from this puzzle?')
                )
                  clearObjects(puzzleId)
              }}
            >
              Clear
            </button>
            <span className="toolbar-count">
              {objectCount} object{objectCount === 1 ? '' : 's'} · {windowCount} window
              {windowCount === 1 ? '' : 's'}
            </span>
          </div>

          {cellCount > 0 ? (
            <>
              <div className="palette" role="toolbar" aria-label="Object palette">
                {CELL_OBJECT_KINDS.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className={`ptool${tool === kind ? ' active' : ''}`}
                    aria-pressed={tool === kind}
                    onClick={() => setTool(kind)}
                  >
                    <img className="ptool-icon" src={baseIconUrl(kind)} alt="" aria-hidden="true" />
                    <span className="ptool-label">{OBJECT_LABEL[kind]}</span>
                  </button>
                ))}
                <span className="palette-sep" aria-hidden="true" />
                <button
                  type="button"
                  className={`ptool${tool === 'window' ? ' active' : ''}`}
                  aria-pressed={tool === 'window'}
                  onClick={() => setTool('window')}
                >
                  <img className="ptool-icon" src={baseIconUrl('window')} alt="" aria-hidden="true" />
                  <span className="ptool-label">{OBJECT_LABEL.window}</span>
                </button>
                <button
                  type="button"
                  className={`ptool ptool-erase${tool === 'erase' ? ' active' : ''}`}
                  aria-pressed={tool === 'erase'}
                  onClick={() => setTool('erase')}
                >
                  <span className="ptool-glyph" aria-hidden="true">
                    ⌫
                  </span>
                  <span className="ptool-label">Erase</span>
                </button>
              </div>

              <p className="hint">
                {tool === 'window'
                  ? 'Click a wall — an interior wall or the outer edge — to add a window; click it again to remove it. Windows can only sit on walls.'
                  : 'Pick an object, then click or drag across squares to place it. Only one object fits per square; click a matching square again to clear it.'}
              </p>

              <div className="board-scroll">
                <ObjectsBoard
                  puzzle={puzzle}
                  tool={tool}
                  onSetObject={(x, y, kind) => setObject(puzzleId, x, y, kind)}
                  onSetWindow={(key, on) => setWindow(puzzleId, key, on)}
                />
              </div>
            </>
          ) : (
            <p className="empty-state">Add some cells in Shape mode first, then come back to furnish them.</p>
          )}
        </>
      )}

      {mode === 'rooms' && (
        <>
          <div className="toolbar">
            <span className="toolbar-label">Room names</span>
            <button
              type="button"
              className="btn btn-small btn-ghost"
              disabled={labelCount === 0}
              onClick={() => {
                if (labelCount === 0 || confirm('Remove every room name from this puzzle?')) clearLabels(puzzleId)
              }}
            >
              Clear labels
            </button>
            <span className="toolbar-count">
              {labelCount} label{labelCount === 1 ? '' : 's'}
            </span>
          </div>

          {cellCount > 0 ? (
            <>
              <p className="hint">
                Click inside a room to drop a name along its bottom wall, then type the room's name. Drag
                a label to slide it wherever you like along the walls; use ✕ to remove it.
              </p>

              <div className="board-scroll">
                <RoomsBoard
                  puzzle={puzzle}
                  onAddLabel={(x, y) => addLabel(puzzleId, x, y)}
                  onMoveLabel={(id, x, y) => moveLabel(puzzleId, id, x, y)}
                  onSetLabelText={(id, text) => setLabelText(puzzleId, id, text)}
                  onRemoveLabel={(id) => removeLabel(puzzleId, id)}
                />
              </div>
            </>
          ) : (
            <p className="empty-state">Add some cells in Shape mode first, then come back to name the rooms.</p>
          )}
        </>
      )}

      {mode === 'people' && (
        <>
          <p className="hint">
            Every puzzle has one or more suspects (lettered A, B, C… as you add them) and exactly one
            victim (V). Give each a name and a description.
          </p>

          <PersonasEditor
            puzzle={puzzle}
            onAddSuspect={() => addSuspect(puzzleId)}
            onSetName={(id, name) => setPersonaName(puzzleId, id, name)}
            onSetDescription={(id, description) => setPersonaDescription(puzzleId, id, description)}
            onRemove={(id) => removePersona(puzzleId, id)}
          />
        </>
      )}

      {mode === 'solution' && (
        <>
          <div className="toolbar">
            <span className="toolbar-label">Answer key</span>
            <button
              type="button"
              className="btn btn-small btn-ghost"
              disabled={solutionCount === 0}
              onClick={() => {
                if (solutionCount === 0 || confirm('Clear the whole answer key for this puzzle?'))
                  clearSolution(puzzleId)
              }}
            >
              Clear
            </button>
            <span className="toolbar-count">
              {solutionCount} of {personaCount} placed
            </span>
          </div>

          {cellCount > 0 ? (
            <>
              <p className="hint">
                Pick a person, then click the room they're in to build the solution. Each person goes
                in exactly one room, and no two share a row or column — placing one clears anyone else
                in that row or column. Every other room is X'd out automatically.
              </p>

              <SolutionEditor
                puzzle={puzzle}
                onPlace={(x, y, personaId) => setSolution(puzzleId, x, y, personaId)}
              />
            </>
          ) : (
            <p className="empty-state">Add some cells in Shape mode first, then come back to lay out the answer.</p>
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
