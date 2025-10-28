import { NextRequest } from 'next/server';
import Tesseract from 'tesseract.js';

export async function POST(req: NextRequest) {
  const { image, toAccount, toName } = await req.json();

  // استخدام اللغة فقط بدون whitelist (يُصلح الخطأ في Vercel)
  const { data: { text } } = await Tesseract.recognize(image, 'ara+eng');

  // تنظيف النص يدويًا (أفضل من whitelist)
  const cleanText = text
    .replace(/[^0-9a-zA-Zاأإآبتثجحخدذرزسشصضطظعغفقكلمنهوىيئءؤة\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // استخراج البيانات بدقة
  const transactionId = cleanText.match(/رقم العملية[:\s]*(\d{11})/)?.[1] ||
                       cleanText.match(/(\d{11})\s+رقم العملية/)?.[1];

  const dateMatch = cleanText.match(/(\d{2}-[A-Za-z]{3}-\d{4} \d{2}:\d{2}:\d{2})/);
  const date = dateMatch?.[1];

  const amount = cleanText.match(/([\d,]+\.?\d*)\s*المبلغ/)?.[1] ||
                 cleanText.match(/المبلغ[:\s]*([\d,]+\.?\d*)/)?.[1];

  const extractedToAccount = cleanText.match(/إلى حساب[:\s]*([\d\s]+)/)?.[1]?.replace(/\s/g, '') ||
                             cleanText.match(/(\d{4}\s+\d{4}\s+\d{4}\s+\d{4})/)?.[1]?.replace(/\s/g, '');

  const extractedToName = cleanText.match(/اسم المرسل إليه[:\s]*([^\n]+)/)?.[1]?.trim();

  // قاعدة بيانات محلية (في المتصفح)
  let usedTransactions: any[] = [];
  try {
    usedTransactions = typeof localStorage !== 'undefined'
      ? JSON.parse(localStorage.getItem('usedTransactions') || '[]')
      : [];
  } catch (e) {}

  const isDuplicate = usedTransactions.some((t: any) => t.id === transactionId);

  // التحقق الزمني: 15 دقيقة فقط
  let timeValid = true;
  if (date) {
    const monthMap: any = {
      Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
      Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
    };
    const formattedDate = date.replace(/([A-Za-z]{3})/g, (m) => monthMap[m] || '01');
    const receiptTime = new Date(formattedDate).getTime();
    const now = Date.now();
    const minutesDiff = (now - receiptTime) / (1000 * 60);
    timeValid = minutesDiff >= 0 && minutesDiff <= 15;
  }

  // التحقق النهائي
  const accountMatch = extractedToAccount === toAccount.replace(/\s/g, '');
  const nameMatch = extractedToName?.includes(toName);
  const noDuplicate = !isDuplicate;

  const matched = accountMatch && nameMatch && timeValid && noDuplicate;

  const reason = !accountMatch ? 'الحساب غير مطابق' :
                 !nameMatch ? 'الاسم غير مطابق' :
                 !timeValid ? 'الإيصال قديم (أكثر من 15 دقيقة)' :
                 isDuplicate ? 'تم التحقق من هذا الإيصال مسبقًا' : '';

  return Response.json({
    transactionId,
    date,
    amount,
    toAccount: extractedToAccount,
    toName: extractedToName,
    matched,
    reason,
    text: cleanText
  });
}
