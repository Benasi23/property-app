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

    let urgency = "low";

    if (daysSince >= 15) urgency = "critical";
    else if (daysSince >= 8) urgency = "high";
    else if (daysSince >= 4) urgency = "medium";

    let action = "Check status";

    if (lead.stage === "pack_sent")
      action = "Follow up pack";
    else if (lead.stage === "qualified")
      action = "Call & convert";
    else if (lead.stage === "enquiry")
      action = "Initial contact";

    return {
      ...lead,
      daysSince,
      urgency,
      action,
    };
  });

  // 🔥 PRIORITY FILTERS

  const critical = enriched.filter(
    (l) => l.urgency === "critical"
  );

  const high = enriched.filter((l) => l.urgency === "high");

  const packsOut = enriched.filter(
    (l) => l.stage === "pack_sent"
  );

  const topActions = enriched
    .sort((a, b) => {
      const scoreA =
        (a.urgency === "critical" ? 100 : 0) +
        (a.stage === "pack_sent" ? 40 : 0);

      const scoreB =
        (b.urgency === "critical" ? 100 : 0) +
        (b.stage === "pack_sent" ? 40 : 0);

      return scoreB - scoreA;
    })
    .slice(0, 5);

  return NextResponse.json({
    success: true,
    summary: {
      totalLeads: enriched.length,
      critical: critical.length,
      high: high.length,
      packsOut: packsOut.length,
    },
    topActions,
  });
}