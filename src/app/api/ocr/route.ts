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
    const cleanName = toName.trim().toLowerCase();

    if (cleanAcc.length < 14 || cleanName.length < 2) {
      return Response.json({ error: 'بيانات غير صالحة' }, { status: 400 });
    }

    // ---------- OCR مع إعدادات مبسطة ----------
    const { data } = await Tesseract.recognize(image, 'ara+eng', {
      logger: m => console.log('[Tesseract]', m),
    });

    const raw = data.text;
    const text = raw
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    console.log('النص المستخرج:', text); // للتصحيح

    // ---------- استخراج بدقة محسنة ----------
    
    // 1. رقم العملية - بحث مرن أكثر
    const txIdMatch = text.match(/(?:رقم العمليه|رقم العملية|transaction\s*id|رقم)[:\s]*([\d]{8,15})/i);
    const txId = txIdMatch?.[1];
    if (!txId) return fail('رقم العملية غير موجود');

    // 2. التاريخ - أنماط متعددة
    const datePatterns = [
      /(\d{1,2}-\d{1,2}-\d{4})/,
      /(\d{1,2}\/\d{1,2}\/\d{4})/,
      /(\d{1,2}-[a-z]{3}-\d{4})/i
    ];
    
    let dateStr = null;
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        dateStr = match[0];
        break;
      }
    }
    if (!dateStr) return fail('تاريخ الإيصال غير موجود');

    // 3. المبلغ - بحث محسن
    const amountMatch = text.match(/(?:المبلغ|amount|مبلغ)[:\s]*([\d,]+\.?\d*)/i);
    const amount = amountMatch?.[1];

    // 4. رقم الحساب - بحث مرن في كامل النص
    const accountPatterns = [
      /(\d{4}\s*\d{4}\s*\d{4}\s*\d{4})/,
      /(\d{16})/,
      /(?:حساب|account)[:\s]*(\d+)/i
    ];
    
    let extractedAcc = null;
    for (const pattern of accountPatterns) {
      const match = text.match(pattern);
      if (match) {
        extractedAcc = match[1]?.replace(/\s/g, '');
        if (extractedAcc && extractedAcc.length >= 14) break;
      }
    }
    if (!extractedAcc) return fail('رقم الحساب غير موجود');

    // 5. الاسم - بحث محسن مع معالجة النص العربي
    const namePatterns = [
      /(?:إلى|الى|المرسل إليه|اسم|name)[:\s]*([^0-9\n\.]{10,80})/i,
      /(?:beneficiary|recipient)[:\s]*([^0-9\n\.]{10,80})/i
    ];
    
    let extractedName = null;
    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match) {
        extractedName = match[1]?.trim()
          .replace(/[:\.\d\-]+$/, '') // إزالة الرموز والأرقام من النهاية
          .replace(/\s+/g, ' ')
          .toLowerCase();
        if (extractedName && extractedName.length >= 3) break;
      }
    }
    if (!extractedName) return fail('اسم المرسل إليه غير موجود');

    // ---------- التحقق من التكرار ----------
    const now = Date.now();
    usedTransactions = usedTransactions.filter(t => now - t.ts < MAX_AGE_MS);
    const duplicate = usedTransactions.some(t => t.id === txId);
    if (duplicate) return fail('تم استخدام هذا الإيصال مسبقًا');
    usedTransactions.push({ id: txId, ts: now });

    // ---------- التحقق من الوقت ----------
    let receiptTime;
    try {
      // تحويل التاريخ المستخرج إلى timestamp
      const dateParts = dateStr.split(/[-\/]/);
      if (dateParts.length === 3) {
        const day = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]) - 1;
        const year = parseInt(dateParts[2]);
        receiptTime = new Date(year, month, day).getTime();
      }
    } catch (e) {
      console.error('خطأ في تحويل التاريخ:', e);
    }

    if (!receiptTime || isNaN(receiptTime) || now - receiptTime > MAX_AGE_MS) {
      return fail('الإيصال قديم أو تاريخه غير صالح');
    }

    // ---------- مطابقة الحساب ----------
    if (extractedAcc !== cleanAcc) {
      console.log(`عدم تطابق الحساب: ${extractedAcc} !== ${cleanAcc}`);
      return fail('رقم الحساب غير مطابق');
    }

    // ---------- مطابقة الاسم (مرنة ولكن آمنة) ----------
    const cleanExtractedName = extractedName.replace(/\s+/g, ' ').trim();
    const nameParts = cleanName.split(/\s+/).filter(part => part.length > 1);
    
    // التحقق من أن معظم أجزاء الاسم موجودة
    const matchingParts = nameParts.filter(part => 
      cleanExtractedName.includes(part)
    );
    
    const nameOk = matchingParts.length >= Math.max(1, nameParts.length * 0.7);
    
    if (!nameOk) {
      console.log(`عدم تطابق الاسم: "${cleanExtractedName}" لا يحتوي على "${cleanName}"`);
      return fail('اسم المرسل إليه غير مطابق');
    }

    // ---------- نجاح ----------
    return Response.json({
      transactionId: txId,
      date: dateStr,
      amount,
      toAccount: extractedAcc,
      toName: cleanExtractedName,
      matched: true,
      reason: 'مطابقة ناجحة',
      debug: { 
        cleanText: text,
        nameMatching: `${matchingParts.length}/${nameParts.length}`
      },
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
