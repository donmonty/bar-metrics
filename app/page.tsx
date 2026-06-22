export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>bar-metrics</h1>
      <p>
        Dashboard + AI chatbot for nubebar bar managers. This is the app
        skeleton; the dashboard and chatbot land in later slices.
      </p>
      <p>
        Health check: <a href="/health">/health</a>
      </p>
    </main>
  );
}
