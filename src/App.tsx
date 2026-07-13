import { useMemo, useState } from 'react'
import { LibraryProvider } from './state/LibraryContext'
import { HomeView } from './components/HomeView'
import { PuzzlePlayer } from './components/PuzzlePlayer'
import { PuzzleEditor } from './components/PuzzleEditor'
import { FileBar } from './components/FileBar'
import { getGstConnection } from './lib/gst'

type View =
  | { name: 'home' }
  | { name: 'play'; puzzleId: string }
  | { name: 'edit'; puzzleId: string }

export function App(): JSX.Element {
  const [view, setView] = useState<View>({ name: 'home' })
  const gst = useMemo(() => getGstConnection(), [])

  return (
    <LibraryProvider>
      {gst && (
        <div className="gst-banner" title="Opened from GameStateTracker">
          🎮 Connected to GameStateTracker
          {gst.saveName ? ` — save: ${gst.saveName}` : ''}
        </div>
      )}

      <FileBar />

      <div className="app">
        {view.name === 'home' && (
          <HomeView
            onPlay={(puzzleId) => setView({ name: 'play', puzzleId })}
            onEdit={(puzzleId) => setView({ name: 'edit', puzzleId })}
          />
        )}
        {view.name === 'play' && (
          <PuzzlePlayer
            key={view.puzzleId}
            puzzleId={view.puzzleId}
            onBack={() => setView({ name: 'home' })}
            onEdit={() => setView({ name: 'edit', puzzleId: view.puzzleId })}
          />
        )}
        {view.name === 'edit' && (
          <PuzzleEditor
            puzzleId={view.puzzleId}
            onDone={() => setView({ name: 'play', puzzleId: view.puzzleId })}
          />
        )}
      </div>
    </LibraryProvider>
  )
}
