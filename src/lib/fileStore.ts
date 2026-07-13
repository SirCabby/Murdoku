// File-based persistence for the library, layered over the File System Access
// API (Chromium browsers). Unlike localStorage this lets the user choose *where*
// the library lives and keep a real, portable file — the thing you back up, sync
// with a cloud drive, or drop next to a GameStateTracker save.
//
// Everything here is IO glue, deliberately framework-free. The API's permission
// methods (queryPermission/requestPermission) and the top-level pickers aren't in
// the standard TS DOM lib, so we reach them through narrow local casts rather
// than pulling in an extra @types dependency — this repo stays dependency-light.

import type { Library } from '../types/puzzle'
import { parseLibrary, serializeLibrary } from './storage'

const DEFAULT_NAME = 'library.murdoku'
const ACCEPT: FilePickerAcceptType = {
  description: 'Murdoku library',
  accept: { 'application/json': ['.murdoku'] },
}

interface FilePickerAcceptType {
  description?: string
  accept: Record<string, string[]>
}
interface SaveFilePickerOptions {
  suggestedName?: string
  types?: FilePickerAcceptType[]
}
interface OpenFilePickerOptions {
  types?: FilePickerAcceptType[]
  multiple?: boolean
  excludeAcceptAllOption?: boolean
}
interface FilePickerWindow {
  showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>
  showOpenFilePicker(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>
}
interface PermissionCapable {
  queryPermission?(descriptor: { mode: PermissionMode }): Promise<PermissionState>
  requestPermission?(descriptor: { mode: PermissionMode }): Promise<PermissionState>
}
type PermissionMode = 'read' | 'readwrite'

/** True when this browser can let the user pick and re-save a real file. */
export function isFileAccessSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as unknown as Partial<FilePickerWindow>).showSaveFilePicker === 'function' &&
    typeof (window as unknown as Partial<FilePickerWindow>).showOpenFilePicker === 'function'
  )
}

function pickerWindow(): FilePickerWindow | null {
  if (!isFileAccessSupported()) return null
  return window as unknown as FilePickerWindow
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

/** Prompt for a new save location. Returns null if the user cancels the dialog. */
export async function pickSaveFile(): Promise<FileSystemFileHandle | null> {
  const api = pickerWindow()
  if (!api) return null
  try {
    return await api.showSaveFilePicker({ suggestedName: DEFAULT_NAME, types: [ACCEPT] })
  } catch (err) {
    if (isAbort(err)) return null
    throw err
  }
}

/** Prompt for an existing file to open. Returns null if the user cancels. */
export async function pickOpenFile(): Promise<FileSystemFileHandle | null> {
  const api = pickerWindow()
  if (!api) return null
  try {
    const [handle] = await api.showOpenFilePicker({
      types: [ACCEPT],
      multiple: false,
    })
    return handle ?? null
  } catch (err) {
    if (isAbort(err)) return null
    throw err
  }
}

/**
 * Ensure we hold `mode` permission on a handle, prompting the user if needed.
 * Browsers grant read on open/save via the picker but require a fresh gesture to
 * (re)grant readwrite — that's why reconnecting a remembered file needs a click.
 * Older implementations lack the permission methods entirely; assume granted.
 */
export async function requestPermission(
  handle: FileSystemFileHandle,
  mode: PermissionMode
): Promise<boolean> {
  const h = handle as unknown as PermissionCapable
  if (!h.queryPermission || !h.requestPermission) return true
  if ((await h.queryPermission({ mode })) === 'granted') return true
  return (await h.requestPermission({ mode })) === 'granted'
}

/** Overwrite the linked file with the current library. */
export async function writeToHandle(
  handle: FileSystemFileHandle,
  library: Library
): Promise<void> {
  const writable = await handle.createWritable()
  try {
    await writable.write(serializeLibrary(library))
  } finally {
    await writable.close()
  }
}

/** Read and parse the linked file into a Library (throws on malformed content). */
export async function readFromHandle(handle: FileSystemFileHandle): Promise<Library> {
  const file = await handle.getFile()
  return parseLibrary(await file.text())
}

// ---- Fallback for browsers without the File System Access API (Firefox/Safari).
// The user can still export a file (it lands in Downloads) and import one back;
// they just don't get to pick a persistent location or auto-save to it.

/** Download the library as a `.murdoku` file. */
export function downloadLibrary(library: Library, name: string = DEFAULT_NAME): void {
  const blob = new Blob([serializeLibrary(library)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/** Parse a file chosen via a plain `<input type="file">` (throws on malformed). */
export async function readLibraryFromFile(file: File): Promise<Library> {
  return parseLibrary(await file.text())
}
