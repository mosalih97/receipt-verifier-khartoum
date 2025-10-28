import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const { email, code } = await req.json();
  // في الواقع: استخدم EmailJS أو SMTP
  // هنا: محاكاة
  console.log(`إرسال كود ${code} إلى ${email}`);
  return Response.json({ success: true });
}
