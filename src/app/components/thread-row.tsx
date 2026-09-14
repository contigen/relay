"use client";

import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";

type MessageDoc = {
  _id: Id<"messages">;
  threadId: Id<"threads">;
  jobId: Id<"jobs">;
  direction: "outbound" | "inbound";
  subject: string;
  body: string;
  timestamp: number;
};

type ThreadDoc = {
  _id: Id<"threads">;
  jobId: Id<"jobs">;
  vendorName: string;
  vendorEmail: string;
  vendorUrl?: string;
  agentInboxId: string;
  agentEmail: string;
  status: "pending" | "sent" | "replied" | "following_up" | "quote_received" | "declined" | "no_response";
  quote?: string;
  notes?: string;
  lastActivity: number;
};

type ThreadRowProps = {
  thread: ThreadDoc;
  jobDescription?: string;
  agentInboxId: string;
  agentEmail: string;
};

const getBadgeStyle = (status: string) => {
  switch (status) {
    case "quote_received":
      return { label: "QUOTE", bg: "bg-[#ecfdf5]", text: "text-[#15803d]", border: "border-[#a7f3d0]" };
    case "replied":
      return { label: "REPLIED", bg: "bg-[#f5f3ff]", text: "text-[#7c3aed]", border: "border-[#ddd6fe]" };
    case "following_up":
      return { label: "FOLLOW UP", bg: "bg-[#fffbeb]", text: "text-[#b45309]", border: "border-[#fde68a]" };
    case "sent":
      return { label: "OUTREACH", bg: "bg-[#eff6ff]", text: "text-[#1d4ed8]", border: "border-[#bfdbfe]" };
    case "declined":
      return { label: "DECLINED", bg: "bg-[#fef2f2]", text: "text-[#b91c1c]", border: "border-[#fecaca]" };
    default:
      return { label: "PENDING", bg: "bg-[#f5f5f5]", text: "text-[#737373]", border: "border-[#e5e5e5]" };
  }
};

export default function ThreadRow({
  thread,
  jobDescription = "Sourcing services",
  agentInboxId,
  agentEmail,
}: ThreadRowProps) {
  const [open, setOpen] = useState(false);
  const [simulatedReply, setSimulatedReply] = useState("");
  const [simulating, setSimulating] = useState(false);

  const messages = (useQuery(api.threads.getMessagesByThread, { threadId: thread._id }) ?? []) as MessageDoc[];
  const processReply = useAction(api.agent.processReply);
  const badge = getBadgeStyle(thread.status);

  const handleSimulate = async () => {
    if (!simulatedReply.trim() || simulating) return;
    setSimulating(true);

    try {
      await processReply({
        jobId: thread.jobId,
        threadId: thread._id,
        replyBody: simulatedReply,
        vendorName: thread.vendorName,
        agentInboxId: agentInboxId || thread.agentInboxId,
        agentEmail: agentEmail || thread.agentEmail,
        vendorEmail: thread.vendorEmail,
        jobDescription,
      });
      setSimulatedReply("");
    } finally {
      setSimulating(false);
    }
  };

  const formattedDate = new Date(thread.lastActivity).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  const shortHash = `0x${thread._id.slice(-4)}…${thread._id.slice(-4)}`;

  return (
    <div className="border-b border-[#f0f0f0] last:border-b-0">
      <div
        onClick={() => setOpen(!open)}
        className="py-4 px-2 flex items-center justify-between gap-4 cursor-pointer hover:bg-[#fafafa] transition-colors"
      >
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <span
            className={`text-[10px] font-mono font-medium px-2 py-0.5 border ${badge.bg} ${badge.text} ${badge.border} tracking-wider uppercase shrink-0`}
          >
            {badge.label}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-[#0a0a0a]">
                {thread.vendorName}
              </span>
              {thread.vendorUrl && (
                <a
                  href={thread.vendorUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-[10px] font-mono text-[#a3a3a3] hover:text-[#0a0a0a]"
                >
                  ↗
                </a>
              )}
            </div>
            <p className="text-xs font-mono text-[#737373] truncate mt-0.5">
              {thread.notes || thread.vendorEmail}
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className="font-serif text-base font-normal text-[#0a0a0a] block leading-none">
            {thread.quote || "—"}
          </span>
          <span className="text-[11px] font-mono text-[#16a34a] mt-1 block">
            {thread.status === "quote_received" ? "VERIFIED" : thread.status}
          </span>
        </div>

        <div className="text-right shrink-0 min-w-[90px] hidden sm:block">
          <span className="text-xs font-mono text-[#737373] block">
            {formattedDate}
          </span>
          <span className="text-[10px] font-mono text-[#a3a3a3] block mt-0.5">
            {shortHash}
          </span>
        </div>
      </div>

      {open && (
        <div className="bg-[#fafafa] border-t border-[#f0f0f0] p-4 space-y-3 font-mono text-xs">
          {messages.length === 0 && (
            <p className="text-[#a3a3a3] italic">No messages exchanged yet.</p>
          )}

          {messages.map((m) => {
            const isOut = m.direction === "outbound";
            return (
              <div
                key={m._id}
                className={`flex flex-col ${isOut ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] p-3.5 border ${
                    isOut
                      ? "bg-[#ffffff] border-[#e5e5e5] text-[#0a0a0a]"
                      : "bg-[#0a0a0a] border-[#0a0a0a] text-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-1.5 opacity-60 text-[10px]">
                    <span>{isOut ? `Relay → ${thread.vendorName}` : `${thread.vendorName} → Relay`}</span>
                    <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                </div>
              </div>
            );
          })}

          <div className="mt-4 pt-3 border-t border-[#e5e5e5] bg-[#fffbeb] p-3 border border-[#fde68a]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-semibold tracking-wider text-[#b45309]">
                Interactive Simulator (Demo)
              </span>
              <span className="text-[10px] text-[#92400e]">
                Simulate vendor email reply
              </span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={simulatedReply}
                onChange={(e) => setSimulatedReply(e.target.value)}
                placeholder='e.g., "We can do it for $450/week, available from Monday"'
                className="flex-1 bg-white border border-[#fde68a] px-3 py-1.5 text-xs font-mono text-[#0a0a0a] outline-none focus:border-[#b45309]"
              />
              <button
                onClick={handleSimulate}
                disabled={simulating || !simulatedReply.trim()}
                className="bg-[#b45309] hover:bg-[#92400e] text-white font-mono text-xs px-4 py-1.5 uppercase tracking-wider disabled:opacity-50"
              >
                {simulating ? "SIMULATING…" : "DISPATCH"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
