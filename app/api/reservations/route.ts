import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("reservations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return Response.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      data,
    });
  } catch (err: any) {
    return Response.json(
      {
        success: false,
        error: err.message || "Server error",
      },
      { status: 500 }
    );
  }
}