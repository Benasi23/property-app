"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  agent_id: string;
  created_at: string;
}

export default function MyLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLeads() {
      try {
        // STEP 1: Get current agent (TEMP LOGIC for now)
        const agentRes = await fetch("/api/agents");
        const agentData = await agentRes.json();

        const currentAgent = agentData.agents?.[0];

        if (!currentAgent) {
          setLoading(false);
          return;
        }

        // STEP 2: Get all leads
        const leadsRes = await fetch("/api/leads");
        const leadsData = await leadsRes.json();

        // STEP 3: Filter only leads for this agent
        const myLeads =
          leadsData.leads?.filter(
            (lead: Lead) => lead.agent_id === currentAgent.id
          ) || [];

        setLeads(myLeads);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadLeads();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">My Leads</h1>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : leads.length === 0 ? (
        <p className="text-gray-500">No leads assigned to you</p>
      ) : (
        <div className="overflow-x-auto bg-white shadow rounded">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-3 text-left">Name</th>
                <th className="border p-3 text-left">Email</th>
                <th className="border p-3 text-left">Phone</th>
                <th className="border p-3 text-left">Status</th>
                <th className="border p-3 text-left">Created</th>
              </tr>
            </thead>

            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="border p-3">
                    <Link
                      href={`/leads/${lead.id}`}
                      className="text-blue-600 underline"
                    >
                      {lead.name}
                    </Link>
                  </td>

                  <td className="border p-3">{lead.email}</td>
                  <td className="border p-3">{lead.phone}</td>

                  <td className="border p-3">
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm">
                      {lead.status}
                    </span>
                  </td>

                  <td className="border p-3">
                    {new Date(lead.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}