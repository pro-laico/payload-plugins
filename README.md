> [!IMPORTANT]
> All of these plugins work but are in progress. They just need more rigorous testing before this advisory is removed. Expect the occasional bug and breaking change between releases.

# Payload Plugins

These [Payload CMS](https://payloadcms.com/) plugins are meant to make aspects of using Payload CMS simpler and more powerful. Unlocking new ways of interacting with your data, and making end users experiences better. Most plugins are 0 config and can be dropped into a repo without issue. 

**[Documentation → payload-plugins.prolaico.com](https://payload-plugins.prolaico.com)*

| Plugin | |
| --- | --- |
| [`@pro-laico/payload-seed`](https://payload-plugins.prolaico.com/docs/plugins/payload-seed) | Type-safe database seeding. |
| [`@pro-laico/payload-images`](https://payload-plugins.prolaico.com/docs/plugins/payload-images) | Sanity CMS Style Images Pipeline With Extra QOL Features |
| [`@pro-laico/payload-fonts`](https://payload-plugins.prolaico.com/docs/plugins/payload-fonts) | Upload & Automatically Optimize Fonts. Serve With Next.js Local Fonts. |
| [`@pro-laico/payload-icons`](https://payload-plugins.prolaico.com/docs/plugins/payload-icons) | No more cookie cutter icons. Build your own optimized icon library.|
| [`@pro-laico/payload-mux`](https://payload-plugins.prolaico.com/docs/plugins/payload-mux) | End to end Mux video handling collection. |
| [`@pro-laico/payload-revalidate`](https://payload-plugins.prolaico.com/docs/plugins/payload-revalidate) | Surgical tag-based Next.js cache revalidation, with a dependency map. |
| [`@pro-laico/payload-dev-tools`](https://payload-plugins.prolaico.com/docs/plugins/payload-dev-tools) | Tools to make Payload CMS app development easier/faster. |

> [!NOTE]
> I only have one set of eyes. If you notice a bug, or have a feature request, please make an issue and I will do my best to address it. All feedback is appreciated!

## Development

```bash
pnpm install
pnpm docs        # run the docs site
pnpm build       # build every package
pnpm typecheck   # typecheck every workspace
pnpm test        # run tests
```

See [MONOREPO.md](./MONOREPO.md) for contributor docs and releasing.

## License

MIT — see [LICENSE.md](./LICENSE.md). Not affiliated with Payload CMS in any capacity.
