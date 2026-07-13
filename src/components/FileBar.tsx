import { useRef } from 'react'
import { useLibrary } from '../state/LibraryContext'

// The save-file control strip, shown across the top of the app. It exposes where
// the library is being saved and the actions to pick / open / reconnect a file.
// localStorage autosave runs regardless; this is the durable, user-owned copy.

export function FileBar(): JSX.Element {
  const { fileSync } = useLibrary()
  const importInput = useRef<HTMLInputElement>(null)

  // Fallback for browsers without the File System Access API (Firefox/Safari):
  // export lands in Downloads, import comes from a normal file input.
  if (!fileSync.supported) {
    return (
      <div className="file-bar">
        <span className="file-bar-status">
          <span className="file-bar-dot file-bar-dot-muted" />
          Saved in this browser. Export a file to back up or move your puzzles.
        </span>
        <div className="file-bar-actions">
          <button type="button" className="btn btn-small" onClick={fileSync.download}>
            Download file
          </button>
          <button
            type="button"
            className="btn btn-small btn-ghost"
            onClick={() => importInput.current?.click()}
          >
            Import file…
          </button>
          <input
            ref={importInput}
            type="file"
            accept=".murdoku,application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void fileSync.importFromFile(file)
              e.target.value = ''
            }}
          />
        </div>
        {fileSync.error && <span className="file-bar-error">{fileSync.error}</span>}
      </div>
    )
  }

  return (
    <div className="file-bar">
      <span className="file-bar-status">{renderStatus()}</span>
      <div className="file-bar-actions">{renderActions()}</div>
      {fileSync.error && <span className="file-bar-error">{fileSync.error}</span>}
    </div>
  )

  function renderStatus(): JSX.Element {
    switch (fileSync.status) {
      case 'linked':
        return (
          <>
            <span className="file-bar-dot file-bar-dot-ok" />
            Saving to <strong>{fileSync.fileName}</strong>
          </>
        )
      case 'saving':
        return (
          <>
            <span className="file-bar-dot file-bar-dot-ok" />
            Saving to <strong>{fileSync.fileName}</strong>…
          </>
        )
      case 'needs-permission':
        return (
          <>
            <span className="file-bar-dot file-bar-dot-warn" />
            Paused — reconnect <strong>{fileSync.fileName}</strong> to resume saving.
          </>
        )
      case 'error':
        return (
          <>
            <span className="file-bar-dot file-bar-dot-err" />
            Couldn’t save to the file.
          </>
        )
      default:
        return (
          <>
            <span className="file-bar-dot file-bar-dot-muted" />
            Saved in this browser only. Choose a file to keep a durable copy.
          </>
        )
    }
  }

  function renderActions(): JSX.Element {
    if (fileSync.status === 'needs-permission') {
      return (
        <>
          <button type="button" className="btn btn-small btn-primary" onClick={() => void fileSync.reconnect()}>
            Reconnect
          </button>
          <button type="button" className="btn btn-small btn-ghost" onClick={() => void fileSync.openFile()}>
            Open other…
          </button>
          <button type="button" className="btn btn-small btn-ghost" onClick={() => void fileSync.unlink()}>
            Unlink
          </button>
        </>
      )
    }

    if (fileSync.status === 'linked' || fileSync.status === 'saving') {
      return (
        <>
          <button type="button" className="btn btn-small btn-ghost" onClick={() => void fileSync.openFile()}>
            Open other…
          </button>
          <button type="button" className="btn btn-small btn-ghost" onClick={() => void fileSync.unlink()}>
            Unlink
          </button>
        </>
      )
    }

    // 'unlinked' or 'error'
    return (
      <>
        <button type="button" className="btn btn-small btn-primary" onClick={() => void fileSync.linkNewFile()}>
          Save to file…
        </button>
        <button type="button" className="btn btn-small btn-ghost" onClick={() => void fileSync.openFile()}>
          Open file…
        </button>
      </>
    )
  }
}
