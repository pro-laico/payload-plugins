import { ResponsiveImage } from '@pro-laico/payload-images/components/image'
import type { Metadata } from 'next'
import { SectionHeading } from '@/components/SectionHeading'
import { Icon } from '@/components/ui/Icon'
import { getServices } from '@/lib/data'
import { asDoc, type IconDoc, type MediaImage } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Services' }

export default async function ServicesPage() {
  const services = await getServices()

  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <SectionHeading
        eyebrow="Services"
        title="How we work"
        description="Most of our projects use more than one of these. We’re happy to lead all of it, or to slot in alongside a builder or architect you already trust."
      />

      <div className="mt-16 space-y-20">
        {services.map((service, i) => {
          const image = asDoc<MediaImage>(service.image)
          const icon = asDoc<IconDoc>(service.icon)
          const flip = i % 2 === 1
          return (
            <section key={String(service.id)} className="grid items-center gap-10 lg:grid-cols-2">
              <div className={`overflow-hidden rounded-2xl border border-border ${flip ? 'lg:order-2' : ''}`}>
                {image ? (
                  <ResponsiveImage image={image} aspectRatio="4:3" sizes="(max-width: 1024px) 100vw, 560px" quality={80} className="w-full" />
                ) : null}
              </div>
              <div className={flip ? 'lg:order-1' : ''}>
                <Icon svg={icon?.svgString} variant="outline" size="lg" className="text-primary" />
                <h2 className="mt-5 font-serif text-3xl tracking-tight text-foreground">{service.title}</h2>
                {service.summary ? <p className="mt-3 text-base leading-relaxed text-muted-foreground">{service.summary}</p> : null}
                <p className="mt-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  0{i + 1} / {String(services.length).padStart(2, '0')}
                </p>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
