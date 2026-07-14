import Link from 'next/link'
import type { Payload } from 'payload'

import { facesToStyles } from './specimen'
import { RevalidatePanel } from './revalidatePanel'
import { FontSpecimen, IconSetSwitcher } from './client'
import { isRecord } from '../lib/isRecord'
import type { DevSnapshot, OptimizedFace } from '../types'

export async function IconsView({ payload, snapshot }: { payload: Payload; snapshot: DevSnapshot }) {
  const icons = snapshot.icons
  if (!icons?.iconSetSlug) {
    return <p className="pdtp-muted">payload-icons isn't installed (or runs without its iconSet collection).</p>
  }

  const res = await payload.find({
    collection: icons.iconSetSlug,
    depth: 1,
    limit: 50,
    pagination: false,
  })
  const sets = res.docs.map((doc) => ({
    id: doc.id,
    title: typeof doc.title === 'string' ? doc.title : String(doc.id),
    active: Boolean(doc.active),
    rows: (Array.isArray(doc.iconsArray) ? doc.iconsArray : []).flatMap((row) => {
      if (!isRecord(row)) return []
      const name = typeof row.name === 'string' ? row.name : undefined
      const svg = isRecord(row.icon) && typeof row.icon.svgString === 'string' ? row.icon.svgString : undefined
      return name && svg ? [{ name, svg }] : []
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

export async function FontsView({ payload, snapshot }: { payload: Payload; snapshot: DevSnapshot }) {
  const fonts = snapshot.fonts
  if (!fonts) return <p className="pdtp-muted">payload-fonts isn't installed.</p>

  const slotIds: Record<string, string | number | null> = {}
  if (fonts.fontSetSlug) {
    try {
      const set = await payload.findGlobal({ slug: fonts.fontSetSlug, depth: 0 })
      for (const key of fonts.familyKeys) {
        const value = set[key]
        slotIds[key] = typeof value === 'string' || typeof value === 'number' ? value : null
      }
    } catch {}
  }

  let faces: OptimizedFace[] = []
  const ids = Object.values(slotIds).filter((id): id is string | number => id !== null && id !== undefined)
  if (fonts.fontOptimizedSlug && ids.length) {
    try {
      const res = await payload.find({
        collection: fonts.fontOptimizedSlug,
        where: { font: { in: ids } },
        depth: 0,
        limit: 200,
        pagination: false,
      })
      faces = res.docs.map((d) => ({
        font: typeof d.font === 'string' || typeof d.font === 'number' ? d.font : null,
        weight: typeof d.weight === 'string' ? d.weight : null,
        style: d.style === 'normal' || d.style === 'italic' ? d.style : null,
        isVariable: typeof d.isVariable === 'boolean' ? d.isVariable : null,
        italCapable: typeof d.italCapable === 'boolean' ? d.italCapable : null,
      }))
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

const UNFILED_WHERE = { or: [{ folder: { exists: false } }, { folder: { equals: null } }] }

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
  const sourceSlug = images.sourceSlug

  let unfiled = 0
  const foldersConfig = payload.config.folders
  const folders: { id: string | number; name: string; count: number }[] = []
  const foldersSlug = foldersConfig ? (foldersConfig.slug ?? 'payload-folders') : null
  if (foldersSlug) {
    try {
      const res = await payload.find({ collection: foldersSlug, depth: 0, limit: 100, sort: 'name' })
      for (const doc of res.docs) {
        const { totalDocs } = await payload.count({ collection: sourceSlug, where: { folder: { equals: doc.id } } })
        if (totalDocs > 0) folders.push({ id: doc.id, name: typeof doc.name === 'string' ? doc.name : String(doc.id), count: totalDocs })
      }
      unfiled = (await payload.count({ collection: sourceSlug, where: UNFILED_WHERE })).totalDocs
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
    sort: '-createdAt',
    ...(where ? { where } : {}),
  })
  const docs = res.docs.map((d) => ({
    id: d.id,
    filename: typeof d.filename === 'string' ? d.filename : undefined,
    alt: typeof d.alt === 'string' ? d.alt : undefined,
  }))

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

export function RevalidateView({ snapshot }: { snapshot: DevSnapshot }) {
  const meta = snapshot.revalidate
  // Reads payload-revalidate's Symbol.for inspect slot cross-package without importing it.
  const inspect = Reflect.get(globalThis, Symbol.for('pro-laico.payload-revalidate.inspect'))
  const data = typeof inspect === 'function' ? inspect() : undefined
  if (!meta || !data) return <p className="pdtp-muted">payload-revalidate isn't active in this process.</p>

  return <RevalidatePanel data={data} endpointPath={meta.endpointPath} />
}

const formatDuration = (seconds?: number | null): string => {
  if (!seconds && seconds !== 0) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export async function MuxView({ payload, snapshot }: { payload: Payload; snapshot: DevSnapshot }) {
  const mux = snapshot.mux
  if (!mux) return <p className="pdtp-muted">payload-mux isn't installed.</p>

  const res = await payload.find({ collection: mux.slug, depth: 0, limit: 50, sort: '-createdAt' })
  const docs = res.docs.map((d) => ({
    id: d.id,
    title: typeof d.title === 'string' ? d.title : undefined,
    status: typeof d.status === 'string' ? d.status : undefined,
    duration: typeof d.duration === 'number' ? d.duration : undefined,
  }))

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
