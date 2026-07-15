# Docs style guide

How we write the `payload-plugins` documentation (the Fumadocs site under `docs/content/docs`).
The goal is a reading experience that's simple and informative for someone with a real job to do —
not a reference dump for the person who wrote the code.

The rule of thumb behind everything below: **lead with the outcome, defer the mechanism, and make
each page skimmable.** Precision is non-negotiable; density is the enemy.

## Who you're writing for

Every page serves five readers. Order the page so the earliest ones win the top of the page:

1. **Evaluator** (first 60 seconds) — what is this, why do I want it, what does it cost me?
2. **Integrator** — the shortest correct path from `pnpm add` to working. Copies verbatim.
3. **Task-doer** — one concrete job (render at a ratio, seed a global, sign a URL).
4. **Reference-seeker** — one exact fact (a default, a type, an import path).
5. **Debugger** — it broke; find the fix fast, under stress, by Ctrl-F.

When you write or edit a page, read it back as each of these. Most friction is one of them not
being served: value buried under jargon, a required step missing from the quickstart, a fact trapped
in prose, or a failure mode with no symptom-first entry.

## Voice and sentences

- **One idea per sentence.** If a sentence carries two or more parentheticals or em-dash asides,
  split it. This is the single biggest lever on readability.
- **Outcome first, mechanism second.** "Every crop stays centered on the subject" before "a
  saliency-detected focal point the endpoint reads on every `fit=cover` request."
- **Cut hedges and filler** — "and saves you time", "just falls into place", "of sorts." Kill
  insider phrasing in overviews ("re-materializes", "residual cold path", "surgical for free"); say
  it plainly first, name the mechanism later where it belongs.
- **Caveats become callouts, not clauses.** A `<Callout>` or a collapsible — never a fourth
  subordinate clause. Reserve inline parentheticals for a single short gloss.
- **Say it once.** If a fact shows up three times in the first twenty lines, state it once.
- Keep the personality and the precision. Tightening prose ≠ dumbing it down. You are *relocating*
  density (into callouts, reference tables, sub-pages), not removing substance.

## Page structure

### The plugin skeleton

Every plugin's overview page (`index.mdx`) follows this order:

1. **Intro** — two or three short lines. Line 1: plain WHAT. Line 2: WHY (the pain it removes). No
   version/peer-dependency plumbing in the hook.
2. **`pnpm add`** — the install line, immediately.
3. **Requirements** — a short line or table whenever the plugin has real prerequisites (Next.js
   only; a Mux account + a public webhook; Next 16 + Cache Components; needs `generate:types`). This
   is the evaluator's cost signal — it belongs above the fold, not discovered mid-quickstart.
4. **What's included** — benefit-first bullets with bold lead-ins. The bold lead-in *is* the
   benefit; trim the trailing mechanism clauses.
5. **Quickstart** — see below.
6. **Explore** — `<Cards>` to the task/reference sub-pages (for multi-page plugins).
7. **Plugin options** and **Exports** — reference tables.

Task pages, then reference, then Troubleshooting follow on their own sub-pages.

### When to split a plugin into multiple pages

A plugin doc becomes a folder (`index.mdx` + sub-pages) when it's long enough that one scroll mixes
distinct concerns — overview, several feature surfaces, how-it-works, and troubleshooting. In
practice that's anything past a few hundred lines. Split along the natural seams:

```
index            overview + quickstart + options + exports
<feature pages>  one per surface (rendering, serving, using-x, endpoints, …)
how-it-works     the mechanism, for the curious/debugging
troubleshooting  symptom-first failures
```

Small, single-concern plugins can stay one page — but prefer the folder for consistency: the sidebar
should look the same for every plugin.

### Page naming (frontmatter `title`)

