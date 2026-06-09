import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data: leads } = await supabase.from("leads").select("*");

  const safeLeads = leads || [];
  const now = Date.now();

  // -----------------------------
  // 1. GENERATE REMINDERS
  // -----------------------------
  const reminders: any[] = [];

  safeLeads.forEach((lead) => {
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

    if (lead.stage === "pack_sent" && daysSince >= 2) {
      reminders.push({
        lead_id: lead.id,
        type: "follow_up",
        message: `Follow up pack: ${lead.name}`,
      });
    }

    if (lead.stage === "qualified" && daysSince >= 1) {
      reminders.push({
        lead_id: lead.id,
        type: "call",
        message: `Call qualified lead: ${lead.name}`,
      });
    }

    if (daysSince >= 8) {
      reminders.push({
        lead_id: lead.id,
        type: "urgent",
        message: `Stale deal: ${lead.name}`,
      });
    }
  });

  if (reminders.length > 0) {
    await supabase.from("reminders").insert(reminders);
  }

  const packsOut = safeLeads.filter(
    (l) => l.stage === "pack_sent"
  ).length;

  return NextResponse.json({
    success: true,
    generatedReminders: reminders.length,
    packsOut,
    runAt: new Date().toISOString(),
  });
}