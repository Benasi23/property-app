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

  const scored = safeLeads.map((lead) => {
    const lastDate =
      lead.updated_at ||
      lead.pack_sent_date ||
      lead.created_at;

    const last = lastDate
      ? new Date(lastDate).getTime()
      : null;

    const daysSince = last
      ? Math.floor((now - last) / (1000 * 60 * 60 * 24))
      : 999;

    // 🎯 priority scoring system
    let score = 0;

    // stale penalty
    if (daysSince >= 15) score += 100;
    else if (daysSince >= 8) score += 60;
    else if (daysSince >= 4) score += 30;

    // pack_sent priority (money stage)
    if (lead.stage === "pack_sent") score += 40;

    // qualified leads are hot
    if (lead.stage === "qualified") score += 20;

    // no activity boost urgency
    if (!lead.updated_at) score += 10;

    return {
      ...lead,
      daysSince,
      score,
    };
  });

  // 🔥 sort highest priority first
  const queue = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 10); // top 10 actions only

  return NextResponse.json({
    success: true,
    queue,
  });
}