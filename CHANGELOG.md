# Changelog

All notable changes to this monorepo are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). All `@pro-laico/*`
packages share one lockstep version.

## [Unreleased]

### Added

- Initial monorepo scaffold: pnpm workspaces + Turborepo, Biome (144-col, import
  organizing off), shared `tsconfig.base.json`, swc package builds, lockstep release
  tooling (`tools/releaser`) with a tag-triggered npm publish workflow, and a
  fumadocs documentation site.
