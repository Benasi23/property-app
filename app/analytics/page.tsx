"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

type Lead = {
  id: string;
  status: string;
  agent_id: string;
};

type Agent = {
  id: string;
  full_name: string;
};

const COLORS = ["#60a5fa", "#fbbf24", "#34d399", "#f87171"];

export default function AnalyticsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [l, a] = await Promise.all([
      fetch("/api/leads"),
      fetch("/api/agents"),
    ]);

    const leadsData = await l.json();
    const agentsData = await a.json();

    setLeads(leadsData.leads || []);
    setAgents(agentsData.agents || []);
  }

  /* ---------------- STATUS FUNNEL ---------------- */

  const statusData = ["new", "contacted", "assigned", "closed"].map(
    (status) => ({
      name: status,
      value: leads.filter((l) => l.status === status).length,
    })
  );

  /* ---------------- AGENT PERFORMANCE ---------------- */

  const agentData = agents.map((a) => {
    const assigned = leads.filter((l) => l.agent_id === a.id);

    return {
      name: a.full_name,
      total: assigned.length,
      closed: assigned.filter((l) => l.status === "closed").length,
    };
  });

  return (
    <div className="p-6 bg-white min-h-screen text-black">
      <h1 className="text-2xl font-bold mb-6">
        📊 CRM Analytics Dashboard
      </h1>

      {/* STATUS FUNNEL */}
      <div className="mb-10">
        <h2 className="font-bold mb-3">
          Lead Status Funnel
        </h2>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusData}
                dataKey="value"
                nameKey="name"
                outerRadius={100}
                label
              >
                {statusData.map((_, i) => (
                  <Cell
                    key={i}
                    fill={COLORS[i % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* AGENT PERFORMANCE */}
      <div>
        <h2 className="font-bold mb-3">
          Agent Performance (Closed Deals)
        </h2>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={agentData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total" fill="#60a5fa" />
              <Bar dataKey="closed" fill="#34d399" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}