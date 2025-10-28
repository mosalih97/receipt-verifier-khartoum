import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");

  if (!email) {
    return Response.json({ error: "Email is required" }, { status: 400 });
  }

  const apiKey = process.env.ABSTRACT_API_KEY;

  if (!apiKey) {
    return Response.json({ error: "Missing AbstractAPI key" }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://emailvalidation.abstractapi.com/v1/?api_key=${apiKey}&email=${email}`
    );

    const data = await res.json();

    return Response.json({
      email,
      deliverability: data.deliverability,
      quality_score: data.quality_score,
      is_valid: data.deliverability === "DELIVERABLE" && parseFloat(data.quality_score) > 0.7,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
