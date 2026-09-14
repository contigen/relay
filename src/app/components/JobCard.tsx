"use client";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useSyncExternalStore } from "react";
import ThreadRow from "./ThreadRow";
import DecisionBanner from "./DecisionBanner";

const subscribeMinute = (callback: () => void) => {
  const interval = setInterval(callback, 60000);
  return () => clearInterval(interval);
};
const getNowSnapshot = () => Date.now();
const getServerSnapshot = () => 0;

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  received:        { label: "Received",         color: "var(--ink-muted)",      bg: "var(--border)",       dot: "#9a9a9a" },
  parsing:         { label: "Parsing task",      color: "var(--amber)",          bg: "var(--amber-soft)",   dot: "var(--amber)" },
  researching:     { label: "Researching",       color: "var(--accent)",         bg: "var(--accent-soft)",  dot: "var(--accent)" },
  outreaching:     { label: "Sending emails",    color: "var(--purple)",         bg: "var(--purple-soft)",  dot: "var(--purple)" },
  awaiting_replies:{ label: "Awaiting replies",  color: "var(--amber)",          bg: "var(--amber-soft)",   dot: "var(--amber)" },
  needs_decision:  { label: "Needs your input",  color: "#fff",                  bg: "var(--accent)",       dot: "#fff" },
  compiling:       { label: "Compiling results", color: "var(--accent)",         bg: "var(--accent-soft)",  dot: "var(--accent)" },
  completed:       { label: "Complete",          color: "var(--green)",          bg: "var(--green-soft)",   dot: "var(--green)" },
  failed:          { label: "Failed",            color: "var(--red)",            bg: "var(--red-soft)",     dot: "var(--red)" },
};

const ACTIVE_STATUSES = ["parsing", "researching", "outreaching", "awaiting_replies", "compiling"];

type Job = {
  _id: Id<"jobs">;
  rawTask: string;
  status: string;
  userEmail: string;
  agentInboxId?: string;
  agentEmail?: string;
  parsedIntent?: {
    description?: string;
    category?: string;
    location?: string;
    budget?: string;
    deadline?: string;
    targetCount?: number;
  };
  firecrawlResults?: Array<{ name: string; email?: string }>;
  summary?: string;
  createdAt: number;
  updatedAt: number;
};

