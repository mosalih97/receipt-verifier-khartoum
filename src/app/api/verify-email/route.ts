import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');
  
  if (!email) return Response.json({ error: 'Email required' }, { status: 400 });

  // تخطي التحقق مؤقتًا – يسمح لأي إيميل
  return Response.json({
    deliverability: 'DELIVERABLE',
    quality_score: 0.99,
  });
}
