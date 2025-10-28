import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const { email, code, fullName, accountNumber } = await req.json();

  // 1. أولاً: التحقق من صحة البريد باستخدام Abstract API
  try {
    const abstractApiKey = process.env.ABSTRACT_API_KEY;
    if (!abstractApiKey) {
      console.error('Abstract API key is missing');
      return Response.json({ 
        error: 'إعدادات التحقق غير مكتملة' 
      }, { status: 500 });
    }

    const verifyResponse = await fetch(
      `https://emailvalidation.abstractapi.com/v1/?api_key=${abstractApiKey}&email=${encodeURIComponent(email)}`
    );

    if (!verifyResponse.ok) {
      throw new Error('Abstract API request failed');
    }

    const verifyData = await verifyResponse.json();

    // التحقق من صحة البريد الإلكتروني
    if (verifyData.deliverability !== 'DELIVERABLE' || !verifyData.is_valid_format?.value) {
      return Response.json({ 
        error: 'البريد الإلكتروني غير صالح أو غير موجود',
        deliverability: verifyData.deliverability,
        isValid: verifyData.is_valid_format?.value
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Abstract API verification failed:', error);
    return Response.json({ 
      error: 'فشل في التحقق من البريد الإلكتروني' 
    }, { status: 500 });
  }

  // 2. ثانياً: إرسال البريد باستخدام EmailJS
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;

  if (!serviceId || !templateId || !publicKey) {
    console.error('Missing EmailJS environment variables');
    return Response.json({ 
      error: 'إعدادات البريد الإلكتروني غير مكتملة' 
    }, { status: 500 });
  }

  const url = `https://api.emailjs.com/api/v1.0/email/send`;

  const data = {
    service_id: serviceId,
    template_id: templateId,
    user_id: publicKey,
    template_params: {
      to_email: email,
      verification_code: code,
      user_name: fullName,
      account_number: accountNumber,
      to_name: fullName,
    },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      console.log('Email sent successfully to:', email);
      return Response.json({ 
        success: true,
        message: 'تم إرسال الكود بنجاح'
      });
    } else {
      const errorText = await res.text();
      console.error('EmailJS API error:', errorText);
      return Response.json({ 
        error: 'فشل في إرسال الكود: ' + errorText 
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Email sending failed:', error);
    return Response.json({ 
      error: 'خطأ في الاتصال: ' + error.message 
    }, { status: 500 });
  }
}
