import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
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

      // 📦 PACK FOLLOW UPS
      if (lead.stage === "pack_sent" && daysSince >= 2) {
        reminders.push({
          lead_id: lead.id,
          type: "follow_up",
          message: `Follow up pack: ${lead.name}`,
        });
      }

      // 📞 QUALIFIED LEADS
      if (lead.stage === "qualified" && daysSince >= 1) {
        reminders.push({
          lead_id: lead.id,
          type: "call",
          message: `Call qualified lead: ${lead.name}`,
        });
      }

      // 🔥 STALE DEALS
      if (daysSince >= 8) {
        reminders.push({
          lead_id: lead.id,
          type: "urgent",
          message: `Stale deal: ${lead.name}`,
        });
      }
    });

    // optional: save reminders
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
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Cron failed",
      },
      { status: 500 }
    );
  }
}