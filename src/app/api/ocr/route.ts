import { NextRequest } from 'next/server';
import Tesseract from 'tesseract.js';

// قاعدة بيانات مؤقتة في الذاكرة (للكشف عن التكرار)
let usedTransactions: { id: string; timestamp: number }[] = [];
const MAX_TRANSACTION_AGE = 15 * 60 * 1000; // 15 دقيقة

export async function POST(req: NextRequest) {
  try {
    const { image, toAccount, toName } = await req.json();

    // === التحقق من البيانات المدخلة ===
    if (!image || !toAccount || !toName) {
      return Response.json(
        { error: 'بيانات ناقصة: يجب إرسال image و toAccount و toName' },
        { status: 400 }
      );
    }

    const cleanToAccount = toAccount.replace(/\s/g, '').trim();
    const cleanToName = toName.trim();

    if (cleanToAccount.length < 10 || cleanToName.length < 2) {
      return Response.json(
        { error: 'بيانات غير صالحة: الحساب أو الاسم قصير جدًا' },
        { status: 400 }
      );
    }

    // === OCR: استخراج النص من الصورة ===
    const { data } = await Tesseract.recognize(image, 'ara+eng', {
      logger: (m) => console.log('[Tesseract]', m), // للتصحيح في Vercel
      // لا نستخدم `words` لتجنب الأخطاء
    });

    const rawText = data.text;

    // تنظيف النص مع الحفاظ على الرموز المهمة
    const cleanText = rawText
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // إزالة الأحرف الخفية
      .replace(/\s+/g, ' ')
      .trim();

    // === استخراج البيانات بدقة ===

    // 1. رقم العملية (11 رقمًا)
    const transactionIdMatch = cleanText.match(/(?:رقم العملية|Transaction ID)[:\s]*(\d{11})/i);
    const transactionId = transactionIdMatch?.[1];

    // 2. التاريخ (مثال: 01-Jan-2025 12:30:00)
    const dateMatch = cleanText.match(/(\d{2}-[A-Za-z]{3}-\d{4} \d{2}:\d{2}:\d{2})/);
    const date = dateMatch?.[1];

    // 3. المبلغ
    const amountMatch = cleanText.match(/(?:المبلغ|Amount)[:\s]*([\d,]+\.?\d*)/i);
    const amount = amountMatch?.[1]?.replace(/,/g, '');

    // 4. رقم الحساب (نمط: 1234 5678 9012 3456)
    const accountPattern = /(\d{4}\s+\d{4}\s+\d{4}\s+\d{4})/g;
    const accountMatches = [...cleanText.matchAll(accountPattern)];
    const possibleAccounts = accountMatches.map((m) => m[1].replace(/\s/g, ''));

    const extractedToAccount = possibleAccounts.find((acc) =>
      cleanText.includes(`إلى حساب ${acc.slice(0, 8)}`) ||
      cleanText.includes(acc)
    );

    // 5. اسم المرسل إليه
    const nameMatch = cleanText.match(
      /(?:إلى|المرسل إليه|To)[:\s]*([^\d\n][^\n]{5,60})/i
    );
    const extractedToName = nameMatch?.[1]?.trim().replace(/[:\.]$/, '');

    // === التحقق من التكرار ===
    const now = Date.now();
    usedTransactions = usedTransactions.filter(
      (t) => now - t.timestamp < MAX_TRANSACTION_AGE
    );
    const isDuplicate = transactionId
      ? usedTransactions.some((t) => t.id === transactionId)
      : false;

    if (transactionId && !isDuplicate) {
      usedTransactions.push({ id: transactionId, timestamp: now });
    }

    // === التحقق من الوقت (15 دقيقة فقط) ===
    let timeValid = true;
    if (date && transactionId) {
      const monthMap: Record<string, string> = {
        Jan: '01',
        Feb: '02',
        Mar: '03',
        Apr: '04',
        May: '05',
        Jun: '06',
        Jul: '07',
        Aug: '08',
        Sep: '09',
        Oct: '10',
        Nov: '11',
        Dec: '12',
      };

      const formattedDate = date.replace(/[A-Za-z]{3}/g, (m) => monthMap[m] || '01');
      const receiptTime = new Date(formattedDate).getTime();

      if (!isNaN(receiptTime)) {
        const diff = now - receiptTime;
        timeValid = diff >= 0 && diff <= MAX_TRANSACTION_AGE;
      } else {
        timeValid = false;
      }
    }

    // === مطابقة الاسم بدقة (كل كلمة موجودة) ===
    const nameWords: string[] = cleanToName.split(/\s+/);
    const nameMatchResult =
      extractedToName &&
      nameWords.every((word: string) => extractedToName.includes(word)) &&
      extractedToName.length <= cleanToName.length * 2.5;

    // === التحقق النهائي ===
    const accountMatch = extractedToAccount === cleanToAccount;
    const hasTransactionId = !!transactionId;
    const matched =
      accountMatch && nameMatchResult && timeValid && !isDuplicate && hasTransactionId;

    // === سبب الرفض ===
    const reason = !hasTransactionId
      ? 'رقم العملية غير موجود أو غير صالح'
      : !accountMatch
      ? 'رقم الحساب غير مطابق'
      : !nameMatchResult
      ? 'اسم المرسل إليه غير مطابق'
      : !timeValid
      ? 'الإيصال قديم (أكثر من 15 دقيقة)'
      : isDuplicate
      ? 'تم استخدام هذا الإيصال مسبقًا'
      : '';

    // === الرد النهائي ===
    return Response.json({
      transactionId,
      date,
      amount,
      toAccount: extractedToAccount,
      toName: extractedToName,
      matched,
      reason: matched ? 'مطابقة ناجحة' : reason,
      debug: {
        cleanText,
        // يمكنك إضافة المزيد لاحقًا
      },
    });
  } catch (error: any) {
    console.error('[OCR API Error]', error);
    return Response.json(
      {
        error: 'فشل في معالجة الصورة',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
