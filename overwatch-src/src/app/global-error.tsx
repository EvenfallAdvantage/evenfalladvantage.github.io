"use client";

/**
 * Global error boundary — catches errors in the root layout itself.
 * This is the last line of defense; it renders without any layout/providers.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0a0a0f", color: "#fff" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "2rem", textAlign: "center" }}>
          <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>&#9888;</div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>System Error</h1>
          <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.5)", maxWidth: "24rem", marginBottom: "0.5rem" }}>
            A critical error occurred in the application. This has been logged automatically.
          </p>
          {error.digest && (
            <p style={{ fontSize: "0.625rem", fontFamily: "monospace", color: "rgba(255,255,255,0.2)", marginBottom: "1.5rem" }}>
              Ref: {error.digest}
            </p>
          )}
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={reset}
              style={{ padding: "0.625rem 1.5rem", borderRadius: "0.75rem", background: "#fff", color: "#000", fontWeight: 600, fontSize: "0.875rem", border: "none", cursor: "pointer" }}
            >
              Try Again
            </button>
            <a
              href="/overwatch/feed"
              style={{ padding: "0.625rem 1.5rem", borderRadius: "0.75rem", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)", fontSize: "0.875rem", textDecoration: "none" }}
            >
              Return to Base
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
