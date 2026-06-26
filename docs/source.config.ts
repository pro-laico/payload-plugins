import { defineConfig, defineDocs } from 'fumadocs-mdx/config'
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema'

// Customize Zod schemas for frontmatter and `meta.json` here.
// See https://fumadocs.dev/docs/mdx/collections
export const docs = defineDocs({
  dir: 'content/docs',
  docs: { schema: pageSchema },
  meta: { schema: metaSchema },
})

export default defineConfig({
  mdxOptions: {},
})
