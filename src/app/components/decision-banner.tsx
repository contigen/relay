"use client";

import { useState } from "react";

type DecisionBannerProps = {
  question: string;
  context?: string;
  options?: string[];
  onResolve: (reply: string) => Promise<void>;
};

export default function DecisionBanner({
  question,
  context,
  options = [],
  onResolve,
}: DecisionBannerProps) {
  const [customReply, setCustomReply] = useState("");
  const [busy, setBusy] = useState(false);

  const handleAction = async (val: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await onResolve(val);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-[#f59e0b] bg-white p-6 mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#d97706]">
          ACTION REQUIRED
        </span>
        <span className="text-[11px] font-mono text-[#737373]">
          HUMAN-IN-THE-LOOP
        </span>
      </div>

      <h3 className="font-serif text-2xl text-[#0a0a0a] font-normal tracking-tight my-2">
        {question}
      </h3>

      {context && (
        <p className="font-mono text-xs text-[#525252] leading-relaxed mb-4">
          {context}
        </p>
      )}

      {options.length > 0 ? (
        <div className="flex flex-wrap gap-2.5 pt-2">
          {options.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleAction(opt)}
              disabled={busy}
              className={`font-mono text-xs uppercase tracking-wider px-5 py-2.5 transition-colors ${
                i === 0
                  ? "bg-[#16a34a] hover:bg-[#15803d] text-white"
                  : "border border-[#e5e5e5] bg-white hover:bg-[#fafafa] text-[#0a0a0a]"
              }`}
            >
              {busy ? "RECORDING…" : opt}
            </button>
          ))}
        </div>
      ) : (
        <div className="pt-2 flex gap-2">
          <input
            type="text"
            value={customReply}
            onChange={(e) => setCustomReply(e.target.value)}
            placeholder="Type your instruction or reply..."
            className="flex-1 border border-[#e5e5e5] px-3 py-2 text-xs font-mono bg-[#fafafa] focus:bg-white outline-none focus:border-[#0a0a0a]"
          />
          <button
            onClick={() => handleAction(customReply || "Approved")}
            disabled={busy}
            className="bg-[#16a34a] hover:bg-[#15803d] text-white font-mono text-xs px-5 py-2 uppercase tracking-wider disabled:opacity-50"
          >
            {busy ? "SENDING…" : "SUBMIT"}
          </button>
        </div>
      )}
    </div>
  );
}
