// Persistence for the *link* to the user's chosen save file.
//
// A FileSystemFileHandle (from the File System Access API) is structured-
// cloneable, so we can stash it in IndexedDB and get it back on the next visit —
// that's what lets Murdoku reconnect to "the file you picked last time" without
// making you re-pick it. Browser security still requires a user gesture to
// re-grant read/write permission on that handle each session (see fileStore.ts).
//
// localStorage can't hold a handle (only strings), which is why this uses IDB.

const DB_NAME = 'murdoku'
const DB_VERSION = 1
const STORE = 'file-handles'
const KEY = 'library'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (): void => {
      req.result.createObjectStore(STORE)
    }
    req.onsuccess = (): void => resolve(req.result)
    req.onerror = (): void => reject(req.error)
  })
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = (): void => resolve(request.result)
    request.onerror = (): void => reject(request.error)
  })
}

/** Remember the handle to the currently-linked save file. */
export async function saveFileHandle(handle: FileSystemFileHandle): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  const db = await openDb()
  try {
    const store = db.transaction(STORE, 'readwrite').objectStore(STORE)
    await promisify(store.put(handle, KEY))
  } finally {
    db.close()
  }
}

/** Load the previously-linked file handle, or null if none was remembered. */
export async function loadFileHandle(): Promise<FileSystemFileHandle | null> {
  if (typeof indexedDB === 'undefined') return null
  const db = await openDb()
  try {
    const store = db.transaction(STORE, 'readonly').objectStore(STORE)
    const result = await promisify<unknown>(store.get(KEY))
    return (result as FileSystemFileHandle | undefined) ?? null
  } finally {
    db.close()
  }
}

/** Forget the linked file (used when the user unlinks). */
export async function clearFileHandle(): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  const db = await openDb()
  try {
    const store = db.transaction(STORE, 'readwrite').objectStore(STORE)
    await promisify(store.delete(KEY))
  } finally {
    db.close()
  }
}
