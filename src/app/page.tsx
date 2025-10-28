'use client';

import { useState, useRef, useEffect } from 'react';

export default function Home() {
  const [step, setStep] = useState<'register' | 'verify' | 'edit' | 'camera' | 'result'>('register');
  const [email, setEmail] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [code, setCode] = useState('');
  const [sentCode, setSentCode] = useState('');
  const [img, setImg] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

  const sendVerification = async () => {
    if (!email || !accountNumber || !fullName) return alert('املأ جميع الحقول');
    if (accountNumber.replace(/\s/g, '').length !== 16) return alert('رقم الحساب 16 رقمًا');

    const code = generateCode();
    setSentCode(code);

    try {
      const response = await fetch('/api/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, fullName, accountNumber }),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        alert(`تم إرسال الكود إلى: ${email}`);
        setStep('verify');
      } else {
        alert(data.error || `تم إرسال الكود إلى: ${email}\nالكود: ${code} (للاختبار)`);
        setStep('verify');
      }
    } catch (error) {
      alert(`تم إرسال الكود إلى: ${email}\nالكود: ${code} (للاختبار)`);
      setStep('verify');
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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageSrc = e.target?.result as string;
        setImg(imageSrc);
        processOCR(imageSrc);
      };
      reader.readAsDataURL(file);
    }
  };

  const openCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = 'image/*';
      fileInputRef.current.capture = 'environment'; // للكاميرا الخلفية
      fileInputRef.current.click();
    }
  };

  const openGallery = () => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = 'image/*';
      fileInputRef.current.removeAttribute('capture');
      fileInputRef.current.click();
    }
  };

  const processOCR = async (base64: string) => {
    try {
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, toAccount: accountNumber, toName: fullName }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setResult(data);
        setStep('result');

        if (data.matched && data.transactionId) {
          const used = JSON.parse(localStorage.getItem('usedTransactions') || '[]');
          const updated = [...used.filter((t: any) => t.id !== data.transactionId), { id: data.transactionId, time: Date.now() }];
          localStorage.setItem('usedTransactions', JSON.stringify(updated));
        }
      } else {
        alert('فشل في معالجة الصورة');
      }
    } catch (error) {
      alert('خطأ في الاتصال بالخادم');
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
          <button onClick={sendVerification} className="w-full bg-green-600 text-white py-4 rounded-lg font-bold">إرسال كود التحقق</button>
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
        <button onClick={sendVerification} className="w-full mt-2 bg-blue-600 text-white py-3 rounded-lg">إعادة إرسال الكود</button>
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

  // صفحة الكاميرا/الرفع
  if (step === 'camera') {
    return (
      <div className="p-4 max-w-md mx-auto text-right" dir="rtl">
        <div className="bg-blue-50 p-3 rounded-lg mb-4 text-sm">
          <p><strong>الحساب:</strong> {accountNumber}</p>
          <p><strong>الاسم:</strong> {fullName}</p>
          <p><strong>البريد:</strong> {email}</p>
        </div>
        
        <div className="bg-gray-100 p-8 rounded-lg border-2 border-dashed border-gray-300 text-center mb-4">
          <p className="text-gray-600 mb-4">اختر طريقة رفع صورة الإيصال</p>
          
          <div className="flex flex-col gap-3">
            <button 
              onClick={openCamera}
              className="bg-green-600 text-white py-3 px-4 rounded-lg font-bold"
            >
              📷 فتح الكاميرا
            </button>
            
            <button 
              onClick={openGallery}
              className="bg-blue-600 text-white py-3 px-4 rounded-lg font-bold"
            >
              🖼️ رفع من المعرض
            </button>
          </div>
        </div>

        {/* ملف خفي للرفع */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*"
          className="hidden"
        />

        <div className="flex gap-2 mt-4">
          <button onClick={() => setStep('edit')} className="flex-1 bg-orange-600 text-white py-3 rounded-lg">تعديل</button>
          <button onClick={logout} className="flex-1 bg-red-600 text-white py-3 rounded-lg">خروج</button>
        </div>

        <div className="mt-4 text-sm text-gray-600 text-center">
          <p>• يمكنك استخدام الكاميرا أو رفع صورة موجودة</p>
          <p>• تأكد من وضوح صورة الإيصال</p>
          <p>• يجب أن تظهر جميع التفاصيل بوضوح</p>
        </div>
      </div>
    );
  }

  // صفحة النتيجة
  return (
    <div className="p-6 max-w-md mx-auto text-right" dir="rtl">
      <h1 className="text-2xl font-bold text-center mb-6 text-green-700">النتيجة</h1>
      {img && <img src={img} alt="إيصال" className="w-full rounded-lg border mb-4" />}
      <div className="bg-white p-5 rounded-lg shadow-lg space-y-3 text-lg">
        <p><strong>رقم العملية:</strong> <span className="text-blue-600">{result?.transactionId || 'غير محدد'}</span></p>
        <p><strong>التاريخ:</strong> {result?.date || 'غير محدد'}</p>
        <p><strong>المبلغ:</strong> <span className="text-green-600">{result?.amount || 'غير محدد'}</span></p>
        <p><strong>إلى حساب:</strong> {result?.toAccount || 'غير محدد'}</p>
        <p><strong>اسم المرسل إليه:</strong> {result?.toName || 'غير محدد'}</p>
        <p className={`text-xl font-bold ${result?.matched ? 'text-green-600' : 'text-red-600'}`}>
          {result?.matched ? 'تم التحقق بنجاح' : result?.reason || 'فشل التحقق'}
        </p>
      </div>
      <button onClick={() => setStep('camera')} className="w-full mt-6 bg-gray-600 text-white py-3 rounded-lg">إيصال آخر</button>
    </div>
  );
}
