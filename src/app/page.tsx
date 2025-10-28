'use client';

import { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';

export default function Home() {
  const [step, setStep] = useState<'register' | 'verify' | 'edit' | 'camera' | 'result'>('register');
  const [email, setEmail] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [code, setCode] = useState('');
  const [sentCode, setSentCode] = useState('');
  const [img, setImg] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const webcamRef = useRef<any>(null);

  // تحميل البيانات
  useEffect(() => {
    const user = localStorage.getItem('bankkUser');
    if (user) {
      const u = JSON.parse(user);
      setEmail(u.email);
      setAccountNumber(u.accountNumber);
      setFullName(u.fullName);
      setStep('camera');
    }
  }, []);

  const generateCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const sendVerification = async () => {
    if (!email || !accountNumber || !fullName) {
      alert('يرجى ملء جميع الحقول');
      return;
    }
    if (accountNumber.replace(/\s/g, '').length !== 16) {
      alert('رقم الحساب يجب أن يكون 16 رقمًا');
      return;
    }

    setLoading(true);
    const code = generateCode();
    setSentCode(code);

    try {
      // 1. تحقق من صحة الإيميل
      const verifyRes = await fetch(`/api/verify-email?email=${encodeURIComponent(email)}`);
      const verifyData = await verifyRes.json();

      if (!verifyRes.ok || verifyData.deliverability !== 'DELIVERABLE') {
        alert('البريد الإلكتروني غير صالح أو غير موجود');
        setLoading(false);
        return;
      }

      // 2. إرسال الكود
      const sendRes = await fetch('/api/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, fullName }),
      });

      if (sendRes.ok) {
        alert(`تم إرسال الكود إلى ${email}`);
        setStep('verify');
      } else {
        const error = await sendRes.json();
        alert('فشل إرسال الكود: ' + (error.error || 'خطأ غير معروف'));
      }
    } catch (err) {
      alert('خطأ في الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = () => {
    if (code === sentCode) {
      localStorage.setItem('bankkUser', JSON.stringify({ email, accountNumber, fullName }));
      setStep('camera');
    } else {
      alert('الكود غير صحيح');
    }
  };

  const saveEdits = () => {
    if (accountNumber.replace(/\s/g, '').length !== 16) return alert('رقم الحساب 16 رقمًا');
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

    if (data.matched && data.transactionId) {
      const used = JSON.parse(localStorage.getItem('usedTransactions') || '[]');
      const updated = [...used.filter((t: any) => t.id !== data.transactionId), { id: data.transactionId, time: Date.now() }];
      localStorage.setItem('usedTransactions', JSON.stringify(updated));
    }
  };

  const logout = () => {
    localStorage.removeItem('bankkUser');
    setStep('register');
    setEmail(''); setAccountNumber(''); setFullName('');
  };

  // صفحة التسجيل
  if (step === 'register') {
    return (
      <div className="p-6 max-w-md mx-auto text-right" dir="rtl">
        <h1 className="text-2xl font-bold text-center mb-8 text-green-700">تسجيل حساب جديد</h1>
        <div className="space-y-4">
          <input type="email" placeholder="البريد الإلكتروني" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 border rounded-lg" />
          <input type="text" placeholder="رقم الحساب (16 رقمًا)" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} className="w-full p-3 border rounded-lg" maxLength={19} />
          <input type="text" placeholder="الاسم الكامل كما في الحساب" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full p-3 border rounded-lg" />
          <button 
            onClick={sendVerification} 
            disabled={loading}
            className="w-full bg-green-600 text-white py-4 rounded-lg font-bold disabled:bg-gray-400"
          >
            {loading ? 'جاري الإرسال...' : 'إرسال كود التحقق'}
          </button>
        </div>
      </div>
    );
  }

  // صفحة التحقق
  if (step === 'verify') {
    return (
      <div className="p-6 max-w-md mx-auto text-right" dir="rtl">
        <h1 className="text-2xl font-bold text-center mb-8 text-green-700">تأكيد الكود</h1>
        <p className="text-sm mb-4">تم إرسال كود إلى: <strong>{email}</strong></p>
        <input type="text" placeholder="أدخل الكود (6 أرقام)" value={code} onChange={e => setCode(e.target.value)} className="w-full p-3 border rounded-lg text-center text-xl" maxLength={6} />
        <button onClick={verifyCode} className="w-full mt-4 bg-green-600 text-white py-4 rounded-lg font-bold">تأكيد</button>
      </div>
    );
  }

  // صفحة التعديل
  if (step === 'edit') {
    return (
      <div className="p-6 max-w-md mx-auto text-right" dir="rtl">
        <h1 className="text-2xl font-bold text-center mb-8 text-green-700">تعديل البيانات</h1>
        <div className="space-y-4">
          <input type="email" placeholder="البريد" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 border rounded-lg" />
          <input type="text" placeholder="رقم الحساب" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} className="w-full p-3 border rounded-lg" />
          <input type="text" placeholder="الاسم الكامل" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full p-3 border rounded-lg" />
          <div className="flex gap-2">
            <button onClick={saveEdits} className="flex-1 bg-green-600 text-white py-3 rounded-lg">حفظ</button>
            <button onClick={() => setStep('camera')} className="flex-1 bg-gray-600 text-white py-3 rounded-lg">إلغاء</button>
          </div>
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
        <Webcam ref={webcamRef} screenshotFormat="image/jpeg" className="w-full rounded-lg border-2" videoConstraints={{ facingMode: 'environment' }} />
        <div className="flex gap-2 mt-4">
          <button onClick={capture} className="flex-1 bg-green-600 text-white py-3 rounded-lg font-bold">التقاط</button>
          <button onClick={() => setStep('edit')} className="px-3 bg-orange-600 text-white py-3 rounded-lg">تعديل</button>
          <button onClick={logout} className="px-3 bg-red-600 text-white py-3 rounded-lg">خروج</button>
        </div>
      </div>
    );
  }

  // صفحة النتيجة
  return (
    <div className="p-6 max-w-md mx-auto text-right" dir="rtl">
      <h1 className="text-2xl font-bold text-center mb-6 text-green-700">النتيجة</h1>
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
      <button onClick={() => setStep('camera')} className="w-full mt-6 bg-gray-600 text-white py-3 rounded-lg">إيصال آخر</button>
    </div>
  );
}
