"use client";

import { useState } from "react";
import emailjs from "@emailjs/browser";

export default function SendVerificationEmail() {
  const [email, setEmail] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  const handleSend = async () => {
    if (!email) {
      setStatus("الرجاء إدخال البريد الإلكتروني ❌");
      return;
    }

    try {
      // 1️⃣ التحقق من البريد عبر API (يمكنك تعديل الرابط)
      const res = await fetch(`/api/validate-email?email=${email}`);
      const data = await res.json();

      if (!data.is_valid) {
        setStatus("البريد غير صالح أو لا يمكن التسليم إليه ❌");
        return;
      }

      // 2️⃣ توليد كود التفعيل العشوائي
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

      // 3️⃣ إرسال البريد عبر EmailJS
      const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!;
      const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID!;
      const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY!;

      await emailjs.send(
        serviceId,
        templateId,
        {
          to_email: email,
          verification_code: verificationCode,
        },
        publicKey
      );

      setStatus("تم إرسال كود التفعيل بنجاح ✅");
    } catch (err) {
      console.error(err);
      setStatus("فشل إرسال البريد ❌");
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">إرسال كود التفعيل</h1>

      <input
        type="email"
        placeholder="أدخل البريد الإلكتروني"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="border rounded px-3 py-2 w-full mb-3"
      />

      <button
        onClick={handleSend}
        className="bg-blue-600 text-white px-4 py-2 rounded w-full"
      >
        إرسال الكود
      </button>

      {status && <p className="mt-3 text-center">{status}</p>}
    </div>
  );
}
