export async function POST(req: Request) {
  try {
    const body = await req.json();

    return Response.json({
      success: true,
      message: "assignLead endpoint working (stub mode)",
      received: body,
    });
  } catch (err: any) {
    return Response.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}