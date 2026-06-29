export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 640, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>Mux Sandbox</h1>
      <p>A minimal Payload app for testing the @pro-laico/payload-mux plugin.</p>
      <p>
        Open the <a href="/admin">admin panel</a>, go to <strong>Videos</strong>, and upload a clip (needs real Mux credentials in{' '}
        <code>.env.local</code>).
      </p>
    </main>
  )
}
