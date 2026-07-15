import { Accordion, Accordions } from 'fumadocs-ui/components/accordion'
import { Card, Cards } from 'fumadocs-ui/components/card'
import { ImageZoom } from 'fumadocs-ui/components/image-zoom'
import { Step, Steps } from 'fumadocs-ui/components/steps'
import { Tab, Tabs } from 'fumadocs-ui/components/tabs'
import { TypeTable } from 'fumadocs-ui/components/type-table'
import defaultMdxComponents from 'fumadocs-ui/mdx'
import type { MDXComponents } from 'mdx/types'
import { ConfigOptions } from './config-options'
import { Flow } from './flow/flow'

// Shared components registered globally so docs pages use them without per-page
// imports. `Callout` is already part of the Fumadocs defaults.
export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    // Figure-style wrapper: framed image + the alt text repeated as a visible caption. Spans
    // (not figure/figcaption) because MDX renders images inside a <p>, where flow content is
    // invalid HTML and trips hydration warnings.
    img: (props) => {
      const { alt, ...rest } = props as React.ComponentProps<typeof ImageZoom>
      return (
        <span className="not-prose my-6 block overflow-hidden rounded-xl border bg-fd-card">
          <ImageZoom alt={alt ?? ''} {...rest} className="!my-0 block w-full" />
          {alt ? <span className="block border-t px-4 py-2.5 text-sm text-fd-muted-foreground">{alt}</span> : null}
        </span>
      )
    },
    TypeTable,
    Steps,
    Step,
    Tabs,
    Tab,
    Cards,
    Card,
    Accordions,
    Accordion,
    ConfigOptions,
    Flow,
    ...components,
  } satisfies MDXComponents
}

export const useMDXComponents = getMDXComponents

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>
}
