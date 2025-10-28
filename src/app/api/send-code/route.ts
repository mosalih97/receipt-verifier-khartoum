import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const { email, code, fullName } = await req.json();

  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const userId = process.env.EMAILJS_USER_ID;

  if (!serviceId || !templateId || !userId) {
    return Response.json({ error: 'Missing EmailJS config' }, { status: 500 });
  }

  const url = `https://api.emailjs.com/api/v1.0/email/send`;

  const data = {
    service_id: serviceId,
    template_id: templateId,
    user_id: userId,
    template_params: {
      to_email: email,
      verification_code: code,
      user_name: fullName,
    },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      return Response.json({ success: true });
    } else {
      const error = await res.text();
      return Response.json({ error }, { status: 500 });
    }
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
