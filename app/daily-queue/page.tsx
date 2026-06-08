"use client";

import { useEffect, useState } from "react";

export default function DailyQueuePage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/daily-queue")
      .then((res) => res.json())
      .then((json) => setData(json));
  }, []);

  if (!data) {
    return <div className="p-6">Loading daily queue...</div>;
  }

  const queue = data.queue || [];

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-6">
        🔥 Daily Sales Queue
      </h1>

      <div className="space-y-3">
        {queue.map((lead: any, index: number) => (
          <div
            key={lead.id}
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
              Suggested action:{" "}
              {lead.stage === "pack_sent"
                ? "Follow up pack"
                : lead.stage === "qualified"
                ? "Call & convert"
                : "Check status"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}