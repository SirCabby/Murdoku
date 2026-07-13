import { useCallback, useEffect, useRef, useState } from 'react'
import type { Library } from '../types/puzzle'
import {
  downloadLibrary,
  isFileAccessSupported,
  pickOpenFile,
  pickSaveFile,
  readFromHandle,
  readLibraryFromFile,
  requestPermission,
  writeToHandle,
} from '../lib/fileStore'
import { clearFileHandle, loadFileHandle, saveFileHandle } from '../lib/handleDb'

// Bridges the in-memory library to a user-chosen file. localStorage stays the
// always-on browser backup (in LibraryContext), so a refresh or crash never
// loses work; linking a file adds a durable, movable copy the user controls.
// Writing that file is *manual* — edits accumulate in memory (and localStorage)
// and are written out only when the user clicks Save. The chosen file is
// remembered across sessions, but the browser requires a click to re-grant write
// permission — that's the 'needs-permission' state and the "Reconnect" action.

export type FileSyncStatus =
  | 'unsupported' // no File System Access API — download/import only
  | 'unlinked' // supported, but no file linked yet
  | 'linked' // a file is linked; Save writes to it on demand
  | 'saving' // a write is in flight
  | 'needs-permission' // a file is remembered but needs a click to resume
  | 'error' // last file operation failed (see `error`)

export interface FileSyncApi {
  supported: boolean
  status: FileSyncStatus
  fileName: string | null
  error: string | null
  /**
   * True when the linked file is behind the in-memory library — i.e. there are
   * edits that haven't been written to the file yet. Meaningful only while a file
   * is linked; always false when unlinked/unsupported.
   */
  hasUnsavedChanges: boolean
  /** Write the current library to the linked file. The one and only save action. */
  saveNow: () => Promise<void>
  /** Pick a new location and write the library there (Save As…). */
  linkNewFile: () => Promise<void>
  /** Open an existing file, replacing the current library, and link it. */
  openFile: () => Promise<void>
  /** Re-grant permission on the remembered file so Save can write to it again. */
  reconnect: () => Promise<void>
  /** Forget the linked file (localStorage backup continues regardless). */
  unlink: () => Promise<void>
  /** Fallback export for browsers without the File System Access API. */
  download: () => void
  /** Fallback import for browsers without the File System Access API. */
  importFromFile: (file: File) => Promise<void>
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function useFileSync(
  library: Library,
  replaceLibrary: (next: Library) => void
): FileSyncApi {
  const [supported] = useState(isFileAccessSupported)
  const [status, setStatus] = useState<FileSyncStatus>(
    supported ? 'unlinked' : 'unsupported'
  )
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // The exact library reference last written to the linked file. Because every
  // edit produces a fresh immutable library, `library !== savedLibrary` means the
  // file is stale — that's how we know there are unsaved changes.
  const [savedLibrary, setSavedLibrary] = useState<Library | null>(null)

  const handleRef = useRef<FileSystemFileHandle | null>(null)
  // Whether the linked file has a live write grant, so Save can write to it.
  const writableRef = useRef(false)
  // Latest library, read by callbacks without re-creating them on every edit.
  const libraryRef = useRef(library)
  libraryRef.current = library

  // Record a successful write so the file is now known to match `lib`.
  const markSaved = useCallback((lib: Library): void => {
    setSavedLibrary(lib)
  }, [])

  const writeNow = useCallback(async (handle: FileSystemFileHandle, lib: Library) => {
    try {
      setStatus('saving')
      await writeToHandle(handle, lib)
      markSaved(lib)
      setStatus('linked')
      setError(null)
    } catch (err) {
      writableRef.current = false
      setStatus('error')
      setError(message(err))
    }
  }, [markSaved])

  // Reconnect to the file the user linked in a previous session. We don't request
  // permission here (that needs a gesture) — just surface that a file is waiting.
  useEffect(() => {
    if (!supported) return
    let cancelled = false
    void (async () => {
      let handle: FileSystemFileHandle | null = null
      try {
        handle = await loadFileHandle()
      } catch {
        // IndexedDB unavailable (e.g. private mode) — just stay unlinked.
        return
      }
      if (cancelled || !handle) return
      handleRef.current = handle
      setFileName(handle.name)
      setStatus('needs-permission')
    })()
    return () => {
      cancelled = true
    }
  }, [supported])

  const linkNewFile = useCallback(async () => {
    try {
      const handle = await pickSaveFile()
      if (!handle) return
      if (!(await requestPermission(handle, 'readwrite'))) {
        setStatus('error')
        setError('Permission to write the file was denied.')
        return
      }
      const linked = libraryRef.current
      await writeToHandle(handle, linked)
      await saveFileHandle(handle)
      handleRef.current = handle
      writableRef.current = true
      markSaved(linked)
      setFileName(handle.name)
      setStatus('linked')
      setError(null)
    } catch (err) {
      setStatus('error')
      setError(message(err))
    }
  }, [markSaved])

  const openFile = useCallback(async () => {
    try {
      const handle = await pickOpenFile()
      if (!handle) return
      const loaded = await readFromHandle(handle)
      replaceLibrary(loaded)
      // The file already holds exactly what we just loaded, so it's in sync.
      markSaved(loaded)
      await saveFileHandle(handle)
      handleRef.current = handle
      setFileName(handle.name)
      setError(null)
      // Ask for write access so Save can later write back to this file.
      if (await requestPermission(handle, 'readwrite')) {
        writableRef.current = true
        setStatus('linked')
      } else {
        writableRef.current = false
        setStatus('needs-permission')
      }
    } catch (err) {
      setStatus('error')
      setError(message(err))
    }
  }, [replaceLibrary, markSaved])

  const reconnect = useCallback(async () => {
    const handle = handleRef.current
    if (!handle) return
    try {
      if (!(await requestPermission(handle, 'readwrite'))) {
        setStatus('needs-permission')
        return
      }
      writableRef.current = true
      // Regaining access just re-enables Save — we don't force a write here, so
      // the file isn't overwritten until the user explicitly saves.
      setStatus('linked')
      setError(null)
    } catch (err) {
      setStatus('error')
      setError(message(err))
    }
  }, [])

  const unlink = useCallback(async () => {
    writableRef.current = false
    handleRef.current = null
    await clearFileHandle()
    setFileName(null)
    setStatus('unlinked')
    setError(null)
    setSavedLibrary(null)
  }, [])

  // Write the current library to the linked file. This is the sole save path —
  // no-op unless a file is linked with a live write grant (otherwise the UI shows
  // Reconnect / Save to file… instead).
  const saveNow = useCallback(async () => {
    const handle = handleRef.current
    if (!handle || !writableRef.current) return
    await writeNow(handle, libraryRef.current)
  }, [writeNow])

  const download = useCallback(() => {
    downloadLibrary(libraryRef.current)
  }, [])

  const importFromFile = useCallback(
    async (file: File) => {
      try {
        replaceLibrary(await readLibraryFromFile(file))
        setError(null)
      } catch (err) {
        setError(message(err))
      }
    },
    [replaceLibrary]
  )

  // Unsaved-changes flag: only meaningful while linked, and true whenever the
  // in-memory library has moved past what's in the file.
  const hasUnsavedChanges =
    (status === 'linked' || status === 'saving' || status === 'needs-permission') &&
    library !== savedLibrary

  return {
    supported,
    status,
    fileName,
    error,
    hasUnsavedChanges,
    saveNow,
    linkNewFile,
    openFile,
    reconnect,
    unlink,
    download,
    importFromFile,
  }
}
