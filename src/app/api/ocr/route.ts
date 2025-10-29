import { NextRequest } from 'next/server';
import Tesseract from 'tesseract.js';

// قاعدة بيانات مؤقتة في الذاكرة (لأن localStorage لا يعمل في السيرفر)
let usedTransactions: { id: string; timestamp: number }[] = [];
const MAX_AGE = 15 * 60 * 1000; // 15 دقيقة

export async function POST(req: NextRequest) {
  const { image, toAccount, toName } = await req.json();

  if (!image || !toAccount || !toName) {
    return Response.json({ error: 'بيانات ناقصة' }, { status: 400 });
  }

  try {
    // OCR مع دعم عربي وإنجليزي + إرجاع درجة الثقة
    const { data: { text, words } } = await Tesseract.recognize(image, 'ara+eng', {
      logger: m => console.log(m), // للتصحيح
    });

    // تنظيف خفيف: نحافظ على الرموز المهمة
    const cleanText = text
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // إزالة الأحرف الخفية
      .replace(/\s+/g, ' ')
      .trim();

    // استخراج رقم العملية (11 رقمًا)
    const transactionIdMatch = cleanText.match(/(?:رقم العملية|Transaction ID)[:\s]*(\d{11})/i);
    const transactionId = transactionIdMatch?.[1];

    // استخراج التاريخ بدقة (مثال: 01-Jan-2025 12:30:00)
    const dateMatch = cleanText.match(/(\d{2}-[A-Za-z]{3}-\d{4} \d{2}:\d{2}:\d{2})/);
    const date = dateMatch?.[1];

    // استخراج المبلغ
    const amountMatch = cleanText.match(/(?:المبلغ|Amount)[:\s]*([\d,]+\.?\d*)/i);
    const amount = amountMatch?.[1]?.replace(/,/g, '');

    // استخراج الحساب: نمط 4 مجموعات من 4 أرقام (مثل 1234 5678 9012 3456)
    const accountPattern = /(\d{4}\s+\d{4}\s+\d{4}\s+\d{4})/g;
    const accounts = [...cleanText.matchAll(accountPattern)].map(m => m[1].replace(/\s/g, ''));
    const extractedToAccount = accounts.find(acc => 
      cleanText.includes(acc.slice(0, 8)) || // تحسين الدقة
      cleanText.includes(acc)
    );

    // استخراج الاسم: بعد "إلى" أو "المرسل إليه"
    const nameMatch = cleanText.match(/(?:إلى|المرسل إليه|To)[:\s]*([^\d\n][^\n]{5,50})/i);
    const extractedToName = nameMatch?.[1]?.trim().replace(/[:\.]$/, '');

    // --- التحقق من التكرار (في الذاكرة) ---
    const now = Date.now();
    usedTransactions = usedTransactions.filter(t => now - t.timestamp < MAX_AGE);
    const isDuplicate = transactionId ? usedTransactions.some(t => t.id === transactionId) : false;
    if (transactionId && !isDuplicate) {
      usedTransactions.push({ id: transactionId, timestamp: now });
    }

    // --- التحقق الزمني ---
    let timeValid = true;
    if (date && transactionId) {
      const monthMap: Record<string, string> = {
        Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
        Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
      };
      const formatted = date.replace(/[A-Za-z]{3}/g, m => monthMap[m] || '01');
      const receiptTime = new Date(formatted).getTime();
      const diff = now - receiptTime;
      timeValid = diff >= 0 && diff <= 15 * 60 * 1000;
    }

    // --- التحقق النهائي ---
    const cleanToAccount = toAccount.replace(/\s/g, '');
    const accountMatch = extractedToAccount === cleanToAccount;

    // تحقق من الاسم: مطابقة كاملة أو جزئية دقيقة
    const nameWords = toName.trim().split(/\s+/);
    const nameMatch = extractedToName && nameWords.every(word => 
      extractedToName.includes(word)
    ) && extractedToName.length <= toName.length * 2; // تجنب الأسماء الطويلة جدًا

    const noDuplicate = !isDuplicate;
    const matched = accountMatch && nameMatch && timeValid && noDuplicate && !!transactionId;

    const reason = !transactionId ? 'رقم العملية غير موجود' :
                   !accountMatch ? 'رقم الحساب غير مطابق' :
                   !nameMatch ? 'اسم المرسل إليه غير مطابق' :
                   !timeValid ? 'الإيصال قديم (أكثر من 15 دقيقة)' :
                   isDuplicate ? 'تم استخدام هذا الإيصال مسبقًا' : '';

    return Response.json({
      transactionId,
      date,
      amount,
      toAccount: extractedToAccount,
      toName: extractedToName,
      matched,
      reason,
      debug: { cleanText, words: words.map(w => ({ text: w.text, confidence: w.confidence })) }
    });

  } catch (error: any) {
    return Response.json({ error: 'فشل في معالجة الصورة', details: error.message }, { status: 500 });
  }
}
