import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const lead_id = body.lead_id;

    if (!lead_id) {
      return NextResponse.json(
        { error: "Missing lead_id" },
        { status: 400 }
      );
    }

    // Get available agent
    const { data: agents, error: agentError } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "agent")
      .limit(1);

    if (agentError) {
      return NextResponse.json(
        { error: agentError.message },
        { status: 500 }
      );
    }

    if (!agents || agents.length === 0) {
      return NextResponse.json(
        { error: "No agents found" },
        { status: 404 }
      );
    }

    const agentId = agents[0].id;

    // Update lead
    const { data, error } = await supabase
      .from("leads")
      .update({
        agent_id: agentId,
        status: "assigned"
      })
      .eq("id", lead_id)
      .select();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      assigned_agent: agentId,
      lead: data
    });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 }
    );
  }
}