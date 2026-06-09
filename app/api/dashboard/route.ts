import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { data: leads, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
      });
    }

    const safeLeads = leads || [];

    // ---------------------------
    // STATS
    // ---------------------------

    const enquiries = safeLeads.filter(
      (l) => l.stage === "enquiry"
    ).length;

    const reservations = safeLeads.filter(
      (l) => l.stage === "qualified"
    ).length;

    const packsOutLeads = safeLeads.filter(
      (l) => l.stage === "pack_sent"
    );

    const contracts = safeLeads.filter(
      (l) => l.stage === "contract"
    ).length;

    const settlements = safeLeads.filter(
      (l) => l.stage === "settled"
    ).length;

    const revenuePipeline = 0;

    // ---------------------------
    // AGED PACKS
    // ---------------------------

    const now = Date.now();

    const agedPacks = packsOutLeads.map((lead) => {
      const sentDate = lead.pack_sent_date
        ? new Date(lead.pack_sent_date)
        : null;

      const daysHeld = sentDate
        ? Math.floor(
            (now - sentDate.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : null;

      let risk = "green";

      if (daysHeld === null) risk = "gray";
      else if (daysHeld > 21) risk = "red";
      else if (daysHeld > 14) risk = "orange";
      else if (daysHeld > 7) risk = "yellow";

      return {
        ...lead,
        daysHeld,
        risk,
      };
    });

    // ---------------------------
    // RESPONSE
    // ---------------------------

    return NextResponse.json({
      success: true,
      stats: {
        enquiries,
        reservations,
        packsOut: packsOutLeads.length,
        contracts,
        settlements,
        revenuePipeline,
      },
      agedPacks,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Dashboard crashed",
      },
      { status: 500 }
    );
  }
}