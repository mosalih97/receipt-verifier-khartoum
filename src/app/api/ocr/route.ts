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
      .trim();

    console.log('النص المستخرج:', text); // للتصحيح

    // ---------- التحقق من أن النص يحتوي على كلمات مفتاحية أساسية ----------
    const requiredKeywords = ['عملية', 'حساب', 'إلى', 'بنك', 'تحويل'];
    const hasRequiredKeywords = requiredKeywords.some(keyword => 
      text.toLowerCase().includes(keyword.toLowerCase())
    );

    if (!hasRequiredKeywords) {
      return fail('النص المستخرج لا يحتوي على كلمات مفتاحية للإيصال');
    }

    // ---------- استخراج بدقة محسنة ----------
    
    // 1. رقم العملية - بحث أكثر تحديداً
    const txIdMatch = text.match(/(?:رقم العمليه|رقم العملية|transaction\s*id|رقم)[:\s-]*(\d{8,15})/i);
    const txId: string | null = txIdMatch?.[1] || null;
    if (!txId) return fail('رقم العملية غير موجود');

    // 2. التاريخ - أنماط متعددة مع تحقق إضافي
    const datePatterns = [
      /(\d{1,2}-\d{1,2}-\d{4}\s+\d{1,2}:\d{2}:\d{2})/,
      /(\d{1,2}-\d{1,2}-\d{4})/,
      /(\d{1,2}\/\d{1,2}\/\d{4})/,
      /(\d{1,2}-[a-z]{3}-\d{4})/i
    ];
    
    let dateStr: string | null = null;
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        dateStr = match[0];
        break;
      }
    }
    if (!dateStr) return fail('تاريخ الإيصال غير موجود');

    // 3. المبلغ - بحث محسن مع تحقق من القيمة
    const amountMatch = text.match(/(?:المبلغ|amount|مبلغ|قيمة)[:\s-]*([\d,]+\.?\d*)\s*(?:ريال|ر\.س|sar|rs)/i);
    const amount: string | null = amountMatch?.[1] || null;
    
    // تحقق من أن المبلغ موجود وله قيمة معقولة
    if (!amount || parseFloat(amount.replace(/,/g, '')) < 1) {
      return fail('المبلغ غير صالح أو غير موجود');
    }

    // 4. رقم الحساب - بحث أكثر تحديداً
    const accountPatterns = [
      /(?:إلى حساب|الى حساب|حساب|account)[:\s-]*(\d{4}\s?\d{4}\s?\d{4}\s?\d{4})/i,
      /(\d{4}\s?\d{4}\s?\d{4}\s?\d{4})/,
    ];
    
    let extractedAcc: string | null = null;
    for (const pattern of accountPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        extractedAcc = match[1].replace(/\s/g, '');
        // تحقق من أن رقم الحساب له الطول الصحيح
        if (extractedAcc && extractedAcc.length >= 14 && extractedAcc.length <= 16) break;
      }
    }
    if (!extractedAcc) return fail('رقم الحساب غير موجود');

    // 5. الاسم - بحث محسن مع تحقق أكثر صرامة
    const namePatterns = [
      /(?:إلى|الى|المرسل إليه|المستفيد|beneficiary|recipient)[:\s-]*([^\d\n]{5,50})(?=\s*(?:حساب|رقم|account|مبلغ|amount))/i,
      /(?:اسم|name)[:\s-]*([^\d\n]{5,50})/i
    ];
    
    let extractedName: string | null = null;
    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const potentialName = match[1].trim()
          .replace(/[:\.\d\-]+$/, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        // تحقق من أن الاسم يحتوي على حروف عربية/إنجليزية وليس رموز فقط
        const hasValidChars = /[أ-يa-z]/i.test(potentialName);
        if (potentialName && potentialName.length >= 3 && hasValidChars) {
          extractedName = potentialName.toLowerCase();
          break;
        }
      }
    }
    if (!extractedName) return fail('اسم المرسل إليه غير موجود أو غير صالح');

    // ---------- التحقق من التكرار ----------
    const now = Date.now();
    usedTransactions = usedTransactions.filter(t => now - t.ts < MAX_AGE_MS);
    const duplicate = usedTransactions.some(t => t.id === txId);
    if (duplicate) return fail('تم استخدام هذا الإيصال مسبقًا');
    usedTransactions.push({ id: txId, ts: now });

    // ---------- التحقق من الوقت ----------
    let receiptTime: number | null = null;
    try {
      // تحويل التاريخ المستخرج إلى timestamp
      const dateMatch = dateStr.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
      if (dateMatch) {
        const day = parseInt(dateMatch[1]);
        const month = parseInt(dateMatch[2]) - 1;
        const year = parseInt(dateMatch[3]);
        receiptTime = new Date(year, month, day).getTime();
      }
    } catch (e) {
      console.error('خطأ في تحويل التاريخ:', e);
    }

    if (!receiptTime || isNaN(receiptTime)) {
      return fail('تاريخ الإيصال غير صالح');
    }

    // تحقق من أن الإيصال ليس قديماً جداً (أكثر من 24 ساعة)
    if (now - receiptTime > 24 * 60 * 60 * 1000) {
      return fail('الإيصال قديم جداً (أكثر من 24 ساعة)');
    }

    // تحقق من أن الإيصال ليس من المستقبل
    if (receiptTime > now + 5 * 60 * 1000) { // 5 دقائق تلافي للفرق في التوقيت
      return fail('تاريخ الإيصال من المستقبل');
    }

    // ---------- مطابقة الحساب ----------
    if (extractedAcc !== cleanAcc) {
      console.log(`عدم تطابق الحساب: ${extractedAcc} !== ${cleanAcc}`);
      return fail('رقم الحساب غير مطابق');
    }

    // ---------- مطابقة الاسم (أكثر صرامة) ----------
    const cleanExtractedName = extractedName.replace(/\s+/g, ' ').trim();
    const nameParts = cleanName.split(/\s+/).filter((part: string) => part.length > 1);
    
    if (nameParts.length === 0) {
      return fail('الاسم المدخل غير صالح');
    }

    // التحقق من أن معظم أجزاء الاسم موجودة (80% على الأقل)
    const matchingParts = nameParts.filter((part: string) => 
      cleanExtractedName.includes(part)
    );
    
    const matchRatio = matchingParts.length / nameParts.length;
    const nameOk = matchRatio >= 0.8;
    
    if (!nameOk) {
      console.log(`عدم تطابق الاسم: "${cleanExtractedName}" لا يحتوي على "${cleanName}" (${matchingParts.length}/${nameParts.length})`);
      return fail('اسم المرسل إليه غير مطابق');
    }

    // تحقق إضافي: أن الاسم المستخرج ليس قصيراً جداً
    if (cleanExtractedName.length < cleanName.length * 0.5) {
      return fail('الاسم المستخرج قصير جداً');
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
        nameMatching: `${matchingParts.length}/${nameParts.length}`,
        matchRatio: matchRatio.toFixed(2)
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
        debug: { 
          cleanText: text,
          requiredKeywords: requiredKeywords.join(', ')
        },
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
