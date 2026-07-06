// Vitest stand-in for the `server-only` package: the real module throws outside a React Server
// Components bundle, but these integration tests run in plain Node where the constraint is moot.
export {}
