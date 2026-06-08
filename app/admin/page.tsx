"use client";

import { useEffect, useState } from "react";

type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  property_id: number;
  agent_id?: string;
};

type Agent = {
  id: string;
  full_name?: string;
  email?: string;
};

export default function AdminPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const [leadsRes, agentsRes] = await Promise.all([
      fetch("/api/leads"),
      fetch("/api/admin/agents"),
    ]);

    const leadsData = await leadsRes.json();
    const agentsData = await agentsRes.json();

    setLeads(leadsData.leads || []);
    setAgents(agentsData.agents || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const assignAgent = async (leadId: string, agentId: string) => {
    await fetch("/api/admin/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_id: leadId, agent_id: agentId }),
    });

    fetchData();
  };

  const stats = {
    total: leads.length,
    new: leads.filter(l => l.status === "new").length,
    contacted: leads.filter(l => l.status === "contacted").length,
    sold: leads.filter(l => l.status === "sold").length,
  };

  if (loading) return <p style={{ padding: 20 }}>Loading...</p>;

  return (
    <main style={{ padding: 20 }}>
      <h1>Admin Control Panel</h1>

      {/* STATS */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <div>Total: {stats.total}</div>
        <div>New: {stats.new}</div>
        <div>Contacted: {stats.contacted}</div>
        <div>Sold: {stats.sold}</div>
      </div>

      {/* LEADS TABLE */}
      <h2>All Leads</h2>

      <table border={1} cellPadding={8} style={{ width: "100%" }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Status</th>
            <th>Agent</th>
            <th>Assign</th>
          </tr>
        </thead>

        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id}>
              <td>{lead.name}</td>
              <td>{lead.email}</td>
              <td>{lead.phone}</td>
              <td>{lead.status}</td>

              <td>{lead.agent_id || "Unassigned"}</td>

              <td>
                <select
                  onChange={(e) =>
                    assignAgent(lead.id, e.target.value)
                  }
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select agent
                  </option>

                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.email || agent.id}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}