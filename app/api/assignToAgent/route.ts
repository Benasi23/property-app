import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  const { leadId, agentId } = await req.json();

  const { data, error } = await supabase
    .from("leads")
    .update({
      agent_id: agentId,
      status: "assigned",
    })
    .eq("id", leadId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
    });
  }

  return NextResponse.json({
    success: true,
    lead: data,
  });
}