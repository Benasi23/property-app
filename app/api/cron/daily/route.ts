import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { activityAgeDays, leadStageMatches, reminderDraftsForLead } from "@/lib/state";

export async function GET() {
  const { data: leads } = await supabase.from("leads").select("*");

  const safeLeads = leads || [];
  const now = Date.now();

  // -----------------------------
  // 1. GENERATE REMINDERS
  // -----------------------------
  const reminders: any[] = [];

  safeLeads.forEach((lead) => {
    const daysSince = activityAgeDays(
      [lead.updated_at, lead.pack_sent_date, lead.created_at],
      now,
      999,
    );
    if (daysSince === null || Number.isNaN(daysSince)) return;
    reminders.push(...reminderDraftsForLead(lead, daysSince));
  });

  if (reminders.length > 0) {
    await supabase.from("reminders").insert(reminders);
  }

  const packsOut = safeLeads.filter((l) => leadStageMatches(l.stage, "pack_sent")).length;

  return NextResponse.json({
    success: true,
    generatedReminders: reminders.length,
    packsOut,
    runAt: new Date().toISOString(),
  });
}