export default function JobCard({
  job,
  selected,
  onSelect,
}: {
  job: Job;
  selected: boolean;
  onSelect: () => void;
}) {
  const threads = useQuery(api.threads.getThreadsByJob, { jobId: job._id }) ?? [];
  const pendingDecision = useQuery(api.decisions.getPendingDecision, { jobId: job._id });
  const resolveDecision = useMutation(api.decisions.resolveDecision);
  const compileSummary = useAction(api.agent.compileSummary);
  const now = useSyncExternalStore(subscribeMinute, getNowSnapshot, getServerSnapshot);

  const cfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.received;
  const isActive = ACTIVE_STATUSES.includes(job.status);
  const elapsed = now > 0 ? Math.max(0, Math.round((now - job.createdAt) / 60000)) : 0;



  const handleResolve = async (reply: string) => {
    if (!pendingDecision) return;
    await resolveDecision({ decisionId: pendingDecision._id, userReply: reply });
    const inboxId = job.agentInboxId ?? job.agentEmail;
    if (inboxId) {
      await compileSummary({
        jobId: job._id,
        userEmail: job.userEmail,
        jobDescription: job.parsedIntent?.description ?? job.rawTask,
        agentInboxId: inboxId,
      });
    }
  };

  return (
    <div
      style={{
        background: "var(--surface-raised)",
        border: `1px solid ${selected ? "var(--accent-border)" : "var(--border)"}`,
        borderRadius: 12,
        overflow: "hidden",
        transition: "border-color 0.15s",
        boxShadow: selected ? "0 0 0 3px var(--accent-soft)" : "none",
      }}
    >
      {/* Card header */}
      <div
        onClick={onSelect}
        style={{
          padding: "14px 18px",
          cursor: "pointer",
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
        }}
      >
        {/* Animated status dot */}
        <div style={{ paddingTop: 3, flexShrink: 0 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: cfg.dot,
              boxShadow: isActive ? `0 0 0 3px ${cfg.dot}30` : "none",
              animation: isActive ? "pulse 2s infinite" : "none",
            }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <p style={{ margin: 0, fontWeight: 500, fontSize: 14, color: "var(--ink)" }}>
              {job.parsedIntent?.description ?? job.rawTask.slice(0, 80)}
            </p>
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                padding: "2px 8px",
                borderRadius: 20,
                background: cfg.bg,
                color: cfg.color,
                whiteSpace: "nowrap",
              }}
            >
              {cfg.label}
            </span>
          </div>

          <div style={{ display: "flex", gap: 16, marginTop: 4, flexWrap: "wrap" }}>
            {job.parsedIntent?.category && (
              <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                {job.parsedIntent.category}
              </span>
            )}
            {job.parsedIntent?.location && (
              <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                📍 {job.parsedIntent.location}
              </span>
            )}
            {job.parsedIntent?.budget && (
              <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                💰 {job.parsedIntent.budget}
              </span>
            )}
            <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
              {elapsed < 1 ? "just now" : `${elapsed}m ago`}
            </span>
          </div>
        </div>

        {/* Thread count badge */}
        {threads.length > 0 && (
          <div style={{ flexShrink: 0, textAlign: "right" }}>
            <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
              {threads.filter((t) => t.status === "quote_received").length}/{threads.length} quoted
            </span>
          </div>
        )}

        {/* Expand chevron */}
        <div
          style={{
            flexShrink: 0,
            color: "var(--ink-muted)",
            transform: selected ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
            paddingTop: 2,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Expanded view */}
      {selected && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          {/* Decision banner */}
          {pendingDecision && (
            <DecisionBanner decision={pendingDecision} onResolve={handleResolve} />
          )}

          {/* Agent email */}
          {job.agentEmail && (
            <div
              style={{
                padding: "10px 18px",
                background: "var(--accent-soft)",
                borderBottom: "1px solid var(--accent-border)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="1" y="2.5" width="10" height="7" rx="1.5" stroke="var(--accent)" strokeWidth="1.2" />
                <path d="M1 4l5 3.5L11 4" stroke="var(--accent)" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <span style={{ fontSize: 12, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
                {job.agentEmail}
              </span>
              <span style={{ fontSize: 12, color: "var(--accent)", opacity: 0.7 }}>
                — agent inbox
              </span>
            </div>
          )}

          {/* Pipeline steps */}
          <PipelineSteps status={job.status} />

          {/* Vendor threads */}
          {threads.length > 0 && (
            <div style={{ padding: "0 18px 14px" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-muted)", letterSpacing: "0.06em", textTransform: "uppercase", margin: "14px 0 8px" }}>
                Vendor threads
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {threads.map((thread) => (
                  <ThreadRow key={thread._id} thread={thread} jobId={job._id} />
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {job.summary && (
            <div style={{ padding: "14px 18px", borderTop: "1px solid var(--border)" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-muted)", letterSpacing: "0.06em", textTransform: "uppercase", margin: "0 0 8px" }}>
                Summary sent to {job.userEmail}
              </p>
              <pre
                style={{
                  fontFamily: "var(--font-inter)",
                  fontSize: 13,
                  color: "var(--ink-secondary)",
                  whiteSpace: "pre-wrap",
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                {job.summary}
              </pre>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

function PipelineSteps({ status }: { status: string }) {
  const steps = [
    { key: "parsing",          label: "Parse task" },
    { key: "researching",      label: "Research vendors" },
    { key: "outreaching",      label: "Send outreach" },
    { key: "awaiting_replies", label: "Await replies" },
    { key: "compiling",        label: "Compile results" },
    { key: "completed",        label: "Done" },
  ];

  const order = steps.map((s) => s.key);
  const currentIdx = order.indexOf(status);

  return (
    <div style={{ padding: "12px 18px", display: "flex", alignItems: "center", gap: 0, overflowX: "auto" }}>
      {steps.map((step, i) => {
        const done = currentIdx > i;
        const active = currentIdx === i;
        return (
          <div key={step.key} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: done ? "var(--green)" : active ? "var(--accent)" : "var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {done ? (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: active ? "#fff" : "var(--border-strong)" }} />
                )}
              </div>
              <span style={{ fontSize: 10, color: done || active ? "var(--ink-secondary)" : "var(--ink-muted)", whiteSpace: "nowrap", fontWeight: active ? 500 : 400 }}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ width: 24, height: 1, background: done ? "var(--green)" : "var(--border)", flexShrink: 0, marginBottom: 16 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
