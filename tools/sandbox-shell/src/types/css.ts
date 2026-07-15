// React's CSSProperties is deliberately closed (csstype); @types/react's own guidance is to
// augment it to admit custom properties — this opens exactly the `--*` namespace, nothing else.
declare module 'react' {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined
  }
}

export {}
