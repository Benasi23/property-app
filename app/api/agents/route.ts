export async function GET() {
  try {
    return Response.json({
      success: true,
      data: [],
    });
  } catch (err: any) {
    return Response.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}