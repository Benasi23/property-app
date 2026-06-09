import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return Response.json(
        { success: false, error: "Missing Supabase environment variables" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Example safe query (adjust if your table differs)
    const { data: agents, error: agentsError } = await supabase
      .from("agents")
      .select("*");

    if (agentsError) {
      return Response.json(
        { success: false, error: agentsError.message },
        { status: 500 }
      );
    }

    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select("id, status, agent_id");

    if (leadsError) {
      return Response.json(
        { success: false, error: leadsError.message },
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