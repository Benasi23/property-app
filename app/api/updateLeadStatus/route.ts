import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  const { id, status } = await req.json();

  // update lead
  const { data, error } = await supabase
    .from("leads")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message });
  }

  // log activity
  await supabase.from("activities").insert({
    lead_id: id,
    type: "status_change",
    message: `Status changed to ${status}`,
  });

  // special tracking for pack_sent
  if (status === "pack_sent") {
    await supabase.from("activities").insert({
      lead_id: id,
      type: "pack_sent",
      message: "Pack sent to buyer",
    });
  }

  return NextResponse.json({
    success: true,
    lead: data,
  });
}