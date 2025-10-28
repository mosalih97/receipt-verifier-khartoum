import type { NextRequest } from "next/server";
import emailjs from "@emailjs/node"; // نسخة NodeJS من EmailJS

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ message: "الرجاء إدخال البريد الإلكتروني" }),
        { status: 400 }
      );
    }

    // توليد كود التفعيل العشوائي
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // إرسال البريد عبر EmailJS (على السيرفر)
    await emailjs.send(
      process.env.EMAILJS_SERVICE_ID!,    // مفاتيح مخفية على السيرفر
      process.env.EMAILJS_TEMPLATE_ID!,
      {
        to_email: email,
        verification_code: verificationCode,
      },
      process.env.EMAILJS_PUBLIC_KEY!
    );

    return new Response(
      JSON.stringify({ message: "تم إرسال كود التفعيل ✅" }),
      { status: 200 }
    );
  } catch (err) {
    console.error("Send-code API error:", err);
    return new Response(
      JSON.stringify({ message: "فشل الإرسال ❌" }),
      { status: 500 }
    );
  }
}
