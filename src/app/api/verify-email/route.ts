import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');
  
  if (!email) return Response.json({ error: 'Email required' }, { status: 400 });

  const apiKey = process.env.ABSTRACT_API_KEY;
  const res = await fetch(
    `https://emailvalidation.abstractapi.com/v1/?api_key=${apiKey}&email=${email}`
  );
  const data = await res.json();

  return Response.json({
    deliverability: data.deliverability,
    quality_score: data.quality_score,
  });
}
