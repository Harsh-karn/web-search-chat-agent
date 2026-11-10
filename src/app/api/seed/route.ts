export async function POST() {
  return Response.json(
    {
      error:
        "Demo seeding is available only through the isolated evaluation scripts.",
    },
    { status: 404 },
  );
}
