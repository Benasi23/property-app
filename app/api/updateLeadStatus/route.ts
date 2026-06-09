import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { id, status } = await req.json();

    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: "Missing id or status" },
        { status: 400 }
      );
    }

    // Build update payload
    const updates: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    // SaaS pipeline automation timestamps
    if (status === "pack_sent") {
      updates.pack_sent_date = new Date().toISOString();
    }

    if (status === "contract") {
      updates.contract_signed_date = new Date().toISOString();
    }

    if (status === "settled") {
      updates.settlement_date = new Date().toISOString();
    }

    // Update Supabase
    const { data, error } = await supabase
      .from("leads")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
      });
    }

    return NextResponse.json({
      success: true,
      lead: data,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Server error",
      },
      { status: 500 }
    );
  }
}