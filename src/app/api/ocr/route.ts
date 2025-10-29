import { NextRequest } from 'next/server';
import Tesseract from 'tesseract.js';

let usedTransactions: { id: string; timestamp: number }[] = [];
const MAX_TRANSACTION_AGE = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const { image, toAccount, toName } = await req.json();

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
        { error: 'بيانات غير صالحة' },
        { status: 400 }
      );
    }

    // === OCR بدون طلب words (لتلافي الخطأ) ===
    const { data } = await Tesseract.recognize(image, 'ara+eng', {
      logger: m => console.log('[Tesseract]', m),
      // لا تحتاج لأي خيارات إضافية إذا لم تستخدم words
    });

    const rawText = data.text;

    const cleanText = rawText
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // === استخراج البيانات ===
    const transactionIdMatch = cleanText.match(/(?:رقم العملية|Transaction ID)[:\s]*(\d{11})/i);
    const transactionId = transactionIdMatch?.[1];

    const dateMatch = cleanText.match(/(\d{2}-[A-Za-z]{3}-\d{4} \d{2}:\d{2}:\d{2})/);
    const date = dateMatch?.[1];

    const amountMatch = cleanText.match(/(?:المبلغ|Amount)[:\s]*([\d,]+\.?\d*)/i);
    const amount = amountMatch?.[1]?.replace(/,/g, '');

    const accountPattern = /(\d{4}\s+\d{4}\s+\d{4}\s+\d{4})/g;
    const accountMatches = [...cleanText.matchAll(accountPattern)];
    const possibleAccounts = accountMatches.map(m => m[1].replace(/\s/g, ''));
    const extractedToAccount = possibleAccounts.find(acc =>
      cleanText.includes(`إلى حساب ${acc.slice(0, 8)}`) ||
      cleanText.includes(acc)
    );

    const nameMatch = cleanText.match(/(?:إلى|المرسل إليه|To)[:\s]*([^\d\n][^\n]{5,60})/i);
    const extractedToName = nameMatch?.[1]?.trim().replace(/[:\.]$/, '');

    // === التكرار ===
    const now = Date.now();
    usedTransactions = usedTransactions.filter(t => now - t.timestamp < MAX_TRANSACTION_AGE);
    const isDuplicate = transactionId ? usedTransactions.some(t => t.id === transactionId) : false;
    if (transactionId && !isDuplicate) {
      usedTransactions.push({ id: transactionId, timestamp: now });
    }

    // === التحقق من الوقت ===
    let timeValid = true;
    if (date && transactionId) {
      const monthMap: Record<string, string> = {
        Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
        Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
      };
      const formattedDate = date.replace(/[A-Za-z]{3}/g, m => monthMap[m] || '01');
      const receiptTime = new Date(formattedDate).getTime();
      if (!isNaN(receiptTime)) {
        const diff = now - receiptTime;
        timeValid = diff >= 0 && diff <= MAX_TRANSACTION_AGE;
      } else {
        timeValid = false;
      }
    }

    // === مطابقة الاسم ===
    const nameWords = cleanToName.split(/\s+/);
    const nameMatchResult = extractedToName &&
      nameWords.every(word => extractedToName.includes(word)) &&
      extractedToName.length <= cleanToName.length * 2.5;

    // === النتيجة النهائية ===
    const accountMatch = extractedToAccount === cleanToAccount;
    const hasTransactionId = !!transactionId;
    const matched = accountMatch && nameMatchResult && timeValid && !isDuplicate && hasTransactionId;

    const reason = !hasTransactionId ? 'رقم العملية غير موجود'
      : !accountMatch ? 'رقم الحساب غير مطابق'
      : !nameMatchResult ? 'اسم المرسل إليه غير مطابق'
      : !timeValid ? 'الإيصال قديم'
      : isDuplicate ? 'تم استخدامه مسبقًا' : '';

    return Response.json({
      transactionId,
      date,
      amount,
      toAccount: extractedToAccount,
      toName: extractedToName,
      matched,
      reason: matched ? 'مطابقة ناجحة' : reason,
      debug: { cleanText } // تم حذف words
    });

  } catch (error: any) {
    console.error('[OCR Error]', error);
    return Response.json(
      { error: 'فشل OCR', details: error.message },
      { status: 500 }
    );
  }
}
