import { NextRequest } from 'next/server';
import Tesseract from 'tesseract.js';

export async function POST(req: NextRequest) {
  const { image } = await req.json();
  
  const { data: { text } } = await Tesseract.recognize(image, 'ara+eng');
  
  const amount = text.match(/[\d,]+\.?\d*/g)?.[0] || null;
  const date = text.match(/\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/)?.[0] || null;
  const transactionId = text.match(/\d{6,12}/)?.[0] || null;

  // بيانات تجريبية (غيّرها ببيانات حقيقية لاحقًا)
  const expected = { amount: '500', date: '2025-10-28', transactionId: '123456' };
  const matched = amount === expected.amount && date?.includes('2025') && transactionId === expected.transactionId;

  return Response.json({ amount, date, transactionId, matched, text });
}
