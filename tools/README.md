# tools/

Private internal packages — never published.

- `releaser` — the release/publish machinery for `packages/*`.
- `sandbox-shell` — the shared frontend shell (layout, theme, seeding panel) the example sandboxes render into.
- `failure-lab` — an integration-test rig that boots isolated Payload instances and asserts on each plugin's failure modes and log output.
- `smoke` — packs every package and installs the tarballs into a plain app outside the workspace, so the published `dist/` artifact gets exercised rather than only the `src/` everything here loads. `pnpm smoke`.
