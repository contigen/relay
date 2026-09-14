"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

type SetupViewProps = {
  onPlanCreated: () => void;
};

type PlanPreview = {
  task: string;
};

export default function SetupView({ onPlanCreated }: SetupViewProps) {
  const [email, setEmail] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<PlanPreview | null>(null);

  const startPipeline = useAction(api.agent.startPipeline);

  const handleCreatePreview = (text: string) => {
    setInput(text);
    setPlan({ task: text });
  };

  const handleDispatch = async () => {
    if (!plan || loading) return;
    setLoading(true);
    try {
      await startPipeline({ userEmail: email, rawTask: plan.task });
      onPlanCreated();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 py-6">
      <div className="lg:col-span-4 space-y-6">
        <h2 className="font-serif text-3xl font-normal text-[#0a0a0a] tracking-tight">
          What your agent needs
        </h2>

        <div className="space-y-5 font-mono text-xs text-[#525252]">
          <div>
            <h4 className="font-semibold text-[#0a0a0a] uppercase tracking-wider text-[11px] mb-1">
              SOURCING SPECIFICATION
            </h4>
            <p className="leading-relaxed">
              Tell Relay what service or vendor you are looking for. It uses Firecrawl to discover matching vendors and their verified contact inboxes.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-[#0a0a0a] uppercase tracking-wider text-[11px] mb-1">
              BUDGET & CONSTRAINTS
            </h4>
            <p className="leading-relaxed">
              Define your price ceiling or timeline. Relay filters out misaligned providers and pushes for quotes that fit your requirements.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-[#0a0a0a] uppercase tracking-wider text-[11px] mb-1">
              HUMAN-IN-THE-LOOP SAFETY
            </h4>
            <p className="leading-relaxed">
              Relay acts autonomously for inquiry, initial follow-ups, and quote collation. If an ambiguous pricing choice arises, it asks you directly.
            </p>
          </div>
        </div>

        <div className="pt-6 border-t border-[#e5e5e5]">
          <span className="block text-[10px] font-mono uppercase tracking-wider text-[#8a8a8a] mb-2.5">
            EXAMPLE SPECIFICATIONS
          </span>
          <div className="space-y-2 font-mono text-xs">
            <button
              onClick={() => handleCreatePreview("Find me 3 office cleaning services in Austin, weekly contract, roughly 2,000 sqft, under $500/month")}
              className="w-full text-left p-2.5 border border-[#e5e5e5] bg-white hover:border-[#0a0a0a] text-[#525252] hover:text-[#0a0a0a] transition-colors"
            >
              &quot;Find me 3 office cleaning services in Austin, weekly contract, under $500/month&quot;
            </button>
            <button
              onClick={() => handleCreatePreview("Get quotes from 3 caterers in NYC for a 40-person lunch on Oct 20, budget $1,200")}
              className="w-full text-left p-2.5 border border-[#e5e5e5] bg-white hover:border-[#0a0a0a] text-[#525252] hover:text-[#0a0a0a] transition-colors"
            >
              &quot;Get quotes from 3 caterers in NYC for a 40-person lunch, budget $1,200&quot;
            </button>
          </div>
        </div>
      </div>

      <div className="lg:col-span-8 flex flex-col justify-between border border-[#e5e5e5] bg-white p-7 min-h-[560px]">
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-[#f0f0f0] mb-6">
            <h3 className="font-serif text-xl font-normal text-[#0a0a0a]">
              Setup your Sourcing Pipeline
            </h3>
            <span className="text-xs font-mono text-[#8a8a8a]">
              STAGE 1 OF 2
            </span>
          </div>

          <div className="space-y-4 font-mono text-xs">
            <div className="bg-[#f5f5f5] p-4 text-[#171717] max-w-xl leading-relaxed">
              Hi! I&apos;m Relay Sourcing Agent. Describe the services you need quoted, your target location, budget limits, and timeline. I&apos;ll parse the intent and coordinate quotes across multiple vendors.
            </div>

            {plan && (
              <div className="flex justify-end">
                <div className="bg-[#0a0a0a] text-white p-4 max-w-xl leading-relaxed">
                  {plan.task}
                </div>
              </div>
            )}

            {plan && (
              <div className="border border-[#e5e5e5] p-5 bg-[#fafafa] max-w-lg mt-4 space-y-3">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#16a34a] uppercase tracking-wider">
                  <span>✓</span> SPECIFICATION READY
                </div>
                <div className="space-y-2 text-xs text-[#525252] border-t border-[#e5e5e5] pt-2.5">
                  <div>
                    <span className="text-[#8a8a8a] block text-[10px] uppercase">Task Requirements:</span>
                    <p className="text-[#0a0a0a] font-mono mt-0.5 leading-relaxed">{plan.task}</p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-[#f0f0f0]">
                    <span className="text-[#8a8a8a]">Your Notification Email:</span>
                    <input
                      type="email"
                      required
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="text-right border-b border-[#a3a3a3] bg-transparent outline-none text-[#0a0a0a] px-1 py-0.5 font-mono text-xs w-52"
                    />
                  </div>
                </div>
                <button
                  onClick={handleDispatch}
                  disabled={loading || !email.trim()}
                  className="w-full mt-3 bg-[#0a0a0a] hover:bg-[#262626] text-white font-mono text-xs uppercase tracking-wider py-2.5 disabled:opacity-50 transition-colors"
                >
                  {loading ? "DISPATCHING AGENT PIPELINE…" : "LAUNCH SOURCING PIPELINE →"}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-[#f0f0f0] mt-6 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreatePreview(input)}
            placeholder="e.g., Find 3 office cleaning services in Austin under $500/mo..."
            className="flex-1 border border-[#e5e5e5] bg-[#fafafa] focus:bg-white px-3.5 py-2.5 font-mono text-xs outline-none focus:border-[#0a0a0a]"
          />
          <button
            onClick={() => handleCreatePreview(input)}
            className="bg-[#0a0a0a] hover:bg-[#262626] text-white font-mono text-xs uppercase px-5 py-2.5 tracking-wider"
          >
            PLAN
          </button>
        </div>
      </div>
    </div>
  );
}
