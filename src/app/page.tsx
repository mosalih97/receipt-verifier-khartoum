'use client';

import { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';

export default function Home() {
  const [step, setStep] = useState<'login' | 'camera' | 'result'>('login');
  const [email, setEmail] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [img, setImg] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const webcamRef = useRef<any>(null);

  // تحميل البيانات عند التشغيل
  useEffect(() => {
    const saved = localStorage.getItem('bankkUser');
    if (saved) {
      const user = JSON.parse(saved);
      setEmail(user.email);
      setAccountNumber(user.accountNumber);
      setFullName(user.fullName);
      setStep('camera');
    }
  }, []);

  const handleLogin = () => {
    if (!email || !accountNumber || !fullName) {
      alert('يرجى ملء جميع الحقول');
      return;
    }
    if (accountNumber.replace(/\s/g, '').length !== 16) {
      alert('رقم الحساب يجب أن يكون 16 رقمًا');
      return;
    }
    localStorage.setItem('bankkUser', JSON.stringify({ email, accountNumber, fullName }));
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
      body: JSON.stringify({ image: base64, toAccount: accountNumber, toName: fullName }),
    });
    const data = await res.json();
    setResult(data);
    setStep('result');

    if (data.transactionId && data.matched) {
      const used = JSON.parse(localStorage.getItem('usedTransactions') || '[]');
      const updated = [...used.filter((t: any) => t.id !== data.transactionId), { id: data.transactionId, time: Date.now() }];
      localStorage.setItem('usedTransactions', JSON.stringify(updated));
    }
  };

  const logout = () => {
    localStorage.removeItem('bankkUser');
    setStep('login');
    setEmail('');
    setAccountNumber('');
    setFullName('');
  };

  const reset = () => {
    setImg(null);
    setResult(null);
    setStep('camera');
  };

  // صفحة تسجيل الدخول
  if (step === 'login') {
    return (
      <div className="p-6 max-w-md mx-auto text-right" dir="rtl">
        <h1 className="text-2xl font-bold text-center mb-8 text-green-700">
          تسجيل الدخول - بنكك
        </h1>
        <div className="space-y-4">
          <input
            type="email"
            placeholder="البريد الإلكتروني"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 border rounded-lg text-lg"
          />
          <input
            type="text"
            placeholder="رقم الحساب (16 رقمًا)"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            className="w-full p-3 border rounded-lg text-lg"
            maxLength={19}
          />
          <input
            type="text"
            placeholder="الاسم الكامل كما في الحساب"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full p-3 border rounded-lg text-lg"
          />
          <button
            onClick={handleLogin}
            className="w-full bg-green-600 text-white py-4 rounded-lg font-bold text-xl"
          >
            تسجيل الدخول
          </button>
        </div>
      </div>
    );
  }

  // صفحة الكاميرا
  if (step === 'camera') {
    return (
      <div className="p-4 max-w-md mx-auto text-right" dir="rtl">
        <div className="bg-blue-50 p-3 rounded-lg mb-4 text-sm">
          <p><strong>الحساب:</strong> {accountNumber}</p>
          <p><strong>الاسم:</strong> {fullName}</p>
        </div>
        <Webcam
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          className="w-full rounded-lg border-2"
          videoConstraints={{ facingMode: 'environment' }}
        />
        <div className="flex gap-2 mt-4">
          <button
            onClick={capture}
            className="flex-1 bg-green-600 text-white py-3 rounded-lg font-bold"
          >
            التقاط الإيصال
          </button>
          <button
            onClick={logout}
            className="px-4 bg-red-600 text-white py-3 rounded-lg"
          >
            تسجيل خروج
          </button>
        </div>
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
        تحقق من إيصال آخر
      </button>
    </div>
  );
}
