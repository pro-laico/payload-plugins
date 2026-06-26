# examples/

Minimal Payload + Next.js test apps that exercise the plugins in `packages/` in
isolation. Each example consumes its plugin via `workspace:*` so changes to a
package are picked up immediately in dev.

These are **private** (never published) but are version-stamped in lockstep with
the packages so a given example always matches the plugin version it demonstrates.

## Adding an example

Create `examples/<name>/` with a small Payload + Next.js app that installs and
configures a single plugin, plus whatever seed/fixtures are needed to demo it.
