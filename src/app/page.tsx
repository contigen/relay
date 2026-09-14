"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import JobCard from "./components/JobCard";
import NewJobModal from "./components/NewJobModal";
import EmptyState from "./components/EmptyState";

export default function Home() {
  const jobs = useQuery(api.jobs.listJobs, {}) ?? [];
  const [showNew, setShowNew] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Id<"jobs"> | null>(null);

  const activeJobs = jobs.filter((j) =>
    !["completed", "failed"].includes(j.status)
  );
  const doneJobs = jobs.filter((j) =>
    ["completed", "failed"].includes(j.status)
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--surface)" }}>
      {/* Header */}
      <header
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--surface-raised)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "0 24px",
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect width="22" height="22" rx="6" fill="var(--accent)" />
              <path d="M6 11h10M11 6l5 5-5 5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: "-0.01em" }}>
              relay
            </span>
            <span
              style={{
                fontSize: 11,
                color: "var(--ink-muted)",
                background: "var(--border)",
                padding: "1px 7px",
                borderRadius: 20,
                fontWeight: 500,
              }}
            >
              email-native agent
            </span>
          </div>
          <button
            onClick={() => setShowNew(true)}
            style={{
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "7px 16px",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
            New job
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        {jobs.length === 0 ? (
          <EmptyState onNew={() => setShowNew(true)} />
        ) : (
          <>
            {activeJobs.length > 0 && (
              <section style={{ marginBottom: 40 }}>
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--ink-muted)",
                    letterSpacing: "0.07em",
                    textTransform: "uppercase",
                    marginBottom: 12,
                  }}
                >
                  Active · {activeJobs.length}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {activeJobs.map((job) => (
                    <JobCard
                      key={job._id}
                      job={job}
                      selected={selectedJob === job._id}
                      onSelect={() =>
                        setSelectedJob(selectedJob === job._id ? null : job._id)
                      }
                    />
                  ))}
                </div>
              </section>
            )}

            {doneJobs.length > 0 && (
              <section>
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--ink-muted)",
                    letterSpacing: "0.07em",
                    textTransform: "uppercase",
                    marginBottom: 12,
                  }}
                >
                  Completed · {doneJobs.length}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {doneJobs.map((job) => (
                    <JobCard
                      key={job._id}
                      job={job}
                      selected={selectedJob === job._id}
                      onSelect={() =>
                        setSelectedJob(selectedJob === job._id ? null : job._id)
                      }
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {showNew && <NewJobModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
