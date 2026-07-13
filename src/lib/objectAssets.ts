import type { CellObjectKind, ObjectKind } from '../types/puzzle'

// Resolves vendored object artwork (from murdoku.com) to bundled asset URLs.
// Vite turns each `import.meta.glob` entry into an emitted, content-hashed URL
// at build time; `base: './'` keeps those paths relative so they survive being
// served from a sub-path. Kept apart from `lib/objects.ts` so that module stays
// pure/testable — this one depends on the Vite bundler.

type UrlMap = Record<string, string>

function byBasename(glob: UrlMap): UrlMap {
  const out: UrlMap = {}
  for (const [path, url] of Object.entries(glob)) {
    const name = path.slice(path.lastIndexOf('/') + 1).replace(/\.svg$/, '')
    out[name] = url
  }
  return out
}

const baseUrls = byBasename(
  import.meta.glob('../assets/objects/base/*.svg', {
    eager: true,
    query: '?url',
    import: 'default',
  }) as UrlMap
)
const carpetUrls = byBasename(
  import.meta.glob('../assets/objects/carpet/*.svg', {
    eager: true,
    query: '?url',
    import: 'default',
  }) as UrlMap
)
const tableUrls = byBasename(
  import.meta.glob('../assets/objects/table/*.svg', {
    eager: true,
    query: '?url',
    import: 'default',
  }) as UrlMap
)

/** The standalone icon for a kind (also the palette icon). */
export function baseIconUrl(kind: ObjectKind): string {
  const url = baseUrls[kind]
  if (!url) throw new Error(`Missing base icon for object kind "${kind}"`)
  return url
}

/** The bed artwork for a domino: horizontal `obj_bed` or vertical `obj_bed_top`. */
export function bedImageUrl(vertical: boolean): string {
  const url = vertical ? baseUrls['bed_top'] : baseUrls['bed']
  if (!url) throw new Error('Missing bed artwork')
  return url
}

/** An autotile piece (1–49) for a carpet or table cell. */
export function tileUrl(kind: CellObjectKind, tile: number): string {
  const map = kind === 'carpet' ? carpetUrls : tableUrls
  const url = map[String(tile).padStart(2, '0')]
  if (!url) throw new Error(`Missing ${kind} tile ${tile}`)
  return url
}
