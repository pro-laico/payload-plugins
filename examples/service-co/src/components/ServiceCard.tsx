import { Icon } from '@/components/ui/Icon'
import { asDoc, type IconDoc, type Service } from '@/lib/types'

/** A service tile — its related payload-icons glyph (rendered straight from the relationship's
 *  `svgString`, framed) over the title and summary. */
export function ServiceCard({ service }: { service: Service }) {
  const icon = asDoc<IconDoc>(service.icon)
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-6">
      <Icon svg={icon?.svgString} variant="outline" size="lg" className="text-primary" />
      <h3 className="mt-5 font-serif text-xl tracking-tight text-foreground">{service.title}</h3>
      {service.summary ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{service.summary}</p> : null}
    </div>
  )
}
