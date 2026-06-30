import { defineConfig, defineDocs } from 'fumadocs-mdx/config'
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema'

// Customize Zod schemas for frontmatter and `meta.json` here.
// See https://fumadocs.dev/docs/mdx/collections
export const docs = defineDocs({
  dir: 'content/docs',
  // `includeProcessedMarkdown` exposes `page.data.getText('processed')`, the source the .md /
  // llms.txt routes serve (see src/lib/llm-markdown.ts, which cleans our components out of it).
  docs: { schema: pageSchema, postprocess: { includeProcessedMarkdown: true } },
  meta: { schema: metaSchema },
})

export default defineConfig({
  mdxOptions: {},
})
