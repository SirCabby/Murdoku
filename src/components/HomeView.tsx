import { useState } from 'react'
import { useLibrary } from '../state/LibraryContext'

interface HomeViewProps {
  onPlay: (puzzleId: string) => void
  onEdit: (puzzleId: string) => void
}

export function HomeView({ onPlay, onEdit }: HomeViewProps): JSX.Element {
  const { library, addFolder, renameFolder, deleteFolder, addPuzzle, deletePuzzle } = useLibrary()
  const [editingFolder, setEditingFolder] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')

  function startRename(folderId: string, current: string): void {
    setEditingFolder(folderId)
    setDraftName(current)
  }

  function commitRename(folderId: string): void {
    renameFolder(folderId, draftName)
    setEditingFolder(null)
  }

  return (
    <div className="view home">
      <div className="view-head">
        <h1 className="view-title">Murdoku</h1>
        <div className="view-head-actions">
          <button type="button" className="btn btn-primary" onClick={() => addFolder('New folder')}>
            + New folder
          </button>
        </div>
      </div>

      {library.folders.length === 0 && (
        <div className="empty-state">
          <p>No folders yet. Create one to hold your puzzles.</p>
        </div>
      )}

      {library.folders.map((folder) => (
        <section key={folder.id} className="folder">
          <div className="folder-head">
            {editingFolder === folder.id ? (
              <input
                className="input folder-name-input"
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={() => commitRename(folder.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename(folder.id)
                  if (e.key === 'Escape') setEditingFolder(null)
                }}
              />
            ) : (
              <h2 className="folder-name" onDoubleClick={() => startRename(folder.id, folder.name)}>
                {folder.name}
              </h2>
            )}
            <div className="folder-actions">
              <button
                type="button"
                className="btn btn-small"
                onClick={() => {
                  const p = addPuzzle(folder.id, 'New puzzle')
                  onEdit(p.id)
                }}
              >
                + New puzzle
              </button>
              <button
                type="button"
                className="btn btn-small btn-ghost"
                onClick={() => startRename(folder.id, folder.name)}
              >
                Rename
              </button>
              <button
                type="button"
                className="btn btn-small btn-ghost"
                onClick={() => {
                  if (confirm(`Delete folder "${folder.name}" and its puzzles?`)) deleteFolder(folder.id)
                }}
              >
                Delete
              </button>
            </div>
          </div>

          {folder.puzzleIds.length === 0 ? (
            <p className="folder-empty">No puzzles in this folder yet.</p>
          ) : (
            <ul className="puzzle-list">
              {folder.puzzleIds.map((pid) => {
                const puzzle = library.puzzles[pid]
                if (!puzzle) return null
                return (
                  <li key={pid} className="puzzle-card">
                    <button type="button" className="puzzle-card-main" onClick={() => onPlay(pid)}>
                      <span className="puzzle-card-name">
                        {puzzle.solved && (
                          <span className="solved-check" title="Solved" aria-label="Solved">
                            ✓
                          </span>
                        )}
                        {puzzle.name}
                      </span>
                    </button>
                    <div className="puzzle-card-actions">
                      <button type="button" className="btn btn-small btn-ghost" onClick={() => onEdit(pid)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-small btn-ghost"
                        onClick={() => {
                          if (confirm(`Delete puzzle "${puzzle.name}"?`)) deletePuzzle(pid)
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}
