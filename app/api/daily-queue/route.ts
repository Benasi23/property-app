import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { activityAgeDays, queueInactivityPoints, queueStagePoints } from "@/lib/state";

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
    const daysSince = activityAgeDays(
      [lead.updated_at, lead.pack_sent_date, lead.created_at],
      now,
      999,
    );

    let score = queueInactivityPoints(daysSince ?? 999);
    score += queueStagePoints(lead.stage);
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