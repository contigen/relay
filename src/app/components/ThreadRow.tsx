"use client";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";

const THREAD_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:        { label: "Pending",        color: "var(--ink-muted)",  bg: "var(--border)" },
  sent:           { label: "Email sent",     color: "var(--accent)",     bg: "var(--accent-soft)" },
  replied:        { label: "Replied",        color: "var(--purple)",     bg: "var(--purple-soft)" },
  following_up:   { label: "Following up",   color: "var(--amber)",      bg: "var(--amber-soft)" },
  quote_received: { label: "Quote received", color: "var(--green)",      bg: "var(--green-soft)" },
  declined:       { label: "Declined",       color: "var(--red)",        bg: "var(--red-soft)" },
  no_response:    { label: "No response",    color: "var(--ink-muted)",  bg: "var(--border)" },
};

type Thread = {
  _id: Id<"threads">;
  vendorName: string;
  vendorEmail: string;
  status: string;
  quote?: string;
  notes?: string;
  lastActivity: number;
};

export default function ThreadRow({ thread, jobId }: { thread: Thread; jobId: Id<"jobs"> }) {
  const [expanded, setExpanded] = useState(false);
  const [simReply, setSimReply] = useState("");
  const [simulating, setSimulating] = useState(false);
  const messages = useQuery(api.threads.getMessagesByThread, { threadId: thread._id }) ?? [];
  const processReply = useAction(api.agent.processReply);
  const job = useQuery(api.jobs.getJob, { jobId });

  const cfg = THREAD_STATUS_CONFIG[thread.status] ?? THREAD_STATUS_CONFIG.pending;

  const handleSimulateReply = async () => {
    if (!simReply.trim() || !job) return;
    setSimulating(true);
    try {
      await processReply({
        jobId,
        threadId: thread._id,
        replyBody: simReply,
        vendorName: thread.vendorName,
        agentInboxId: job.agentInboxId ?? job.agentEmail ?? "demo",
        agentEmail: job.agentEmail ?? "relay@demo.to",
        vendorEmail: thread.vendorEmail,
        jobDescription: job.parsedIntent?.description ?? job.rawTask,
      });
      setSimReply("");
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
        background: "var(--surface)",
      }}
    >
      {/* Thread header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: "9px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          cursor: "pointer",
        }}
      >
        {/* Vendor avatar */}
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: "var(--accent-soft)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--accent)",
            flexShrink: 0,
          }}
        >
          {thread.vendorName.charAt(0).toUpperCase()}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>
            {thread.vendorName}
          </p>
          <p style={{ margin: 0, fontSize: 11, color: "var(--ink-muted)", fontFamily: "var(--font-mono)" }}>
            {thread.vendorEmail}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {thread.quote && (
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--green)" }}>
              {thread.quote}
            </span>
          )}
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              padding: "2px 7px",
              borderRadius: 20,
              background: cfg.bg,
              color: cfg.color,
              whiteSpace: "nowrap",
            }}
          >
            {cfg.label}
          </span>
          <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
            {messages.length} msg{messages.length !== 1 ? "s" : ""}
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s", color: "var(--ink-muted)" }}
          >
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Expanded: messages + demo reply */}
      {expanded && (
        <div style={{ borderTop: "1px solid var(--border)", background: "var(--surface-raised)" }}>
          {messages.length === 0 ? (
            <p style={{ padding: "12px 14px", fontSize: 12, color: "var(--ink-muted)", margin: 0 }}>
              No messages yet.
            </p>
          ) : (
            <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
              {messages.map((msg) => (
                <MessageBubble key={msg._id} message={msg} />
              ))}
            </div>
          )}

          {/* Demo reply simulator */}
          <div
            style={{
              padding: "10px 14px",
              borderTop: "1px solid var(--border)",
              background: "var(--amber-soft)",
            }}
          >
            <p style={{ fontSize: 11, color: "var(--amber)", fontWeight: 500, margin: "0 0 6px" }}>
              🎭 Demo: simulate a vendor reply
            </p>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={simReply}
                onChange={(e) => setSimReply(e.target.value)}
                placeholder={`Reply as ${thread.vendorName}...`}
                onKeyDown={(e) => e.key === "Enter" && handleSimulateReply()}
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  fontSize: 12,
                  border: "1px solid var(--border-strong)",
                  borderRadius: 6,
                  fontFamily: "inherit",
                  background: "#fff",
                  color: "var(--ink)",
                  outline: "none",
                }}
              />
              <button
                onClick={handleSimulateReply}
                disabled={simulating || !simReply.trim()}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 500,
                  background: simulating ? "var(--border)" : "var(--amber)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: simulating ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                }}
              >
                {simulating ? "Processing…" : "Send reply"}
              </button>
            </div>
            <p style={{ fontSize: 11, color: "var(--amber)", opacity: 0.8, margin: "5px 0 0" }}>
              Try: &quot;We can do it for $450/week, available from Monday&quot;
            </p>

          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: { direction: string; subject: string; body: string; timestamp: number } }) {
  const isOut = message.direction === "outbound";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isOut ? "flex-end" : "flex-start" }}>
      <div
        style={{
          maxWidth: "85%",
          padding: "8px 12px",
          borderRadius: isOut ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
          background: isOut ? "var(--accent)" : "var(--border)",
          color: isOut ? "#fff" : "var(--ink)",
        }}
      >
        <p style={{ margin: "0 0 2px", fontSize: 11, opacity: 0.75, fontWeight: 500 }}>
          {message.subject}
        </p>
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
          {message.body}
        </p>
      </div>
      <span style={{ fontSize: 10, color: "var(--ink-muted)", marginTop: 3 }}>
        {isOut ? "Agent →" : "← Vendor"} · {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </span>
    </div>
  );
}
