import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { data: agents, error: agentsError } = await supabase
      .from("agents")
      .select("*");

    if (agentsError) {
      return Response.json(
        {
          success: false,
          error: agentsError.message,
        },
        { status: 500 }
      );
    }

    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select("id, status, agent_id");

    if (leadsError) {
      return Response.json(
        {
          success: false,
          error: leadsError.message,
        },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      agents,
      leads,
    });
  } catch (err: any) {
    return Response.json(
      {
        success: false,
        error: err?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}