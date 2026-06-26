export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 640, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>Seed Sandbox</h1>
      <p>A minimal Payload app for testing the @pro-laico/payload-seed plugin.</p>
      <p>
        Open the <a href="/admin">admin panel</a> and use the “Seed your database” button, or run <code>pnpm seed</code> from the CLI.
      </p>
    </main>
  )
}
