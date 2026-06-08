import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { name, email, phone, property_id } = body;

    if (!name || !email || !phone || !property_id) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 1. Create lead
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        name,
        email,
        phone,
        property_id,
        status: "new",
      })
      .select()
      .single();

    if (leadError) {
      return NextResponse.json(
        { error: leadError.message },
        { status: 500 }
      );
    }

    // 2. Find agent
    const { data: agents, error: agentError } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "agent")
      .limit(1);

    if (agentError || !agents || agents.length === 0) {
      return NextResponse.json({
        success: true,
        lead,
        warning: "Lead created but no agent available",
      });
    }

    const agentId = agents[0].id;

    // 3. Auto assign lead
    const { data: updatedLead, error: updateError } = await supabase
      .from("leads")
      .update({
        agent_id: agentId,
        status: "assigned",
      })
      .eq("id", lead.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      lead: updatedLead,
      assigned_agent: agentId,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 }
    );
  }
}