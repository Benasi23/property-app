import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Missing Supabase env vars" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: leads } = await supabase.from("leads").select("*");

  const safe = leads || [];
  const now = Date.now();

  const reminders: any[] = [];

  safe.forEach((lead) => {
    const last = new Date(
      lead.updated_at || lead.created_at
    ).getTime();

    const days = Math.floor((now - last) / 86400000);

    if (days >= 2) {
      reminders.push({
        lead_id: lead.id,
        message: "Follow up: " + lead.name,
      });
    }
  });

  if (reminders.length > 0) {
    await supabase.from("reminders").insert(reminders);
  }

  return NextResponse.json({
    success: true,
    created: reminders.length,
  });
}