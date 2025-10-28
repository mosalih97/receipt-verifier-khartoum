import { NextRequest } from 'next/server';
import emailjs from '@emailjs/browser';

export async function POST(req: NextRequest) {
  const { email, code, fullName } = await req.json();

  // استخدم EmailJS (يجب إعداد المفاتيح في .env.local)
  try {
    await emailjs.send(
      process.env.EMAILJS_SERVICE_ID!,
      process.env.EMAILJS_TEMPLATE_ID!,
      {
        to_email: email,
        verification_code: code,
        user_name: fullName,
      },
      process.env.EMAILJS_USER_ID
    );
    return Response.json({ success: true });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
