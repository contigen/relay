"use client";
import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

const EXAMPLES = [
  "Find me 3 office cleaning services in Austin, weekly contract, roughly 2,000 sqft, under $500/month",
  "Get quotes from 3 caterers in NYC for a 40-person lunch on Oct 20, budget $1,200",
  "Source 3 freelance photographers in Chicago for a product shoot, budget $800, needed by end of month",
];

export default function NewJobModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [task, setTask] = useState("");
  const [loading, setLoading] = useState(false);
  const startPipeline = useAction(api.agent.startPipeline);

  const handleSubmit = async () => {
    if (!email.trim() || !task.trim()) return;
    setLoading(true);

    try {
      await startPipeline({ userEmail: email, rawTask: task });
      onClose();
    } catch (err) {
      console.error("Job creation failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          background: "var(--surface-raised)",
          borderRadius: 16,
          width: "100%",
          maxWidth: 520,
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          overflow: "hidden",
        }}
      >
        {/* Modal header */}
        <div
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>New sourcing job</p>
            <p style={{ margin: 0, fontSize: 12, color: "var(--ink-muted)" }}>
              Relay will research vendors and contact them on your behalf
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--ink-muted)", lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Email */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-secondary)", display: "block", marginBottom: 6 }}>
              Your email — Relay will send the final report here
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              style={{
                width: "100%",
                padding: "9px 12px",
                fontSize: 14,
                border: "1px solid var(--border-strong)",
                borderRadius: 8,
                fontFamily: "inherit",
                color: "var(--ink)",
                background: "var(--surface)",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Task */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-secondary)", display: "block", marginBottom: 6 }}>
              Describe your task — be specific about what, where, how many, budget
            </label>
            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Find me 3 office cleaning services in Austin…"
              rows={4}
              style={{
                width: "100%",
                padding: "9px 12px",
                fontSize: 14,
                border: "1px solid var(--border-strong)",
                borderRadius: 8,
                fontFamily: "inherit",
                color: "var(--ink)",
                background: "var(--surface)",
                outline: "none",
                resize: "vertical",
                lineHeight: 1.6,
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Examples */}
          <div>
            <p style={{ fontSize: 11, color: "var(--ink-muted)", margin: "0 0 6px" }}>Try an example:</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setTask(ex)}
                  style={{
                    textAlign: "left",
                    background: task === ex ? "var(--accent-soft)" : "var(--surface)",
                    border: `1px solid ${task === ex ? "var(--accent-border)" : "var(--border)"}`,
                    borderRadius: 7,
                    padding: "7px 10px",
                    fontSize: 12,
                    color: task === ex ? "var(--accent)" : "var(--ink-secondary)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    lineHeight: 1.5,
                  }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading || !email.trim() || !task.trim()}
            style={{
              width: "100%",
              padding: "11px",
              background: loading || !email.trim() || !task.trim() ? "var(--border)" : "var(--accent)",
              color: loading || !email.trim() || !task.trim() ? "var(--ink-muted)" : "#fff",
              border: "none",
              borderRadius: 9,
              fontSize: 14,
              fontWeight: 500,
              cursor: loading || !email.trim() || !task.trim() ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              transition: "background 0.15s",
            }}
          >
            {loading ? "Relay is working…" : "Start job"}
          </button>

          {loading && (
            <p style={{ margin: 0, fontSize: 12, color: "var(--accent)", textAlign: "center" }}>
              Parsing task → researching vendors → sending outreach emails…
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
