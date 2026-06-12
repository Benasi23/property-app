import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

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

    const enquiry = safe.filter((l) => l.status === "enquiry").length;
    const qualified = safe.filter((l) => l.status === "qualified").length;
    const packSent = safe.filter((l) => l.status === "pack_sent").length;
    const contract = safe.filter((l) => l.status === "contract").length;
    const settled = safe.filter((l) => l.status === "settled").length;

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