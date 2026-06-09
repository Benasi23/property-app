import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

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

    let score = 0;

    if (daysSince >= 15) score += 100;
    else if (daysSince >= 8) score += 60;
    else if (daysSince >= 4) score += 30;

    if (lead.stage === "pack_sent") score += 40;
    if (lead.stage === "qualified") score += 20;
    if (!lead.updated_at) score += 10;

    return {
      ...lead,
      daysSince,
      score,
    };
  });

  const queue = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return NextResponse.json({
    success: true,
    queue,
  });
}