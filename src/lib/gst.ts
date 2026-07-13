// GameStateTracker connection.
//
// When GameStateTracker opens a companion site it appends a URL built from a
// template the user configures on the site's record. The template placeholders
// GST understands are: {GAME_ID} {SAVE_ID} {SAVE_NAME} {SAVE_URL} {FOLDER_URL}
// {SAVE_ROOT_URL}. Murdoku expects them mapped onto these query params:
//
//   ?gst=1&gameId={GAME_ID}&saveId={SAVE_ID}&saveName={SAVE_NAME}
//         &saveUrl={SAVE_URL}&folderUrl={FOLDER_URL}&rootUrl={SAVE_ROOT_URL}
//
// (The recommended template string is documented in the README.) When Murdoku is
// opened on its own, none of these are present and `getGstConnection()` returns
// null — the app just runs off localStorage.

export interface GstConnection {
  gameId: string | null
  saveId: string | null
  saveName: string | null
  /** URL that serves the currently-selected save file. */
  saveUrl: string | null
  /** URL that serves the save's folder. */
  folderUrl: string | null
  /** URL that serves any file under the save root (used for future sync). */
  rootUrl: string | null
}

export function getGstConnection(): GstConnection | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  if (params.get('gst') !== '1') return null

  return {
    gameId: params.get('gameId'),
    saveId: params.get('saveId'),
    saveName: params.get('saveName'),
    saveUrl: params.get('saveUrl'),
    folderUrl: params.get('folderUrl'),
    rootUrl: params.get('rootUrl'),
  }
}