The plugin name is already the sidebar group label (from the folder's `meta.json` `title`), so
**sub-page titles must not repeat it.** Titles are short, sentence-case, no leading article.

| Good | Avoid |
| --- | --- |
| `Troubleshooting` | `payload-fonts troubleshooting` |
| `How it works` | `How payload-icons works` |
| `Collections` | `Collections & the fontSet global` |
| `Using video`, `Writing seeds` | `Use a video` |

Keep the recurring pages named identically across plugins — `Troubleshooting`, `How it works`,
`Collections` — and keep task pages parallel (`Using icons` / `Using video`, `Writing seeds` /
`Writing getters`). The `index.mdx` title is the plugin name itself (`payload-fonts`).

When a page's `title` is `Troubleshooting`, don't also open it with a `## Troubleshooting` heading —
the title already renders as the H1. Lead straight into the intro and the symptom table.

## Quickstart rules

- Number the steps with `<Steps>`; each has a titled code block with the exact file path
  (`title="app/(frontend)/layout.tsx"`).
- Show the **one** recommended path. Relegate alternatives to a one-liner ("Also: X / Y — see …").
- **Include every load-bearing step**, even the "obvious" ones: env vars, `generate:types`,
  `generate:importmap` (and a dev-server restart when components are registered by string path), and
  the admin action that makes content actually appear (upload + select, activate + publish). No
  required step may live only inside a `//` comment.
- **End at a visible result** — "you now see your font on the page." If nothing renders until an
  admin action happens, that action is a quickstart step.
- Inline a one-line caveat where a step has a common failure (the Node 24 tsx issue for the seed CLI;
  stroke SVGs for icons; a layout import a later step generates).

## Reference rules

- **Every option is a table row**: name · type · default · meaning. If a plugin has options, it has
  an options table.
- **Defaults are literal and in one place.** `(req) => Boolean(req.user && …)`, not "logged-in
  admin" in three different phrasings. Flag computed defaults (`cpus - 1`) as computed.
- **Every named export states its import path.** No globs (`/components/*`), no omissions. When entry
  points differ (package root vs a `/cache` subpath vs a factory return), say so once, explicitly.
- **Give functions a signature**: `getIconSvg(payload, name, draft = false): Promise<string | undefined>`,
  not a default hidden in a code comment.
- Reconcile contradictory numbers/spellings to a single source. Use the code-literal form for values
  a machine consumes (`"100 900"` for `next/font`); use prose form only in prose.

## Troubleshooting rules

- One section per plugin, on a page titled **Troubleshooting** (the word debuggers actually search).
- **Symptom-first.** Each entry leads with the observable failure in bold, then cause, then fix. A
  `| Symptom | Cause | Fix |` table is the default shape.
- **Quote literal error/log strings** so a reader can paste terminal text into Ctrl-F and land the
  fix (`node:crypto?tsx-namespace`, `[payload-fonts]`, the `@payload-config` resolution error).
- Cross-link, don't restate: the canonical fix lives once; other mentions point to it.

## MDX and frontmatter

- Components available: `<Callout type="info|warn">`, `<Cards>`/`<Card>`, `<Steps>`/`<Step>`,
  `<Tabs>`/`<Tab>`, `<TypeTable>`, and `<ConfigOptions items={…}>` (fed by an exported `const` array
  of `{ name, type, default, required, description, options? }`). Keep the
  `<Tabs items={['Reference','TypeScript']}>` options pattern — it works.
- Escape JSX in prose: write `` `<Icon>` `` in backticks, never a raw `<Icon>` tag (MDX will try to
  parse it as a component).
- Keep each `export const … = [ … ]` block directly above the `<ConfigOptions>` that consumes it.
- Frontmatter is `title` + `description`. Make the `description` **benefit-first** — it's the
  search/nav snippet, so lead with what the reader gets, not "how-words" like "id-keyed" or
  "field-driven."

## Get the facts right

The docs describe real code. Before documenting a signature, default, option, or export, **verify it
against the package source** — don't trust the previous doc, which may be wrong. A readability pass is
also the moment stale or contradictory facts surface; fix them at the source of truth rather than
carrying them forward. When two places in the docs disagree on a value, one of them is a bug.

## Before you ship

- **Internal links resolve.** Every `/docs/...#anchor` must point at a real page and a real heading.
  Fumadocs slugs headings with github-slugger (lowercase, drop punctuation, spaces → hyphens, repeats
  *not* collapsed: `## Revalidation & caching` → `#revalidation--caching`). Anchors move when you
  split a page or rename a heading — re-check inbound links.
- **The site builds.** Run `pnpm build` in `docs/`. A clean `next build` is the definitive check that
  every page's MDX compiles.
- **`meta.json` nav is right.** A new sub-page must be listed in its folder's `meta.json` `pages`
  array. The array uses filenames (slugs), not titles.
