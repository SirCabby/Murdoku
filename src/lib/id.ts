/** Short unique id. Uses `crypto.randomUUID` when available. */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  // Fallback for very old runtimes — good enough for local library keys.
  return 'id-' + Math.abs(Date.now() ^ (Math.random() * 1e9)).toString(36)
}
