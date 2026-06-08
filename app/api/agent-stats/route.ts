import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const { data: agents, error: agentsError } = await supabase
    .from("agents")
    .select("*");

  const { data: leads, error: leadsError } = await supabase
    .from("leads")
    .select("*");

  if (agentsError || leadsError) {
    return NextResponse.json({
      success: false,
      error: agentsError?.message || leadsError?.message,
    });
  }

  const stats = (agents || []).map((agent) => {
    const agentLeads = (leads || []).filter(
      (l) => l.agent_id === agent.id
    );

    return {
      agent_id: agent.id,
      name: agent.full_name,
      total: agentLeads.length,
      new: agentLeads.filter((l) => l.status === "new").length,
      contacted: agentLeads.filter((l) => l.status === "contacted").length,
      assigned: agentLeads.filter((l) => l.status === "assigned").length,
      closed: agentLeads.filter((l) => l.status === "closed").length,
    };
  });

  return NextResponse.json({
    success: true,
    stats,
  });
}