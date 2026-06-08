"use client";

import { useEffect, useState } from "react";

type AgentStat = {
  agent_id: string;
  name: string;
  total: number;
  new: number;
  contacted: number;
  assigned: number;
  closed: number;
};

export default function AgentsDashboard() {
  const [stats, setStats] = useState<AgentStat[]>([]);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    const res = await fetch("/api/agent-stats");
    const data = await res.json();
    setStats(data.stats || []);
  }

  return (
    <div className="p-6 bg-white min-h-screen text-black">
      <h1 className="text-2xl font-bold mb-6">
        👥 Agent Performance Dashboard
      </h1>

      <div className="grid grid-cols-3 gap-4">
        {stats.map((agent) => (
          <div
            key={agent.agent_id}
            className="border rounded p-4 shadow bg-gray-50"
          >
            <h2 className="font-bold text-lg mb-2">
              {agent.name}
            </h2>

            <div className="space-y-1 text-sm">
              <div>Total Leads: {agent.total}</div>
              <div>New: {agent.new}</div>
              <div>Contacted: {agent.contacted}</div>
              <div>Assigned: {agent.assigned}</div>
              <div>Closed: {agent.closed}</div>
            </div>

            {/* SIMPLE VISUAL BAR */}
            <div className="mt-3 h-2 bg-gray-200 rounded">
              <div
                className="h-2 bg-green-500 rounded"
                style={{
                  width:
                    agent.total === 0
                      ? "0%"
                      : `${(agent.closed / agent.total) * 100}%`,
                }}
              />
            </div>

            <div className="text-xs mt-1 text-gray-500">
              Close Rate
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}