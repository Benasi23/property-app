import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { activityAgeDays, freshnessFromDays } from "@/lib/state";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const { data: leads, error } = await supabase
    .from("leads")
    .select("*");

  if (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
    });
  }

  const safeLeads = leads || [];
  const now = Date.now();

  const enriched = safeLeads.map((lead) => {
    const daysSince = activityAgeDays(
      [lead.updated_at, lead.pack_sent_date, lead.created_at],
      now,
      null,
    );

    return {
      ...lead,
      daysSince,
      staleStatus: freshnessFromDays(daysSince),
    };
  });

  return NextResponse.json({
    success: true,
    leads: enriched,
  });
}