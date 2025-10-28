import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const { email, code, fullName, accountNumber } = await req.json();

  // تحقق مبدئي من تنسيق البريد
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return Response.json({ 
      error: 'تنسيق البريد الإلكتروني غير صحيح' 
    }, { status: 400 });
  }

  // التحقق المتقدم باستخدام Abstract API Standard
  try {
    const abstractApiKey = process.env.ABSTRACT_API_KEY;
    if (abstractApiKey) {
      const verifyResponse = await fetch(
        `https://emailvalidation.abstractapi.com/v1/?api_key=${abstractApiKey}&email=${encodeURIComponent(email)}`
      );

      if (verifyResponse.ok) {
        const verifyData = await verifyResponse.json();
        
        // تنسيق الخطة Standard
        const deliverability = verifyData.email_deliverability;
        
        if (!deliverability || deliverability.status !== 'deliverable') {
          return Response.json({ 
            error: 'البريد الإلكتروني غير قابل للتسليم'
          }, { status: 400 });
        }

        if (deliverability.is_disposable_email) {
          return Response.json({ 
            error: 'لا يمكن استخدام بريد إلكتروني مؤقت'
          }, { status: 400 });
        }
      }
    }
  } catch (error) {
    console.error('Abstract API check failed, continuing...', error);
    // نستمر في الإرسال حتى لو فشل التحقق المتقدم
  }

  // إرسال البريد باستخدام EmailJS
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;

  if (!serviceId || !templateId || !publicKey) {
    return Response.json({ 
      error: 'إعدادات البريد الإلكتروني غير مكتملة' 
    }, { status: 500 });
  }

  const data = {
    service_id: serviceId,
    template_id: templateId,
    user_id: publicKey,
    template_params: {
      to_email: email,
      verification_code: code,
      user_name: fullName,
      account_number: accountNumber,
    },
  };

  try {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      return Response.json({ success: true });
    } else {
      const error = await res.text();
      return Response.json({ error: 'فشل في إرسال الكود' }, { status: 500 });
    }
  } catch (error) {
    return Response.json({ error: 'خطأ في الاتصال' }, { status: 500 });
  }
}
