"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import toast from "react-hot-toast";
import {
  DndContext,
  DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  agent_id?: string | null;
};

type Agent = {
  id: string;
  full_name: string;
};

type Activity = {
  id: string;
  message: string;
  type: string;
  created_at: string;
};

const COLUMNS = ["new", "contacted", "assigned", "closed"];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    loadData();
    loadActivities();
    setupRealtime();
    setupActivityRealtime();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  /* ---------------- LOAD DATA ---------------- */

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

  async function loadActivities() {
    const res = await fetch("/api/activities");
    const data = await res.json();
    setActivities(data.activities || []);
  }

  /* ---------------- REALTIME LEADS ---------------- */

  function setupRealtime() {
    if (channelRef.current) return;

    const channel = supabase
      .channel("leads-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
        },
        (payload: any) => {
          const type = payload.eventType;

          if (type === "INSERT") toast.success("🆕 New lead added");
          if (type === "UPDATE") toast("✏️ Lead updated", { icon: "🔄" });
          if (type === "DELETE") toast.error("🗑️ Lead removed");

          refreshLeads();
        }
      )
      .subscribe();

    channelRef.current = channel;
  }

  /* ---------------- REALTIME ACTIVITIES ---------------- */

  function setupActivityRealtime() {
    supabase
      .channel("activity-feed")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "activities",
        },
        () => {
          loadActivities();
        }
      )
      .subscribe();
  }

  /* ---------------- REFRESH ---------------- */

  async function refreshLeads() {
    const res = await fetch("/api/leads");
    const data = await res.json();
    setLeads(data.leads || []);
  }

  /* ---------------- ACTIVITY LOG ---------------- */

  async function logActivity(message: string, type: string) {
    await supabase.from("activities").insert([
      {
        message,
        type,
      },
    ]);
  }

  /* ---------------- DRAG END ---------------- */

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over) return;

    const leadId = String(active.id);
    const targetId = String(over.id);

    // STATUS CHANGE
    if (COLUMNS.includes(targetId)) {
      await fetch("/api/updateLeadStatus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: leadId,
          status: targetId,
        }),
      });

      await logActivity(`Lead moved to ${targetId}`, "status");
      return;
    }

    // ASSIGN AGENT
    await fetch("/api/assignToAgent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId,
        agentId: targetId,
      }),
    });

    await logActivity("Lead assigned to agent", "assign");
  }

  /* ---------------- HELPERS ---------------- */

  function getByStatus(status: string) {
    return leads.filter((l) => l.status === status);
  }

  /* ---------------- UI ---------------- */

  return (
    <div className="flex min-h-screen bg-white text-black">
      {/* MAIN BOARD */}
      <div className="flex-1 p-6">
        <h1 className="text-2xl font-bold mb-6">
          🚀 CRM Pipeline
        </h1>

        {/* AGENTS */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {agents.map((a) => (
            <AgentBox key={a.id} agent={a} />
          ))}
        </div>

        {/* PIPELINE */}
        <DndContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-4 gap-4">
            {COLUMNS.map((col) => (
              <Column
                key={col}
                status={col}
                leads={getByStatus(col)}
              />
            ))}
          </div>
        </DndContext>
      </div>

      {/* ACTIVITY FEED */}
      <div className="w-80 border-l p-4">
        <h2 className="font-bold mb-3">
          📊 Activity Feed
        </h2>

        <div className="space-y-2">
          {activities.map((a) => (
            <div
              key={a.id}
              className="p-2 border rounded bg-gray-50 text-sm"
            >
              <div>{a.message}</div>
              <div className="text-xs text-gray-400">
                {new Date(a.created_at).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- COLUMN ---------------- */

function Column({ status, leads }: any) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div
      ref={setNodeRef}
      className={`p-3 border rounded min-h-[500px] ${
        isOver ? "bg-blue-100" : "bg-gray-100"
      }`}
    >
      <h2 className="font-bold mb-3">
        {status.toUpperCase()} ({leads.length})
      </h2>

      {leads.map((l: any) => (
        <LeadCard key={l.id} lead={l} />
      ))}
    </div>
  );
}

/* ---------------- LEAD CARD ---------------- */

function LeadCard({ lead }: any) {
  const { setNodeRef, listeners, attributes } = useDraggable({
    id: lead.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="bg-white border p-2 mb-2 rounded cursor-grab"
    >
      <div className="font-bold">{lead.name}</div>
      <div className="text-sm text-gray-600">
        {lead.email}
      </div>
      <div className="text-sm text-gray-600">
        {lead.phone}
      </div>
    </div>
  );
}

/* ---------------- AGENT BOX ---------------- */

function AgentBox({ agent }: any) {
  const { setNodeRef, isOver } = useDroppable({
    id: agent.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`p-3 border rounded text-center ${
        isOver ? "bg-green-200" : "bg-white"
      }`}
    >
      <div className="font-bold">{agent.full_name}</div>
      <div className="text-xs text-gray-500">
        Drop lead here
      </div>
    </div>
  );
}