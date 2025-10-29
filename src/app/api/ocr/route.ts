// src/app/api/ocr/route.ts
import { NextRequest } from 'next/server';
import Tesseract from 'tesseract.js';

// ---------------------------------------------------------------------
// 1. تخزين التكرار (في الذاكرة – للـ Serverless يُفضّل Redis)
// ---------------------------------------------------------------------
let usedTransactions: { id: string; ts: number }[] = [];
const MAX_AGE_MS = 15 * 60 * 1000; // 15 دقيقة

export async function POST(req: NextRequest) {
  try {
    const { image, toAccount, toName } = await req.json();

    // ---------- التحقق من المدخلات ----------
    if (!image || !toAccount || !toName) {
      return Response.json({ error: 'بيانات ناقصة' }, { status: 400 });
    }

    const cleanAcc = toAccount.replace(/\s/g, '').trim();
    const cleanName = toName.trim();

    if (cleanAcc.length < 14 || cleanName.length < 2) {
      return Response.json({ error: 'بيانات غير صالحة' }, { status: 400 });
    }

    // ---------- OCR ----------
    const { data } = await Tesseract.recognize(image, 'ara+eng', {
      logger: m => console.log('[Tesseract]', m),
      // نحافظ على الرموز المهمة
      tessedit_char_whitelist:
        '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZاأإآبتثجحخدذرزسشصضطظعغفقكلمنهوىيئءؤة:-., ',
    });

    const raw = data.text;
    const text = raw
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // أحرف خفية
      .replace(/\s+/g, ' ')
      .trim();

    // ---------- استخراج بدقة ----------
    // 1. رقم العملية (11 رقم)
    const txId = text.match(/(?:رقم العملية|Transaction ID)[:\s]*(\d{11})/i)?.[1];
    if (!txId) return fail('رقم العملية غير موجود');

    // 2. التاريخ (مثال: 01-Jan-2025 12:30:00)
    const dateStr = text.match(/(\d{2}-[A-Za-z]{3}-\d{4} \d{2}:\d{2}:\d{2})/)?.[0];
    if (!dateStr) return fail('تاريخ الإيصال غير موجود');

    // 3. المبلغ (اختياري)
    const amount = text.match(/(?:المبلغ|Amount)[:\s]*([\d,]+\.?\d*)/i)?.[1];

    // 4. رقم الحساب – يجب أن يكون **بجانب** "إلى حساب"
    const accRegex = /إلى حساب[:\s]*(\d{4}\s*\d{4}\s*\d{4}\s*\d{4})/i;
    const accMatch = text.match(accRegex);
    const extractedAcc = accMatch?.[1]?.replace(/\s/g, '');
    if (!extractedAcc) return fail('رقم الحساب غير موجود بجانب "إلى حساب"');

    // 5. اسم المرسل إليه – بعد "إلى" أو "المرسل إليه"
    const nameRegex = /(?:إلى|المرسل إليه)[:\s]*([^\d\n]{5,60})/i;
    const extractedName = text.match(nameRegex)?.[1]?.trim().replace(/[:\.]$/, '');
    if (!extractedName) return fail('اسم المرسل إليه غير موجود');

    // ---------- التحقق من التكرار ----------
    const now = Date.now();
    usedTransactions = usedTransactions.filter(t => now - t.ts < MAX_AGE_MS);
    const duplicate = usedTransactions.some(t => t.id === txId);
    if (duplicate) return fail('تم استخدام هذا الإيصال مسبقًا');
    usedTransactions.push({ id: txId, ts: now });

    // ---------- التحقق من الوقت ----------
    const monthMap: Record<string, string> = {
      Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
      Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
    };
    const iso = dateStr.replace(/[A-Za-z]{3}/g, m => monthMap[m] ?? '01');
    const receiptTime = new Date(iso).getTime();
    if (isNaN(receiptTime) || now - receiptTime > MAX_AGE_MS || now - receiptTime < -60000) {
      return fail('الإيصال قديم أو تاريخه غير صالح');
    }

    // ---------- مطابقة الحساب ----------
    if (extractedAcc !== cleanAcc) return fail('رقم الحساب غير مطابق');

    // ---------- مطابقة الاسم (كل كلمة موجودة، لا زيادة كبيرة) ----------
    const nameParts: string[] = cleanName.split(/\s+/);
    const nameOk =
      nameParts.every(p => extractedName.includes(p)) &&
      extractedName.length <= cleanName.length * 2.5;
    if (!nameOk) return fail('اسم المرسل إليه غير مطابق');

    // ---------- نجاح ----------
    return Response.json({
      transactionId: txId,
      date: dateStr,
      amount,
      toAccount: extractedAcc,
      toName: extractedName,
      matched: true,
      reason: 'مطابقة ناجحة',
      debug: { cleanText: text },
    });

    // -----------------------------------------------------------------
    // مساعدة للـ return المبكر
    // -----------------------------------------------------------------
    function fail(msg: string) {
      return Response.json({
        transactionId: txId ?? null,
        date: dateStr ?? null,
        amount: amount ?? null,
        toAccount: extractedAcc ?? null,
        toName: extractedName ?? null,
        matched: false,
        reason: msg,
        debug: { cleanText: text },
      });
    }
  } catch (err: any) {
    console.error('[OCR API]', err);
    return Response.json(
      { error: 'فشل معالجة الصورة', details: err.message },
      { status: 500 }
    );
  }
}
