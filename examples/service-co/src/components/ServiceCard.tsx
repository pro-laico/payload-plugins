import { Icon } from '@/components/ui/Icon'
import { getIcon, getService } from '@/lib/data'

/** A service tile — its related payload-icons glyph (framed) over the title and summary. Takes
 *  the service's ID and self-fetches: the card renders from the service's own cache entry, the
 *  glyph from the icon doc's — re-uploading the SVG refreshes every card using it, nothing else. */
export async function ServiceCard({ id }: { id: string | number }) {
  const service = await getService(id)
  if (!service) return null
  const icon = service.icon != null ? await getIcon(service.icon) : null
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-6">
      <Icon svg={icon?.svgString} variant="outline" size="lg" className="text-primary" />
      <h3 className="mt-5 font-serif text-xl tracking-tight text-foreground">{service.title}</h3>
      {service.summary ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{service.summary}</p> : null}
    </div>
  )
}
