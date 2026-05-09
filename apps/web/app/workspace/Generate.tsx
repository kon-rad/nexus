"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

type FalJob = {
   _id: string;
   endpointId: string;
   displayName?: string;
   category?: string;
   input: Record<string, unknown>;
   status: "queued" | "in_progress" | "completed" | "error" | "cancelled" | string;
   queuePosition?: number;
   output?: Record<string, unknown>;
   outputKind?: "image" | "video" | "audio" | "text" | "3d" | "json" | string;
   errorMessage?: string;
   createdAt: number;
   completedAt?: number;
};

/**
 * Generate tab. Subscribes to falJobs.bySession and renders one card per
 * invocation. The card's body morphs based on outputKind so a video model and
 * a text model both feel native.
 *
 * If no session is active, we render a placeholder so the panel never looks
 * empty on first paint — same pattern as Insights / Live Preview.
 */
export function Generate({ sessionId }: { sessionId: string | null }) {
   const jobsRaw = useQuery(
      api.falJobs.bySession,
      sessionId ? { sessionId: sessionId as Id<"sessions"> } : "skip",
   );
   const jobs: ReadonlyArray<FalJob> = useMemo(
      () => (jobsRaw as FalJob[] | undefined) ?? [],
      [jobsRaw],
   );

   if (!sessionId || jobs.length === 0) {
      return <Placeholder />;
   }

   return (
      <div
         style={{
            height: "100%",
            overflowY: "auto",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
         }}
      >
         {jobs.map((job) => (
            <JobCard key={job._id} job={job} />
         ))}
      </div>
   );
}

function JobCard({ job }: { job: FalJob }) {
   const promptText =
      typeof (job.input as { prompt?: unknown }).prompt === "string"
         ? ((job.input as { prompt: string }).prompt)
         : undefined;

   return (
      <div
         style={{
            border: "1px solid var(--border-subtle)",
            borderRadius: 14,
            background: "var(--bg-elevated)",
            padding: "16px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
         }}
      >
         <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
               <div
                  style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}
               >
                  {job.displayName ?? job.endpointId}
               </div>
               <div
                  className="mono"
                  style={{ fontSize: 11, color: "var(--text-tertiary)" }}
               >
                  {job.endpointId}
                  {job.category ? ` · ${job.category}` : ""}
               </div>
            </div>
            <StatusPill status={job.status} queuePosition={job.queuePosition} />
         </div>

         {promptText ? (
            <div
               style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  lineHeight: 1.5,
                  background: "var(--bg-canvas)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 8,
                  padding: "8px 10px",
               }}
            >
               {promptText}
            </div>
         ) : null}

         <OutputView job={job} />
      </div>
   );
}

function StatusPill({
   status,
   queuePosition,
}: {
   status: string;
   queuePosition: number | undefined;
}) {
   const label =
      status === "queued"
         ? queuePosition !== undefined
            ? `queued · #${queuePosition}`
            : "queued"
         : status === "in_progress"
         ? "running"
         : status;
   const color =
      status === "completed"
         ? "var(--text-success)"
         : status === "error"
         ? "var(--text-danger)"
         : "var(--accent-purple)";
   return (
      <span
         style={{
            fontSize: 10.5,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "3px 9px",
            borderRadius: 999,
            border: `1px solid ${color}`,
            color,
            whiteSpace: "nowrap",
            flexShrink: 0,
         }}
      >
         {label}
      </span>
   );
}

function OutputView({ job }: { job: FalJob }) {
   if (job.status === "error") {
      return (
         <div style={{ fontSize: 12.5, color: "var(--text-danger)" }}>
            {job.errorMessage ?? "Generation failed."}
         </div>
      );
   }
   if (job.status !== "completed" || !job.output) {
      return (
         <div style={{ fontSize: 12.5, color: "var(--text-tertiary)" }}>
            Waiting for output…
         </div>
      );
   }
   const kind = job.outputKind ?? "json";
   switch (kind) {
      case "image":
         return <ImageOutput output={job.output} />;
      case "video":
         return <VideoOutput output={job.output} />;
      case "audio":
         return <AudioOutput output={job.output} />;
      case "text":
         return <TextOutput output={job.output} />;
      case "3d":
         return <ThreeDOutput output={job.output} />;
      default:
         return <JsonOutput output={job.output} />;
   }
}

