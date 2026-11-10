import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { leadStatusStamps } from "@/lib/state";

export async function POST(req: NextRequest) {
  try {
    const { id, status } = await req.json();

    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: "Missing id or status" },
        { status: 400 }
      );
    }

    // Build update payload. Unknown statuses still persist; only the
    // pipeline statuses stamp a milestone date.
    const updatedAt = new Date().toISOString();
    const updates: Record<string, string> = {
      status,
      updated_at: updatedAt,
    };
    for (const field of leadStatusStamps(status)) {
      updates[field] = updatedAt;
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