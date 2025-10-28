'use client';

import { useState, useEffect } from 'react';
import { Upload, CheckCircle, Edit2, AlertCircle, Loader2 } from 'lucide-react';

interface ReceiptData {
  accountNumber: string;
  fullName: string;
  amount: string;
  date: string;
  reference: string;
  email: string;
}

export default function App() {
  const [step, setStep] = useState<'register' | 'verify' | 'upload' | 'result'>('register');
  const [email, setEmail] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [sentCode, setSentCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [result, setResult] = useState<'success' | 'error' | null>(null);
  const [savedData, setSavedData] = useState<ReceiptData | null>(null);

  // جلب البيانات المحفوظة من localStorage
  useEffect(() => {
    const saved = localStorage.getItem('receiptData');
    if (saved) {
      const data = JSON.parse(saved);
      setSavedData(data);
      setEmail(data.email);
      setAccountNumber(data.accountNumber);
      setFullName(data.fullName);
      setStep('upload');
    }
  }, []);

  // إنشاء كود تحقق عشوائي
  const generateCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  // إرسال كود التحقق (بدون API – يظهر في تنبيه)
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

    // تخطي كل الـ API – إظهار الكود مباشرة
    setTimeout(() => {
      alert(`تم إرسال الكود إلى ${email}\n\nالكود: ${code}\n\n(هذا للاختبار فقط)`);
      setStep('verify');
      setLoading(false);
    }, 800);
  };

  // التحقق من الكود
  const verifyCode = () => {
    if (verificationCode === sentCode) {
      const data: ReceiptData = { accountNumber, fullName, amount: '', date: '', reference: '', email };
      localStorage.setItem('receiptData', JSON.stringify(data));
      setSavedData(data);
      setStep('upload');
      alert('تم التحقق بنجاح! يمكنك الآن رفع الإيصال.');
    } else {
      alert('الكود غير صحيح. حاول مرة أخرى.');
    }
  };

  // معالجة رفع الصورة
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptImage(reader.result as string);
        setTimeout(() => {
          setResult('success');
          setStep('result');
        }, 2000);
      };
      reader.readAsDataURL(file);
    }
  };

  // تعديل البيانات
  const editData = () => {
    localStorage.removeItem('receiptData');
    setSavedData(null);
    setStep('register');
    setVerificationCode('');
    setReceiptImage(null);
    setResult(null);
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8 pt-8">
            <h1 className="text-3xl font-bold text-indigo-900">محقق إيصالات بنكك</h1>
            <p className="text-gray-600 mt-2">تحقق من إيصالاتك بأمان وسرعة</p>
          </div>

          {/* خطوة التسجيل */}
          {step === 'register' && (
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-6">تسجيل الحساب</h2>
              <div className="space-y-4">
                <input
                  type="email"
                  placeholder="البريد الإلكتروني"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <input
                  type="text"
                  placeholder="رقم الحساب (16 رقم)"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').replace(/(\d{4})/g, '$1 ').trim())}
                  maxLength={19}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <input
                  type="text"
                  placeholder="الاسم الكامل"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <button
                  onClick={sendVerification}
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      جاري الإرسال...
                    </>
                  ) : (
                    'إرسال كود التحقق'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* خطوة التحقق */}
          {step === 'verify' && (
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-6">التحقق من الكود</h2>
              <p className="text-sm text-gray-600 mb-4">تم إرسال كود مكون من 6 أرقام إلى بريدك</p>
              <input
                type="text"
                placeholder="أدخل الكود"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl font-mono tracking-widest focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex gap-3 mt-6">
                <button
                  onClick={verifyCode}
                  className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
                >
                  تأكيد
                </button>
                <button
                  onClick={sendVerification}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
                >
                  إعادة إرسال
                </button>
              </div>
            </div>
          )}

          {/* خطوة رفع الإيصال */}
          {step === 'upload' && (
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-800">رفع الإيصال</h2>
                <button
                  onClick={editData}
                  className="text-indigo-600 hover:text-indigo-700 flex items-center gap-1 text-sm"
                >
                  <Edit2 className="w-4 h-4" />
                  تعديل
                </button>
              </div>
              <div className="space-y-3 text-sm text-gray-600 mb-6">
                <p><strong>الحساب:</strong> {savedData?.accountNumber}</p>
                <p><strong>الاسم:</strong> {savedData?.fullName}</p>
              </div>
              <label className="block">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <div className="border-2 border-dashed border-indigo-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-500 transition">
                  {receiptImage ? (
                    <img src={receiptImage} alt="إيصال" className="mx-auto max-h-48 rounded-lg" />
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-indigo-500 mx-auto mb-3" />
                      <p className="text-indigo-600 font-semibold">اضغط لرفع صورة الإيصال</p>
                      <p className="text-xs text-gray-500 mt-1">PNG, JPG حتى 10MB</p>
                    </>
                  )}
                </div>
              </label>
            </div>
          )}

          {/* نتيجة المطابقة */}
          {step === 'result' && (
            <div className="bg-white rounded-2xl shadow-xl p-6 text-center">
              {result === 'success' ? (
                <>
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">مطابقة ناجحة!</h2>
                  <p className="text-gray-600">تم التحقق من الإيصال بنجاح</p>
                </>
              ) : (
                <>
                  <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">فشل في المطابقة</h2>
                  <p className="text-gray-600">الإيصال غير مطابق. حاول مرة أخرى.</p>
                </>
              )}
              <button
                onClick={() => {
                  localStorage.removeItem('receiptData');
                  setStep('register');
                  setReceiptImage(null);
                  setResult(null);
                }}
                className="mt-6 bg-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-indigo-700 transition"
              >
                بدء جديد
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
