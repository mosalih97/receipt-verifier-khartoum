import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const { email, code, fullName, accountNumber } = await req.json();

  // 1. التحقق من صحة البريد باستخدام Abstract API فقط
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

    // التحقق من صحة البريد الإلكتروني - تنسيق الخطة Standard
    if (!verifyData.email_deliverability || 
        verifyData.email_deliverability.status !== 'deliverable' ||
        verifyData.email_deliverability.is_format_valid !== true) {
      return Response.json({ 
        error: 'البريد الإلكتروني غير صالح أو غير موجود'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Abstract API verification failed:', error);
    return Response.json({ 
      error: 'فشل في التحقق من البريد الإلكتروني' 
    }, { status: 500 });
  }

  // 2. محاكاة إرسال البريد (للتجربة فقط)
  console.log('📧 Email would be sent to:', email);
  console.log('🔐 Verification code:', code);
  console.log('👤 Full name:', fullName);
  console.log('🏦 Account number:', accountNumber);

  // إرجاع نجاح مع عرض الكود للمستخدم (للتجربة)
  return Response.json({ 
    success: true,
    message: 'تم إرسال الكود بنجاح',
    test_code: code // إظهار الكود للتجربة
  });
}
