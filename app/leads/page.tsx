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
  stage: string;
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

// ✅ SINGLE SOURCE OF TRUTH
const COLUMNS = [
  "enquiry",
  "qualified",
  "pack_sent",
  "contract",
  "settled",
];

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

  async function refreshLeads() {
    const res = await fetch("/api/leads");
    const data = await res.json();
    setLeads(data.leads || []);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const leadId = String(active.id);
    const targetStage = String(over.id);

    if (COLUMNS.includes(targetStage)) {
      await fetch("/api/updateLeadStatus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: leadId,
          stage: targetStage,
        }),
      });

      toast.success(`Moved to ${targetStage}`);
      return;
    }

    await fetch("/api/assignToAgent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId,
        agentId: targetStage,
      }),
    });

    toast.success("Lead assigned");
  }

  function getByStatus(stage: string) {
    return leads.filter((l) => l.stage === stage);
  }

  return (
    <div className="flex min-h-screen bg-white text-black">
      <div className="flex-1 p-6">
        <h1 className="text-2xl font-bold mb-6">CRM Pipeline</h1>

        <DndContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-5 gap-4">
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

      <div className="w-80 border-l p-4">
        <h2 className="font-bold mb-3">Activity</h2>

        <div className="space-y-2">
          {activities.map((a) => (
            <div key={a.id} className="p-2 border rounded text-sm">
              {a.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

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
      <div className="text-sm">{lead.email}</div>
      <div className="text-sm">{lead.phone}</div>
    </div>
  );
}