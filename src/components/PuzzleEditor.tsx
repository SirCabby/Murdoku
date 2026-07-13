import { useState } from 'react'
import type { Category } from '../types/puzzle'
import { useLibrary } from '../state/LibraryContext'
import { newId } from '../lib/id'

interface PuzzleEditorProps {
  puzzleId: string
  onDone: () => void
}

/**
 * Edits a puzzle's definition. Works on a local draft and commits on Save, so a
 * half-finished edit never corrupts the live board. Item ids are preserved
 * across renames, so existing marks survive relabelling.
 */
export function PuzzleEditor({ puzzleId, onDone }: PuzzleEditorProps): JSX.Element {
  const { library, updatePuzzle } = useLibrary()
  const puzzle = library.puzzles[puzzleId]

  const [name, setName] = useState(puzzle?.name ?? '')
  const [flavor, setFlavor] = useState(puzzle?.flavor ?? '')
  const [categories, setCategories] = useState<Category[]>(puzzle?.categories ?? [])

  if (!puzzle) {
    return (
      <div className="view">
        <p>That puzzle no longer exists.</p>
        <button type="button" className="btn" onClick={onDone}>← Back</button>
      </div>
    )
  }

  function addCategory(): void {
    setCategories((cats) => [
      ...cats,
      { id: newId(), name: `Category ${cats.length + 1}`, items: [{ id: newId(), label: '' }] },
    ])
  }

  function removeCategory(catId: string): void {
    setCategories((cats) => cats.filter((c) => c.id !== catId))
  }

  function renameCategory(catId: string, value: string): void {
    setCategories((cats) => cats.map((c) => (c.id === catId ? { ...c, name: value } : c)))
  }

  function addItem(catId: string): void {
    setCategories((cats) =>
      cats.map((c) => (c.id === catId ? { ...c, items: [...c.items, { id: newId(), label: '' }] } : c))
    )
  }

  function removeItem(catId: string, itemId: string): void {
    setCategories((cats) =>
      cats.map((c) => (c.id === catId ? { ...c, items: c.items.filter((i) => i.id !== itemId) } : c))
    )
  }

  function renameItem(catId: string, itemId: string, value: string): void {
    setCategories((cats) =>
      cats.map((c) =>
        c.id === catId
          ? { ...c, items: c.items.map((i) => (i.id === itemId ? { ...i, label: value } : i)) }
          : c
      )
    )
  }

  function save(): void {
    const cleaned = categories.map((c) => ({
      ...c,
      name: c.name.trim() || 'Untitled',
      items: c.items
        .map((i) => ({ ...i, label: i.label.trim() }))
        .filter((i) => i.label.length > 0),
    }))
    updatePuzzle(puzzleId, { name: name.trim() || 'Untitled puzzle', flavor: flavor.trim(), categories: cleaned })
    onDone()
  }

  const counts = categories.map((c) => c.items.filter((i) => i.label.trim()).length)
  const uneven = new Set(counts).size > 1

  return (
    <div className="view editor">
      <div className="view-head">
        <div className="view-head-left">
          <button type="button" className="btn btn-ghost" onClick={onDone}>← Back</button>
          <h1 className="view-title">Edit puzzle</h1>
        </div>
        <div className="view-head-actions">
          <button type="button" className="btn btn-primary" onClick={save}>Save</button>
        </div>
      </div>

      <label className="field">
        <span className="field-label">Name</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <label className="field">
        <span className="field-label">Mystery / prompt (optional)</span>
        <textarea
          className="input"
          rows={2}
          value={flavor}
          onChange={(e) => setFlavor(e.target.value)}
          placeholder="e.g. One of them did it, with one weapon, in one room. Who, how, and where?"
        />
      </label>

      <div className="editor-cats-head">
        <h2 className="section-title">Categories</h2>
        {uneven && (
          <span className="warn">Tip: logic grids usually have the same number of items in every category.</span>
        )}
      </div>

      <div className="editor-cats">
        {categories.map((cat) => (
          <div key={cat.id} className="cat-card">
            <div className="cat-card-head">
              <input
                className="input cat-name-input"
                value={cat.name}
                onChange={(e) => renameCategory(cat.id, e.target.value)}
              />
              <button type="button" className="btn btn-small btn-ghost" onClick={() => removeCategory(cat.id)}>
                Remove
              </button>
            </div>
            <div className="cat-items">
              {cat.items.map((item) => (
                <div key={item.id} className="cat-item-row">
                  <input
                    className="input"
                    value={item.label}
                    placeholder="item…"
                    onChange={(e) => renameItem(cat.id, item.id, e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-small btn-ghost"
                    aria-label="Remove item"
                    onClick={() => removeItem(cat.id, item.id)}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn-small" onClick={() => addItem(cat.id)}>
                + Add item
              </button>
            </div>
          </div>
        ))}
      </div>

      <button type="button" className="btn" onClick={addCategory}>+ Add category</button>
    </div>
  )
}
