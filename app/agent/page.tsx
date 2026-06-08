"use client";

import { useEffect, useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
} from "@hello-pangea/dnd";

type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  property_id: number;
};

export default function AgentDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);

  const fetchLeads = async () => {
    const res = await fetch("/api/leads");
    const data = await res.json();
    setLeads(data.leads || []);
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const columns = {
    new: leads.filter((l) => l.status === "new"),
    contacted: leads.filter((l) => l.status === "contacted"),
    sold: leads.filter((l) => l.status === "sold"),
    lost: leads.filter((l) => l.status === "lost"),
  };

  const updateStatus = async (leadId: string, status: string) => {
    await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_id: leadId, status }),
    });

    fetchLeads();
  };

  const onDragEnd = async (result: any) => {
    if (!result.destination) return;

    const leadId = result.draggableId;
    const newStatus = result.destination.droppableId;

    await updateStatus(leadId, newStatus);
  };

  return (
    <main style={{ padding: 20 }}>
      <h1>CRM Pipeline (Drag & Drop)</h1>

      <DragDropContext onDragEnd={onDragEnd}>
        <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
          {Object.entries(columns).map(([status, items]) => (
            <Droppable droppableId={status} key={status}>
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  style={{
                    flex: 1,
                    background: "#f4f4f4",
                    padding: 10,
                    minHeight: 500,
                    borderRadius: 8,
                  }}
                >
                  <h3 style={{ textTransform: "capitalize" }}>
                    {status} ({items.length})
                  </h3>

                  {items.map((lead, index) => (
                    <Draggable
                      key={lead.id}
                      draggableId={lead.id}
                      index={index}
                    >
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          style={{
                            padding: 10,
                            marginBottom: 10,
                            background: "white",
                            borderRadius: 6,
                            ...provided.draggableProps.style,
                          }}
                        >
                          <strong>{lead.name}</strong>
                          <p style={{ fontSize: 12 }}>{lead.phone}</p>
                        </div>
                      )}
                    </Draggable>
                  ))}

                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>

      {/* TABLE VIEW */}
      <div style={{ marginTop: 40 }}>
        <h2>All Leads</h2>

        <table border={1} cellPadding={8} style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Property</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td>{lead.name}</td>
                <td>{lead.email}</td>
                <td>{lead.phone}</td>
                <td>{lead.status}</td>
                <td>{lead.property_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}