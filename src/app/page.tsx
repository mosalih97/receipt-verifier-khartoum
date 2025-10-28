'use client';

import { useState, useRef } from 'react';
import Webcam from 'react-webcam';

export default function Home() {
  const [step, setStep] = useState<'input' | 'camera' | 'result'>('input');
  const [toAccount, setToAccount] = useState('');
  const [toName, setToName] = useState('');
  const [img, setImg] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const webcamRef = useRef<any>(null);

  // قاعدة بيانات محلية للإيصالات المستخدمة
  const getUsedTransactions = () => {
    return JSON.parse(localStorage.getItem('usedTransactions') || '[]');
  };

  const startVerification = () => {
    if (!toAccount.trim() || !toName.trim()) {
      alert('يرجى إدخال جميع البيانات');
      return;
    }
    setStep('camera');
  };

  const capture = () => {
    const imageSrc = webcamRef.current.getScreenshot();
    setImg(imageSrc);
    processOCR(imageSrc);
  };

  const processOCR = async (base64: string) => {
    const res = await fetch('/api/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64, toAccount, toName }),
    });
    const data = await res.json();
    setResult(data);
    setStep('result');

    // حفظ رقم العملية إذا نجح التحقق
    if (data.transactionId && data.matched) {
      const used = getUsedTransactions();
      const newEntry = { id: data.transactionId, time: Date.now() };
      const updated = [...used.filter((t: any) => t.id !== data.transactionId), newEntry];
      localStorage.setItem('usedTransactions', JSON.stringify(updated));
    }
  };

  const reset = () => {
    setImg(null);
    setResult(null);
    setStep('input');
    setToAccount('');
    setToName('');
  };

  // صفحة إدخال البيانات
  if (step === 'input') {
    return (
      <div className="p-6 max-w-md mx-auto text-right" dir="rtl">
        <h1 className="text-2xl font-bold text-center mb-8 text-green-700">
          محقق إيصالات بنك الخرطوم
        </h1>
        <div className="space-y-4">
          <input
            type="text"
            placeholder="إلى حساب (مثل: 0693 1204 8543 0001)"
            value={toAccount}
            onChange={(e) => setToAccount(e.target.value)}
            className="w-full p-3 border rounded-lg text-lg"
          />
          <input
            type="text"
            placeholder="اسم المرسل إليه"
            value={toName}
            onChange={(e) => setToName(e.target.value)}
            className="w-full p-3 border rounded-lg text-lg"
          />
          <button
            onClick={startVerification}
            className="w-full bg-green-600 text-white py-4 rounded-lg font-bold text-xl"
          >
            بدء التحقق
          </button>
        </div>
      </div>
    );
  }

  // صفحة الكاميرا
  if (step === 'camera') {
    return (
      <div className="p-4 max-w-md mx-auto text-right" dir="rtl">
        <Webcam
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          className="w-full rounded-lg border-2"
          videoConstraints={{ facingMode: 'environment' }}
        />
        <button
          onClick={capture}
          className="w-full mt-4 bg-green-600 text-white py-3 rounded-lg font-bold text-lg"
        >
          التقاط الإيصال
        </button>
      </div>
    );
  }

  // صفحة النتيجة
  return (
    <div className="p-6 max-w-md mx-auto text-right" dir="rtl">
      <h1 className="text-2xl font-bold text-center mb-6 text-green-700">
        نتيجة التحقق
      </h1>
      <img src={img!} alt="إيصال" className="w-full rounded-lg border mb-4" />
      <div className="bg-white p-5 rounded-lg shadow-lg space-y-3 text-lg">
        <p><strong>رقم العملية:</strong> <span className="text-blue-600">{result.transactionId || 'غير محدد'}</span></p>
        <p><strong>التاريخ:</strong> {result.date || 'غير محدد'}</p>
        <p><strong>المبلغ:</strong> <span className="text-green-600">{result.amount || 'غير محدد'}</span></p>
        <p><strong>إلى حساب:</strong> {result.toAccount || 'غير محدد'}</p>
        <p><strong>اسم المرسل إليه:</strong> {result.toName || 'غير محدد'}</p>
        <p className={`text-xl font-bold ${result.matched ? 'text-green-600' : 'text-red-600'}`}>
          {result.matched ? 'تم التحقق بنجاح' : result.reason || 'فشل التحقق'}
        </p>
      </div>
      <button
        onClick={reset}
        className="w-full mt-6 bg-gray-600 text-white py-3 rounded-lg"
      >
        تحقق من إيصال جديد
      </button>
    </div>
  );
}
