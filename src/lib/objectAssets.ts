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

// Span kinds whose vertical piece is a separate `<kind>_top` drawing rather than
// the horizontal icon reused. A car has one drawing (it only ever spans
// horizontally), used at any orientation.
const TOP_VARIANT_SPAN_KINDS = new Set<CellObjectKind>(['bed', 'towel'])

/**
 * The artwork for a span piece (bed/towel/car). A bed and a towel swap between
 * horizontal (`<kind>`) and vertical (`<kind>_top`) art; a car uses its single
 * drawing at any orientation — object-fit keeps a leftover single letterboxed,
 * not squished.
 */
export function spanImageUrl(kind: CellObjectKind, vertical: boolean): string {
  if (vertical && TOP_VARIANT_SPAN_KINDS.has(kind)) {
    const url = baseUrls[`${kind}_top`]
    if (!url) throw new Error(`Missing ${kind} vertical artwork`)
    return url
  }
  return baseIconUrl(kind)
}

/** An autotile piece (1–49) for a carpet or table cell. */
export function tileUrl(kind: CellObjectKind, tile: number): string {
  const map = kind === 'carpet' ? carpetUrls : tableUrls
  const url = map[String(tile).padStart(2, '0')]
  if (!url) throw new Error(`Missing ${kind} tile ${tile}`)
  return url
}
