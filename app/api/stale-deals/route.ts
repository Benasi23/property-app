import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
    // fallback logic:
    const lastDate =
      lead.updated_at ||
      lead.pack_sent_date ||
      lead.created_at;

    const last = lastDate ? new Date(lastDate).getTime() : null;

    const daysSince = last
      ? Math.floor((now - last) / (1000 * 60 * 60 * 24))
      : null;

    let status = "fresh";

    if (daysSince === null) status = "unknown";
    else if (daysSince >= 15) status = "critical";
    else if (daysSince >= 8) status = "stale";
    else if (daysSince >= 4) status = "warm";

    return {
      ...lead,
      daysSince,
      staleStatus: status,
    };
  });

  return NextResponse.json({
    success: true,
    leads: enriched,
  });
}