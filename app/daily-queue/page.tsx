"use client";

import { useEffect, useState } from "react";
import { reduceAsync, suggestedQueueAction, type AsyncPhase } from "@/lib/state";

type QueueLead = {
  id?: string;
  name?: string;
  stage?: string;
  score?: number;
  daysSince?: number;
};

type QueuePayload = { success?: boolean; error?: string; queue?: QueueLead[] };

export default function DailyQueuePage() {
  const [view, setView] = useState<AsyncPhase<QueuePayload>>({ phase: "idle" });

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setView((current) => reduceAsync(current, { type: "start" }));
    fetch("/api/daily-queue")
      .then(async (res) => {
        const json = (await res.json()) as QueuePayload;
        if (!res.ok || json.success === false) {
          throw new Error(json.error || "Could not load the daily queue");
        }
        return json;
      })
      .then((json) => {
        if (!cancelled) setView((current) => reduceAsync(current, { type: "succeed", data: json }));
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Could not load the daily queue";
          setView((current) => reduceAsync(current, { type: "fail", message }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (view.phase === "idle" || view.phase === "loading") {
    return <div className="p-6">Loading daily queue...</div>;
  }

  if (view.phase === "error") {
    return <div className="p-6 text-red-700">{view.message}</div>;
  }

  const queue = view.data.queue || [];

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-6">
        🔥 Daily Sales Queue
      </h1>

      <div className="space-y-3">
        {queue.length === 0 && (
          <p className="text-sm text-gray-500">Nothing is waiting in the queue.</p>
        )}
        {queue.map((lead, index) => (
          <div
            key={lead.id ?? index}
            className="border p-4 rounded bg-white"
          >
            <div className="flex justify-between">
              <div className="font-bold">
                #{index + 1} {lead.name}
              </div>

              <div className="text-sm font-bold text-red-600">
                Score: {lead.score}
              </div>
            </div>

            <div className="text-sm text-gray-600">
              Stage: {lead.stage}
            </div>

            <div className="text-sm text-gray-600">
              Days since activity: {lead.daysSince}
            </div>

            <div className="text-sm mt-1">
              Suggested action: {suggestedQueueAction(lead.stage)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}