function pickUrl(value: unknown): string | undefined {
   if (Array.isArray(value) && value.length > 0) {
      const head = value[0];
      if (typeof head === "string") return head;
      if (head && typeof head === "object" && "url" in head) {
         const u = (head as { url?: unknown }).url;
         if (typeof u === "string") return u;
      }
   }
   if (value && typeof value === "object" && "url" in value) {
      const u = (value as { url?: unknown }).url;
      if (typeof u === "string") return u;
   }
   if (typeof value === "string") return value;
   return undefined;
}

function ImageOutput({ output }: { output: Record<string, unknown> }) {
   const url = pickUrl(output.images) ?? pickUrl(output.image);
   if (!url) return <JsonOutput output={output} />;
   return (
      <a href={url} target="_blank" rel="noreferrer" style={{ display: "block" }}>
         <img
            src={url}
            alt=""
            style={{
               width: "100%",
               maxHeight: 480,
               objectFit: "contain",
               borderRadius: 10,
               background: "var(--bg-canvas)",
            }}
         />
      </a>
   );
}

function VideoOutput({ output }: { output: Record<string, unknown> }) {
   const url = pickUrl(output.video) ?? pickUrl(output.videos);
   if (!url) return <JsonOutput output={output} />;
   return (
      <video
         controls
         src={url}
         style={{ width: "100%", maxHeight: 480, borderRadius: 10, background: "#000" }}
      />
   );
}

function AudioOutput({ output }: { output: Record<string, unknown> }) {
   const url =
      pickUrl(output.audio) ??
      (typeof output.audio_url === "string" ? output.audio_url : undefined);
   if (!url) return <JsonOutput output={output} />;
   return <audio controls src={url} style={{ width: "100%" }} />;
}

function TextOutput({ output }: { output: Record<string, unknown> }) {
   const text =
      typeof output.text === "string"
         ? output.text
         : typeof output.output === "string"
         ? output.output
         : "";
   return (
      <div
         style={{
            fontSize: 13.5,
            lineHeight: 1.6,
            color: "var(--text-primary)",
            whiteSpace: "pre-wrap",
         }}
      >
         {text}
      </div>
   );
}

function ThreeDOutput({ output }: { output: Record<string, unknown> }) {
   const url =
      pickUrl(output.model_mesh) ??
      (typeof output.glb_url === "string" ? output.glb_url : undefined);
   if (!url) return <JsonOutput output={output} />;
   return (
      <a
         href={url}
         target="_blank"
         rel="noreferrer"
         className="mono"
         style={{
            fontSize: 12,
            color: "var(--accent-cyan)",
            textDecoration: "underline",
         }}
      >
         Download 3D model (.glb)
      </a>
   );
}

function JsonOutput({ output }: { output: Record<string, unknown> }) {
   return (
      <pre
         className="mono"
         style={{
            fontSize: 11.5,
            background: "var(--bg-canvas)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            padding: 10,
            color: "var(--text-secondary)",
            overflowX: "auto",
            maxHeight: 320,
         }}
      >
         {JSON.stringify(output, null, 2)}
      </pre>
   );
}

function Placeholder() {
   return (
      <div
         style={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
         }}
      >
         <div style={{ maxWidth: 460, textAlign: "center" }}>
            <h3
               style={{
                  fontSize: 18,
                  fontWeight: 600,
                  margin: "0 0 10px",
                  letterSpacing: "-0.01em",
               }}
            >
               Ask Nexus to generate something
            </h3>
            <p
               style={{
                  color: "var(--text-secondary)",
                  fontSize: 13.5,
                  lineHeight: 1.6,
                  margin: 0,
               }}
            >
               Try "make me an image of a cyberpunk city at sunset" or "generate a
               5-second video of a hummingbird". Nexus will pick the right fal.ai
               model and the result will appear here.
            </p>
         </div>
      </div>
   );
}
