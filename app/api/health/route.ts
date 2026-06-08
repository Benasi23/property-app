import { NextResponse } from "next/server";

export async function GET() {
  console.log("🔥 HEALTH ROUTE HIT");

  return NextResponse.json({
    success: true,
    message: "API is working",
    time: new Date().toISOString(),
  });
}