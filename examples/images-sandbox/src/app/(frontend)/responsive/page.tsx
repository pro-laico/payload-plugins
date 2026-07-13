import config from '@payload-config'
import { buildSrcset } from '@pro-laico/payload-images/utils/urls'
import { Image } from '../../../components/Image'
import { EmptyState, SandboxShell } from '@pro-laico/sandbox-shell'
import { getPayload } from 'payload'
import type { ImageDoc } from '../../../types'
import { shellProps } from '../shell'

export const dynamic = 'force-dynamic'

export default async function ResponsivePage() {
  const payload = await getPayload({ config })
  const img = (await payload.find({ collection: 'images', limit: 1, depth: 0, sort: 'createdAt', overrideAccess: true })).docs[0] as
    | ImageDoc
    | undefined

  if (!img) {
    return (
      <SandboxShell {...shellProps}>
        <p style={{ margin: '0 0 16px' }}>
          <a href="/">← Back to the gallery</a>
        </p>
        <EmptyState>
          No images yet — <a href="/">seed the samples</a> first, then come back.
        </EmptyState>
      </SandboxShell>
    )
  }

  // The same srcset <ResponsiveImage> emits below, shown so you know which candidate URLs to
  // look for in the Network tab.
  const ar = img.width && img.height ? img.width / img.height : undefined
  const srcset = buildSrcset(img, { aspectRatio: ar })?.srcset ?? ''

  return (
    <SandboxShell {...shellProps}>
      <p style={{ margin: 0 }}>
        <a href="/">← Back to the gallery</a>
      </p>
      <h2>One image, every screen size</h2>
      <p className="shell-lead">
        A single <code>&lt;ResponsiveImage&gt;</code> with <code>sizes=&quot;100vw&quot;</code>, full-bleed. No JavaScript and no resize handler
        — the browser reads the <code>srcset</code> and downloads the one variant that fits your screen.
      </p>

      <ol className="shell-seed-steps">
        <li>
          Open DevTools → <strong>Network</strong>, filter to <strong>Img</strong>, and tick <strong>Disable cache</strong>.
        </li>
        <li>
          Turn on the <strong>device toolbar</strong> and make the viewport <strong>narrow</strong> (phone-sized).
        </li>
        <li>
          <strong>Reload.</strong> Exactly one variant loads — the smallest that covers that width × DPR. Note its <code>?w=</code>.
        </li>
        <li>
          Drag the viewport <strong>wider</strong>; each time you cross a step, a larger <code>?w=</code> variant streams in.
        </li>
        <li>
          Grow from narrow → wide, not the reverse: <code>srcset</code> never downgrades once it has a big-enough variant.
        </li>
      </ol>

      {/* Full-bleed: break out of the centered column so `sizes="100vw"` is honest. */}
      <div style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', marginTop: 24 }}>
        <Image id={img.id} sizes="100vw" loading="eager" fetchPriority="high" />
      </div>

      <h2>The srcset it emitted</h2>
      <pre className="shell-code">{srcset.split(', ').join('\n')}</pre>
    </SandboxShell>
  )
}
