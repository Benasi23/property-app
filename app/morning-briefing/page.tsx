"use client";

import { useEffect, useState } from "react";

export default function MorningBriefing() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/morning-briefing")
      .then((res) => res.json())
      .then((json) => setData(json));
  }, []);

  if (!data) {
    return (
      <div className="p-6">
        Loading morning briefing...
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        🌅 Morning Briefing
      </h1>

      {/* SUMMARY */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Box
          label="Total Leads"
          value={data.summary.totalLeads}
        />
        <Box
          label="Critical"
          value={data.summary.critical}
          color="red"
        />
        <Box
          label="High Priority"
          value={data.summary.high}
          color="orange"
        />
        <Box
          label="Packs Out"
          value={data.summary.packsOut}
          color="blue"
        />
      </div>

      {/* TOP ACTIONS */}
      <h2 className="text-xl font-bold mb-3">
        🎯 Top Actions Today
      </h2>

      <div className="space-y-3">
        {data.topActions.map((lead: any) => (
          <div
            key={lead.id}
            className="border p-4 rounded bg-white"
          >
            <div className="font-bold">{lead.name}</div>

            <div className="text-sm text-gray-600">
              Stage: {lead.stage}
            </div>

            <div className="text-sm text-gray-600">
              Suggested action: {lead.action}
            </div>

            <div
              className={`text-sm font-bold ${
                lead.urgency === "critical"
                  ? "text-red-600"
                  : lead.urgency === "high"
                  ? "text-orange-500"
                  : lead.urgency === "medium"
                  ? "text-yellow-500"
                  : "text-green-600"
              }`}
            >
              Urgency: {lead.urgency}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Box({
  label,
  value,
  color = "gray",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="border p-4 rounded bg-white">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`text-2xl font-bold text-${color}-600`}>
        {value}
      </div>
    </div>
  );
}