"use client";

import { useEffect, useState } from "react";

export default function StaleDealsPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/stale-deals")
      .then((res) => res.json())
      .then((json) => setData(json));
  }, []);

  if (!data) {
    return <div className="p-6">Loading stale deals...</div>;
  }

  const leads = data.leads || [];

  const critical = leads.filter(
    (l: any) => l.staleStatus === "critical"
  );
  const stale = leads.filter(
    (l: any) => l.staleStatus === "stale"
  );
  const warm = leads.filter(
    (l: any) => l.staleStatus === "warm"
  );

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-6">
        Stale Deal System
      </h1>

      {/* SUMMARY */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Box title="Critical" count={critical.length} color="red" />
        <Box title="Stale" count={stale.length} color="orange" />
        <Box title="Warm" count={warm.length} color="yellow" />
      </div>

      {/* LIST */}
      <div className="space-y-3">
        {leads.map((lead: any) => (
          <div key={lead.id} className="border p-3 rounded">
            <div className="font-bold">{lead.name}</div>

            <div className="text-sm">
              Days since activity:{" "}
              {lead.daysSince ?? "N/A"}
            </div>

            <div
              className={`text-sm font-bold ${
                lead.staleStatus === "critical"
                  ? "text-red-600"
                  : lead.staleStatus === "stale"
                  ? "text-orange-500"
                  : lead.staleStatus === "warm"
                  ? "text-yellow-500"
                  : "text-green-600"
              }`}
            >
              Status: {lead.staleStatus}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Box({
  title,
  count,
  color,
}: {
  title: string;
  count: number;
  color: string;
}) {
  return (
    <div className="border p-4 rounded bg-white">
      <div className="text-sm text-gray-500">{title}</div>
      <div className={`text-2xl font-bold text-${color}-600`}>
        {count}
      </div>
    </div>
  );
}