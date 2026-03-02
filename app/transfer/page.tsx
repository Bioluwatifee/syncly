// app/transfer/page.tsx
// This will be the core product page where users:
// 1. Connect source platform
// 2. Select a playlist
// 3. Connect target platform
// 4. Run the transfer and see results
//
// Coming in the next build phase.

export default function TransferPage() {
  return (
    <main style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#0a0a0b",
      color: "#f0ede8",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 48, marginBottom: 16 }}>
          Transfer coming soon
        </h1>
        <p style={{ color: "#6b6870" }}>
          The actual transfer UI is in development. Check back soon.
        </p>
      </div>
    </main>
  );
}
