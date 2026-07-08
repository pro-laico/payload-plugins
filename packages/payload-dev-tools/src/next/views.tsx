import Link from 'next/link'
import type { CollectionSlug, GlobalSlug, Payload } from 'payload'
import type { DevSnapshot } from '../lib/snapshot'
import { FontSpecimen, IconSetSwitcher } from './client'
import { RevalidatePanel, type RevalidateInspection } from './revalidatePanel'
import { facesToStyles, type OptimizedFace } from './specimen'

/** `/dev/icons` — every set as a switcher button (activating one re-skins the site), the active
 *  set's glyphs as a grid, and any runtime misses. */
export async function IconsView({ payload, snapshot }: { payload: Payload; snapshot: DevSnapshot }) {
  const icons = snapshot.icons
  if (!icons?.iconSetSlug) {
    return <p className="pdtp-muted">payload-icons isn't installed (or runs without its iconSet collection).</p>
  }

  const res = await payload.find({
    collection: icons.iconSetSlug as CollectionSlug,
    depth: 1,
    limit: 50,
    overrideAccess: true,
    pagination: false,
  })
  const sets = (
    res.docs as {
      id: string | number
      title?: string
      active?: boolean
      iconsArray?: { name?: string; icon?: { svgString?: string } | string | number | null }[]
    }[]
  ).map((doc) => ({
    id: doc.id,
    title: doc.title ?? String(doc.id),
    active: !!doc.active,
    rows: (doc.iconsArray ?? []).flatMap((row) => {
      const svg = row.icon && typeof row.icon === 'object' ? row.icon.svgString : undefined
      return row.name && svg ? [{ name: row.name, svg }] : []
    }),
  }))
  const active = sets.find((s) => s.active)

  return (
    <>
      <div className="pdtp-section">
        <h2>Sets</h2>
        {sets.length ? (
          <IconSetSwitcher sets={sets.map(({ id, title, active: a }) => ({ id, title, active: a }))} />
        ) : (
          <p className="pdtp-muted">No icon sets yet.</p>
        )}
        <p className="pdtp-note">Activating a set publishes it as the single active set — the whole site re-skins on refresh.</p>
      </div>

      <div className="pdtp-section">
        <h2>{active ? `Active set — ${active.title} (${active.rows.length})` : 'Active set'}</h2>
        {active?.rows.length ? (
          <div className="pdtp-icon-grid">
            {active.rows.map((row) => (
              <figure key={row.name} className="pdtp-icon-cell" style={{ margin: 0 }}>
                {/* dangerouslySetInnerHTML: svgString is sanitized by payload-icons on save */}
                <span dangerouslySetInnerHTML={{ __html: row.svg }} />
                <figcaption>{row.name}</figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <p className="pdtp-muted">{active ? 'The active set has no icons.' : 'No set is active — activate one above.'}</p>
        )}
      </div>

      {icons.misses.length ? (
        <div className="pdtp-section">
          <h2>Runtime misses</h2>
          <p className="pdtp-warn">
            {icons.misses.map((m) => (
              <span key={m.name} className="pdtp-code" style={{ marginRight: 8 }}>
                {m.name} ×{m.count}
              </span>
            ))}
          </p>
          <p className="pdtp-note">Names requested in code that didn't resolve through the active set.</p>
        </div>
      ) : null}
    </>
  )
}

const capitalize = (key: string): string => key.charAt(0).toUpperCase() + key.slice(1)

/** `/dev/fonts` — one interactive specimen per family slot, rendered in the family's own
 *  `--font-set*` variable so the page shows the actual served fonts (the host layout loads them
 *  via extractFonts / DevFonts). The weight/style controls are built from the `fontOptimized`
 *  docs, so only faces that really exist are offered. */
export async function FontsView({ payload, snapshot }: { payload: Payload; snapshot: DevSnapshot }) {
  const fonts = snapshot.fonts
  if (!fonts) return <p className="pdtp-muted">payload-fonts isn't installed.</p>

  // Which typeface fills each slot (ids), then every served face of those typefaces.
  const slotIds: Record<string, string | number | null> = {}
  if (fonts.fontSetSlug) {
    try {
      const set = (await payload.findGlobal({ slug: fonts.fontSetSlug as GlobalSlug, depth: 0, overrideAccess: true })) as unknown as Record<
        string,
        unknown
      >
      for (const key of fonts.familyKeys) {
        const value = set[key]
        slotIds[key] = typeof value === 'string' || typeof value === 'number' ? value : null
      }
    } catch {}
  }

  const ids = Object.values(slotIds).filter((id): id is string | number => id !== null && id !== undefined)
  let faces: OptimizedFace[] = []
  if (fonts.fontOptimizedSlug && ids.length) {
    try {
      const res = await payload.find({
        collection: fonts.fontOptimizedSlug as CollectionSlug,
        where: { font: { in: ids } },
        depth: 0,
        limit: 200,
        overrideAccess: true,
        pagination: false,
      })
      faces = res.docs as OptimizedFace[]
    } catch {}
  }

  return (
    <>
      {fonts.familyKeys.map((key) => {
        const id = slotIds[key]
        const styles = id != null ? facesToStyles(faces.filter((f) => f.font === id)) : []
        return (
          <FontSpecimen
            key={key}
            familyKey={key}
            title={fonts.slots[key] ?? null}
            cssVar={`var(--font-set${capitalize(key)})`}
            styles={styles}
          />
        )
      })}
      <p className="pdtp-note">
        Only weights and styles the typeface actually serves are offered (from the{' '}
        <span className="pdtp-code">{fonts.fontOptimizedSlug ?? 'fontOptimized'}</span> collection); a variable face exposes stops across its
        range. Slots come from the <span className="pdtp-code">{fonts.fontSetSlug ?? 'fontSet'}</span> global.
      </p>
    </>
  )
}

/** The where-clause for docs with no folder — the pattern Payload's own folder views use. */
const UNFILED_WHERE = { or: [{ folder: { exists: false } }, { folder: { equals: null } }] }

/** `/dev/images` — every original through the on-demand transform endpoint (`?w=320`), so the
 *  grid itself exercises payload-images end-to-end. When the collection has Payload folders
 *  enabled, the folders render as filter chips (`?folder=<id>`, `?folder=none` for unfiled) so
 *  you can click through the library the way it's organized. */
export async function ImagesView({
  payload,
  snapshot,
  searchParams = {},
}: {
  payload: Payload
  snapshot: DevSnapshot
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const images = snapshot.images
  if (!images) return <p className="pdtp-muted">payload-images isn't installed.</p>

  const base = snapshot.devRoute
  const sourceSlug = images.sourceSlug as CollectionSlug

  // Folder chips — only when the root folders feature is on (a collection opted in).
  const foldersConfig = payload.config.folders
  const foldersSlug = foldersConfig ? (foldersConfig.slug ?? 'payload-folders') : null
  const folders: { id: string | number; name: string; count: number }[] = []
  let unfiled = 0
  if (foldersSlug) {
    try {
      const res = await payload.find({ collection: foldersSlug as CollectionSlug, depth: 0, limit: 100, overrideAccess: true, sort: 'name' })
      for (const doc of res.docs as { id: string | number; name?: string }[]) {
        const { totalDocs } = await payload.count({ collection: sourceSlug, where: { folder: { equals: doc.id } }, overrideAccess: true })
        if (totalDocs > 0) folders.push({ id: doc.id, name: doc.name ?? String(doc.id), count: totalDocs })
      }
      unfiled = (await payload.count({ collection: sourceSlug, where: UNFILED_WHERE, overrideAccess: true })).totalDocs
    } catch {}
  }

  const selected = typeof searchParams.folder === 'string' ? searchParams.folder : undefined
  const where =
    selected === 'none' && folders.length
      ? UNFILED_WHERE
      : selected && folders.some((f) => String(f.id) === selected)
        ? { folder: { equals: selected } }
        : undefined

  const res = await payload.find({
    collection: sourceSlug,
    depth: 0,
    limit: 60,
    overrideAccess: true,
    sort: '-createdAt',
    ...(where ? { where } : {}),
  })
  const docs = res.docs as { id: string | number; filename?: string; alt?: string }[]

  return (
    <>
      {folders.length ? (
        <div className="pdtp-chips" style={{ marginBottom: 20 }}>
          <Link href={`${base}/images`} className={`pdtp-chip ${!where ? 'pdtp-active' : ''}`}>
            All · {images.sourceCount ?? '?'}
          </Link>
          {folders.map((folder) => (
            <Link
              key={folder.id}
              href={`${base}/images?folder=${folder.id}`}
              className={`pdtp-chip ${selected === String(folder.id) ? 'pdtp-active' : ''}`}
            >
              {folder.name} · {folder.count}
            </Link>
          ))}
          {unfiled > 0 ? (
            <Link href={`${base}/images?folder=none`} className={`pdtp-chip ${selected === 'none' ? 'pdtp-active' : ''}`}>
              Unfiled · {unfiled}
            </Link>
          ) : null}
        </div>
      ) : null}

      {docs.length ? (
        <div className="pdtp-img-grid">
          {docs.map((doc) => (
            <figure key={doc.id} className="pdtp-img-cell" style={{ margin: 0 }}>
              {/* biome-ignore lint/performance/noImgElement: dev page — exercising the plugin's own transform endpoint, not next/image */}
              <img src={`${images.basePath}/${doc.id}?w=320`} alt={doc.alt ?? doc.filename ?? String(doc.id)} loading="lazy" />
              <figcaption title={doc.alt}>{doc.filename ?? doc.id}</figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <p className="pdtp-muted">No images{where ? ' in this folder' : ' yet'}.</p>
      )}
      <p className="pdtp-note">
        {docs.length} originals rendered through <span className="pdtp-code">{images.basePath}/:id?w=320</span>
        {res.totalDocs > docs.length ? ` (showing ${docs.length} of ${res.totalDocs})` : ''} · {images.variantCount ?? 0} cached variants so far
        {folders.length ? ' · folders via Payload folders' : ''}
      </p>
    </>
  )
}

/** `/dev/revalidate` — the dependency map, rendered by the tabbed client panel (Explore /
 *  Map / Reads / Events). All data comes live off payload-revalidate's inspection slot,
 *  read here (server side, structural — no import) and passed down as plain props. */
export function RevalidateView({ snapshot }: { snapshot: DevSnapshot }) {
  const meta = snapshot.revalidate
  const inspect = (globalThis as Record<symbol, unknown>)[Symbol.for('pro-laico.payload-revalidate.inspect')] as
    | (() => RevalidateInspection)
    | undefined
  const data = inspect?.()
  if (!meta || !data) return <p className="pdtp-muted">payload-revalidate isn't active in this process.</p>

  return <RevalidatePanel data={data} endpointPath={meta.endpointPath} />
}

const formatDuration = (seconds?: number | null): string => {
  if (!seconds && seconds !== 0) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** `/dev/mux` — the videos with their persisted ingest status. */
export async function MuxView({ payload, snapshot }: { payload: Payload; snapshot: DevSnapshot }) {
  const mux = snapshot.mux
  if (!mux) return <p className="pdtp-muted">payload-mux isn't installed.</p>

  const res = await payload.find({ collection: mux.slug as CollectionSlug, depth: 0, limit: 50, overrideAccess: true, sort: '-createdAt' })
  const docs = res.docs as { id: string | number; title?: string; status?: string; duration?: number }[]

  return (
    <>
      {!mux.credentialed ? (
        <p className="pdtp-warn" style={{ marginTop: 0 }}>
          MUX_TOKEN_ID / MUX_TOKEN_SECRET are not set — uploads and ingest will fail.
        </p>
      ) : null}
      {docs.length ? (
        <table className="pdtp-table">
          <thead>
            <tr>
              <th>title</th>
              <th>status</th>
              <th>duration</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((doc) => (
              <tr key={doc.id}>
                <td>{doc.title ?? doc.id}</td>
                <td className={doc.status === 'errored' ? 'pdtp-warn' : undefined}>{doc.status ?? '—'}</td>
                <td className="pdtp-mono">{formatDuration(doc.duration)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="pdtp-muted">No videos yet.</p>
      )}
    </>
  )
}
