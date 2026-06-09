export async function GET() {
  return Response.json({
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "MISSING",
    SUPABASE_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "SET" : "MISSING",
  });
}
