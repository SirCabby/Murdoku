import type { CSSProperties } from 'react'
import type { Category, Item, Puzzle } from '../types/puzzle'
import type { GridLayout } from '../lib/gridLayout'
import { getCell } from '../lib/marks'
import { nextMark } from '../lib/cells'
import { Cell } from './Cell'

interface GridProps {
  puzzle: Puzzle
  layout: GridLayout
  onCycle: (catA: Category, itemA: Item, catB: Category, itemB: Item, next: ReturnType<typeof nextMark>) => void
  onNote: (catA: Category, itemA: Item, catB: Category, itemB: Item, note: string) => void
}

function widthOf(cols: number): CSSProperties {
  return { width: `calc(var(--cell) * ${cols})` }
}

/** Renders the staircase logic grid as aligned header + body bands. */
export function Grid({ puzzle, layout, onCycle, onNote }: GridProps): JSX.Element {
  const { topCats, leftCats, blocks } = layout

  return (
    <div className="grid" role="table">
      {/* Top header: corner + one column-group per top category. */}
      <div className="band header-band">
        <div className="row-header corner" aria-hidden="true" />
        {topCats.map((cat) => (
          <div key={cat.id} className="colgroup" style={widthOf(cat.items.length)}>
            <div className="colgroup-name" title={cat.name}>{cat.name}</div>
            <div className="colgroup-items">
              {cat.items.map((it) => (
                <div key={it.id} className="col-item" title={it.label}>
                  <span className="col-item-text">{it.label}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* One body band per left (row) category. */}
      {leftCats.map((leftCat, r) => (
        <div key={leftCat.id} className="band">
          <div className="row-header">
            <div className="row-header-name" title={leftCat.name}>{leftCat.name}</div>
            <div className="row-items">
              {leftCat.items.map((it) => (
                <div key={it.id} className="row-item" title={it.label}>
                  <span className="row-item-text">{it.label}</span>
                </div>
              ))}
            </div>
          </div>

          {(blocks[r] ?? []).map((block, c) => {
            const key = `${leftCat.id}:${topCats[c]?.id ?? c}`
            if (!block.exists) {
              return (
                <div
                  key={key}
                  className="block-spacer"
                  style={widthOf(block.topCat.items.length)}
                  aria-hidden="true"
                />
              )
            }
            return (
              <div key={key} className="block" style={widthOf(block.topCat.items.length)}>
                {block.leftCat.items.map((rowItem) => (
                  <div key={rowItem.id} className="block-row">
                    {block.topCat.items.map((colItem) => {
                      const state = getCell(
                        puzzle.cells,
                        block.leftCat.id,
                        rowItem.id,
                        block.topCat.id,
                        colItem.id
                      )
                      return (
                        <Cell
                          key={colItem.id}
                          state={state}
                          rowLabel={rowItem.label}
                          colLabel={colItem.label}
                          onCycle={() =>
                            onCycle(block.leftCat, rowItem, block.topCat, colItem, nextMark(state.mark))
                          }
                          onNote={(note) =>
                            onNote(block.leftCat, rowItem, block.topCat, colItem, note)
                          }
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
