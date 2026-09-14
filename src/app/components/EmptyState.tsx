export default function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        textAlign: "center",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: "var(--accent-soft)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
          <rect x="2" y="4" width="22" height="15" rx="3" stroke="var(--accent)" strokeWidth="1.8" />
          <path d="M2 8l11 8 11-8" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M18 20h6M21 17v6" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </div>
      <div>
        <p style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 500, color: "var(--ink)" }}>
          No active jobs
        </p>
        <p style={{ margin: 0, fontSize: 14, color: "var(--ink-muted)", maxWidth: 340, lineHeight: 1.6 }}>
          Send a task email to your Relay address, or create one here. The agent will research vendors, reach out, and report back.
        </p>
      </div>
      <button
        onClick={onNew}
        style={{
          marginTop: 8,
          padding: "9px 20px",
          background: "var(--accent)",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 500,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        Create your first job
      </button>
      <div
        style={{
          marginTop: 24,
          padding: "14px 20px",
          background: "var(--surface-raised)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          maxWidth: 420,
          textAlign: "left",
        }}
      >
        <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "var(--ink-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Example tasks
        </p>
        {[
          "Find me 3 office cleaning services in Austin, weekly contract, under $500/mo",
          "Get quotes from 3 caterers in NYC for a 40-person lunch on Oct 20, budget $1,200",
          "Source 3 freelance photographers in Chicago for a product shoot next month",
        ].map((ex, i) => (
          <p key={i} style={{ margin: "0 0 6px", fontSize: 12, color: "var(--ink-secondary)", lineHeight: 1.5 }}>
            <span style={{ color: "var(--ink-muted)", marginRight: 6 }}>→</span>
            {ex}
          </p>
        ))}
      </div>
    </div>
  );
}
