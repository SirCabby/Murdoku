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

// Bridges the in-memory library to a user-chosen file. localStorage remains the
// always-on autosave (in LibraryContext); linking a file adds a durable, movable
// copy that the user controls. Once linked, every edit is debounced-written to
// that file. The chosen file is remembered across sessions, but the browser
// requires a click to re-grant write permission — that's the 'needs-permission'
// state and the "Reconnect" action.

const SAVE_DEBOUNCE_MS = 600

export type FileSyncStatus =
  | 'unsupported' // no File System Access API — download/import only
  | 'unlinked' // supported, but not writing to any file yet
  | 'linked' // auto-saving to the chosen file
  | 'saving' // a write is in flight
  | 'needs-permission' // a file is remembered but needs a click to resume
  | 'error' // last file operation failed (see `error`)

export interface FileSyncApi {
  supported: boolean
  status: FileSyncStatus
  fileName: string | null
  error: string | null
  /** Pick a new location and start auto-saving there (Save As…). */
  linkNewFile: () => Promise<void>
  /** Open an existing file, replacing the current library, and link it. */
  openFile: () => Promise<void>
  /** Re-grant permission on the remembered file and resume auto-saving. */
  reconnect: () => Promise<void>
  /** Stop auto-saving to a file (localStorage autosave continues). */
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

  const handleRef = useRef<FileSystemFileHandle | null>(null)
  // Auto-save is active only while linked with a live permission grant. Kept in a
  // ref so the debounce effect can depend on `library` alone and never loop.
  const autoSaveRef = useRef(false)
  // Latest library, read by callbacks without re-creating them on every edit.
  const libraryRef = useRef(library)
  libraryRef.current = library

  const writeNow = useCallback(async (handle: FileSystemFileHandle, lib: Library) => {
    try {
      setStatus('saving')
      await writeToHandle(handle, lib)
      setStatus('linked')
      setError(null)
    } catch (err) {
      autoSaveRef.current = false
      setStatus('error')
      setError(message(err))
    }
  }, [])

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

  // Debounced auto-save: fires on every library change while auto-save is on.
  useEffect(() => {
    if (!autoSaveRef.current) return
    const handle = handleRef.current
    if (!handle) return
    const timer = setTimeout(() => {
      void writeNow(handle, library)
    }, SAVE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [library, writeNow])

  const linkNewFile = useCallback(async () => {
    try {
      const handle = await pickSaveFile()
      if (!handle) return
      if (!(await requestPermission(handle, 'readwrite'))) {
        setStatus('error')
        setError('Permission to write the file was denied.')
        return
      }
      await writeToHandle(handle, libraryRef.current)
      await saveFileHandle(handle)
      handleRef.current = handle
      autoSaveRef.current = true
      setFileName(handle.name)
      setStatus('linked')
      setError(null)
    } catch (err) {
      setStatus('error')
      setError(message(err))
    }
  }, [])

  const openFile = useCallback(async () => {
    try {
      const handle = await pickOpenFile()
      if (!handle) return
      const loaded = await readFromHandle(handle)
      replaceLibrary(loaded)
      await saveFileHandle(handle)
      handleRef.current = handle
      setFileName(handle.name)
      setError(null)
      // Ask for write access so subsequent edits auto-save back to this file.
      if (await requestPermission(handle, 'readwrite')) {
        autoSaveRef.current = true
        setStatus('linked')
      } else {
        autoSaveRef.current = false
        setStatus('needs-permission')
      }
    } catch (err) {
      setStatus('error')
      setError(message(err))
    }
  }, [replaceLibrary])

  const reconnect = useCallback(async () => {
    const handle = handleRef.current
    if (!handle) return
    try {
      if (!(await requestPermission(handle, 'readwrite'))) {
        setStatus('needs-permission')
        return
      }
      autoSaveRef.current = true
      // Push the current (localStorage-backed) library to the file so they match.
      await writeNow(handle, libraryRef.current)
    } catch (err) {
      setStatus('error')
      setError(message(err))
    }
  }, [writeNow])

  const unlink = useCallback(async () => {
    autoSaveRef.current = false
    handleRef.current = null
    await clearFileHandle()
    setFileName(null)
    setStatus('unlinked')
    setError(null)
  }, [])

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

  return {
    supported,
    status,
    fileName,
    error,
    linkNewFile,
    openFile,
    reconnect,
    unlink,
    download,
    importFromFile,
  }
}
