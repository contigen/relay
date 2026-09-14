"use client";
import { useState } from "react";

type Decision = {
  _id: string;
  question: string;
  options: string[];
  context?: string;
};

export default function DecisionBanner({
  decision,
  onResolve,
}: {
  decision: Decision;
  onResolve: (reply: string) => Promise<void>;
}) {
  const [resolving, setResolving] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);

  const handle = async (opt: string) => {
    setChosen(opt);
    setResolving(true);
    await onResolve(opt);
    setResolving(false);
  };

  return (
    <div
      style={{
        padding: "14px 18px",
        background: "var(--accent)",
        borderBottom: "1px solid var(--accent-border)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
          <circle cx="8" cy="8" r="7" stroke="#fff" strokeWidth="1.5" />
          <path d="M8 5v3.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="11.5" r="0.75" fill="#fff" />
        </svg>
        <div style={{ flex: 1 }}>
          <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 500, color: "#fff" }}>
            Relay needs your input
          </p>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
            {decision.question}
          </p>
          {decision.context && (
            <p style={{ margin: "0 0 10px", fontSize: 12, color: "rgba(255,255,255,0.7)", fontStyle: "italic" }}>
              {decision.context}
            </p>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {decision.options.map((opt) => (
              <button
                key={opt}
                onClick={() => handle(opt)}
                disabled={resolving}
                style={{
                  padding: "6px 14px",
                  fontSize: 13,
                  fontWeight: 500,
                  background: chosen === opt ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.15)",
                  color: "#fff",
                  border: "1.5px solid rgba(255,255,255,0.4)",
                  borderRadius: 8,
                  cursor: resolving ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  transition: "background 0.1s",
                }}
              >
                {resolving && chosen === opt ? "Confirming…" : opt}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
