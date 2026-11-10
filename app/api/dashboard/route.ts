import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { countDashboardBuckets } from "@/lib/state";

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

    const safe = leads || [];

    const totalLeads = safe.length;

    const buckets = countDashboardBuckets(safe);
    const enquiry = buckets.enquiry;
    const qualified = buckets.qualified;
    const packSent = buckets.pack_sent;
    const contract = buckets.contract;
    const settled = buckets.settled;

    const conversionRate =
      totalLeads > 0 ? (settled / totalLeads) * 100 : 0;

    const pipelineValue = qualified * 250000;
    const projectedRevenue = settled * 250000;

    const last7Days = safe.filter((l) => {
      const date = new Date(l.created_at).getTime();
      const now = Date.now();
      return now - date < 7 * 24 * 60 * 60 * 1000;
    }).length;

    return NextResponse.json({
      success: true,
      metrics: {
        totalLeads,
        enquiry,
        qualified,
        packSent,
        contract,
        settled,
        conversionRate: Number(conversionRate.toFixed(2)),
        pipelineValue,
        projectedRevenue,
        last7Days,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Dashboard error",
      },
      { status: 500 }
    );
  }
}