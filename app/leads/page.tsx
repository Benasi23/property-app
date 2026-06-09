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

const COLUMNS = ["enquiry", "qualified", "pack_sent", "contract", "settled"];

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

    const leadsRes = await l.json();
    const agentsRes = await a.json();

    console.log("LEADS:", leadsRes);
    console.log("AGENTS:", agentsRes);

    setLeads(leadsRes.leads || []);
    setAgents(agentsRes.agents || []);
  }

  async function loadActivities() {
    const res = await fetch("/api/activities");
    const data = await res.json();
    setActivities(data.data || data.activities || []);
  }

  /* ---------------- REALTIME ---------------- */

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
        () => {
          loadData();
        }
      )
      .subscribe();

    channelRef.current = channel;
  }

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

  /* ---------------- DRAG END ---------------- */

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const leadId = String(active.id);
    const target = String(over.id);

    // STATUS CHANGE
    if (COLUMNS.includes(target)) {
      await fetch("/api/updateLeadStatus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: leadId,
          status: target,
        }),
      });

      toast.success(`Moved to ${target}`);
      return;
    }

    // ASSIGN AGENT
    await fetch("/api/assignToAgent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId,
        agentId: target,
      }),
    });

    toast.success("Lead assigned");
  }

  /* ---------------- FILTER ---------------- */

  function getByStatus(status: string) {
    return leads.filter((l) => l.status === status);
  }

  /* ---------------- UI ---------------- */

  return (
    <div className="flex min-h-screen bg-white text-black">
      <div className="flex-1 p-6">
        <h1 className="text-2xl font-bold mb-6">
          🏢 Mirum Group CRM
        </h1>

        <div className="grid grid-cols-4 gap-4">
          <DndContext onDragEnd={handleDragEnd}>
            {COLUMNS.map((col) => (
              <Column
                key={col}
                status={col}
                leads={getByStatus(col)}
              />
            ))}
          </DndContext>
        </div>
      </div>

      <div className="w-80 border-l p-4">
        <h2 className="font-bold mb-3">Activity Feed</h2>

        {activities.map((a) => (
          <div key={a.id} className="p-2 border mb-2 text-sm">
            {a.message}
          </div>
        ))}
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
        {status} ({leads.length})
      </h2>

      {leads.map((lead: any) => (
        <LeadCard key={lead.id} lead={lead} />
      ))}
    </div>
  );
}

/* ---------------- CARD ---------------- */

function LeadCard({ lead }: any) {
  const { setNodeRef, listeners, attributes } = useDraggable({
    id: lead.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="p-2 mb-2 border bg-white rounded cursor-grab"
    >
      <div className="font-bold">{lead.name}</div>
      <div className="text-sm">{lead.email}</div>
      <div className="text-sm">{lead.phone}</div>
    </div>
  );
}