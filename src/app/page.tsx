'use client';

import { useState, useEffect, useRef } from 'react';
import { Upload, CheckCircle, Edit2, AlertCircle, Loader2, Camera, X } from 'lucide-react';

interface ReceiptData {
  accountNumber: string;
  fullName: string;
  amount: string;
  date: string;
  reference: string;
  email: string;
}

interface VerificationResult {
  matched: boolean;
  reason?: string;
  transactionId?: string;
  date?: string;
  amount?: string;
  toAccount?: string;
  toName?: string;
  error?: string;
  debug?: any;
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
  const [activeUploadMethod, setActiveUploadMethod] = useState<'camera' | 'file'>('camera');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // فتح الكاميرا مع تحسينات
  const openCamera = async () => {
    try {
      setIsCameraLoading(true);
      setCameraError(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // انتظار حتى يكون الفيديو جاهزاً
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsCameraOpen(true);
          setIsCameraLoading(false);
        };
      }
      streamRef.current = stream;
    } catch (err: any) {
      console.error('Error opening camera:', err);
      setCameraError(`تعذر فتح الكاميرا: ${err.message}`);
      setIsCameraLoading(false);
      setActiveUploadMethod('file');
    }
  };

  // إغلاق الكاميرا
  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    setIsCameraOpen(false);
    setCameraError(null);
  };

  // التقاط صورة من الكاميرا
  const captureImage = () => {
    if (videoRef.current && streamRef.current) {
      const canvas = document.createElement('canvas');
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setReceiptImage(imageDataUrl);
        closeCamera();
        
        // بدء عملية التحقق الفعلية
        verifyReceipt(imageDataUrl);
      }
    }
  };

  // التحقق الفعلي من الإيصال عبر API
  const verifyReceipt = async (imageData: string) => {
    if (!savedData) {
      console.error('No saved data found');
      return;
    }

    setLoading(true);
    setVerificationResult(null);

    try {
      // تنظيف البيانات قبل الإرسال
      const cleanAccountNumber = savedData.accountNumber.replace(/\s/g, '');
      const cleanFullName = savedData.fullName.trim();

      console.log('Sending verification request:', {
        accountNumber: cleanAccountNumber,
        fullName: cleanFullName,
        imageLength: imageData.length
      });

      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          image: imageData.split(',')[1], // إرسال base64 بدون البادئة
          toAccount: cleanAccountNumber,
          toName: cleanFullName
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('API Response:', result);
      
      setVerificationResult(result);
      
      if (result.matched) {
        setResult('success');
      } else {
        setResult('error');
      }
      setStep('result');
    } catch (error: any) {
      console.error('Error verifying receipt:', error);
      setVerificationResult({ 
        matched: false, 
        error: 'فشل في الاتصال بالخادم',
        reason: error.message || 'تعذر التحقق من الإيصال بسبب مشكلة في الشبكة'
      });
      setResult('error');
      setStep('result');
    } finally {
      setLoading(false);
    }
  };

  // إنشاء كود تحقق عشوائي
  const generateCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  // إرسال كود التحقق
  const sendVerification = async () => {
    if (!email || !accountNumber || !fullName) {
      alert('يرجى ملء جميع الحقول');
      return;
    }
    
    const cleanAccountNumber = accountNumber.replace(/\s/g, '');
    if (cleanAccountNumber.length !== 16) {
      alert('رقم الحساب يجب أن يكون 16 رقمًا');
      return;
    }

    setLoading(true);
    const code = generateCode();
    setSentCode(code);

    setTimeout(() => {
      alert(`تم إرسال الكود إلى ${email}\n\nالكود: ${code}\n\n(هذا للاختبار فقط)`);
      setStep('verify');
      setLoading(false);
    }, 800);
  };

  // التحقق من الكود
  const verifyCode = () => {
    if (verificationCode === sentCode) {
      const cleanAccountNumber = accountNumber.replace(/\s/g, '');
      const data: ReceiptData = { 
        accountNumber: cleanAccountNumber, 
        fullName: fullName.trim(), 
        amount: '', 
        date: '', 
        reference: '', 
        email: email.trim()
      };
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
      // التحقق من نوع الملف
      if (!file.type.startsWith('image/')) {
        alert('يرجى اختيار ملف صورة فقط');
        return;
      }

      // التحقق من حجم الملف
      if (file.size > 10 * 1024 * 1024) {
        alert('حجم الملف كبير جداً. الحد الأقصى 10MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const imageData = reader.result as string;
        setReceiptImage(imageData);
        // بدء عملية التحقق الفعلية
        verifyReceipt(imageData);
      };
      reader.onload = () => {
        const imageData = reader.result as string;
        setReceiptImage(imageData);
        verifyReceipt(imageData);
      };
      reader.readAsDataURL(file);
    }
  };

  // فتح نافذة اختيار الملف
  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  // تعديل البيانات
  const editData = () => {
    localStorage.removeItem('receiptData');
    setSavedData(null);
    setStep('register');
    setVerificationCode('');
    setReceiptImage(null);
    setResult(null);
    setVerificationResult(null);
    closeCamera();
  };

  // تنظيف الكاميرا عند إغلاق المكون
  useEffect(() => {
    return () => {
      closeCamera();
    };
  }, []);

  // فتح الكاميرا تلقائياً عند اختيارها
  useEffect(() => {
    if (activeUploadMethod === 'camera' && step === 'upload' && !receiptImage && !isCameraOpen) {
      openCamera();
    }
  }, [activeUploadMethod, step, receiptImage, isCameraOpen]);

  // إعادة فتح الكاميرا عند العودة إلى خطوة الرفع
  useEffect(() => {
    if (step === 'upload' && activeUploadMethod === 'camera' && !receiptImage && !isCameraOpen) {
      openCamera();
    }
  }, [step]);

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

              {/* أزرار اختيار طريقة الرفع */}
              {!receiptImage && (
                <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => {
                      setActiveUploadMethod('camera');
                      if (!isCameraOpen) {
                        openCamera();
                      }
                    }}
                    className={`flex-1 py-3 rounded-md flex items-center justify-center gap-2 transition ${
                      activeUploadMethod === 'camera' 
                        ? 'bg-white shadow-sm text-indigo-600' 
                        : 'text-gray-600'
                    }`}
                  >
                    <Camera className="w-5 h-5" />
                    الكاميرا
                  </button>
                  <button
                    onClick={() => {
                      setActiveUploadMethod('file');
                      closeCamera();
                    }}
                    className={`flex-1 py-3 rounded-md flex items-center justify-center gap-2 transition ${
                      activeUploadMethod === 'file' 
                        ? 'bg-white shadow-sm text-indigo-600' 
                        : 'text-gray-600'
                    }`}
                  >
                    <Upload className="w-5 h-5" />
                    التحميل
                  </button>
                </div>
              )}

              {/* واجهة الكاميرا */}
              {!receiptImage && activeUploadMethod === 'camera' && (
                <div className="mb-6">
                  {cameraError ? (
                    <div className="border-2 border-dashed border-red-300 rounded-xl p-8 text-center bg-red-50">
                      <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                      <p className="text-red-600 font-semibold mb-2">خطأ في الكاميرا</p>
                      <p className="text-sm text-red-500 mb-4">{cameraError}</p>
                      <button
                        onClick={openCamera}
                        className="bg-red-600 text-white py-2 px-4 rounded-lg text-sm hover:bg-red-700 transition"
                      >
                        محاولة مرة أخرى
                      </button>
                    </div>
                  ) : isCameraLoading ? (
                    <div className="border-2 border-dashed border-indigo-300 rounded-xl p-8 text-center bg-indigo-50">
                      <Loader2 className="w-12 h-12 text-indigo-500 mx-auto mb-3 animate-spin" />
                      <p className="text-indigo-600 font-semibold">جاري تحضير الكاميرا...</p>
                    </div>
                  ) : isCameraOpen ? (
                    <div className="relative bg-black rounded-xl overflow-hidden">
                      <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        muted
                        className="w-full h-64 object-cover"
                      />
                      <button
                        onClick={captureImage}
                        className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white text-indigo-600 p-4 rounded-full shadow-lg hover:bg-gray-100 transition"
                      >
                        <Camera className="w-6 h-6" />
                      </button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-indigo-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-500 transition bg-indigo-50">
                      <Camera className="w-12 h-12 text-indigo-500 mx-auto mb-3" />
                      <p className="text-indigo-600 font-semibold">انقر لفتح الكاميرا</p>
                      <button
                        onClick={openCamera}
                        className="mt-3 bg-indigo-600 text-white py-2 px-4 rounded-lg text-sm hover:bg-indigo-700 transition"
                      >
                        فتح الكاميرا
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* واجهة التحميل */}
              {!receiptImage && activeUploadMethod === 'file' && (
                <div 
                  onClick={openFileDialog}
                  className="border-2 border-dashed border-indigo-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-500 transition bg-indigo-50 mb-6"
                >
                  <Upload className="w-12 h-12 text-indigo-500 mx-auto mb-3" />
                  <p className="text-indigo-600 font-semibold">اضغط لرفع صورة الإيصال</p>
                  <p className="text-xs text-gray-500 mt-1">PNG, JPG حتى 10MB</p>
                </div>
              )}

              {/* عرض الصورة الملتقطة/المحمولة */}
              {receiptImage && (
                <div className="mb-6">
                  <div className="relative border-2 border-indigo-300 rounded-xl overflow-hidden">
                    <img 
                      src={receiptImage} 
                      alt="الإيصال المرفوع" 
                      className="w-full h-64 object-contain bg-gray-100"
                    />
                    <button
                      onClick={() => {
                        setReceiptImage(null);
                        closeCamera();
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition"
                      disabled={loading}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="flex gap-3 mt-4">
                    <button 
                      onClick={() => {
                        setReceiptImage(null);
                        closeCamera();
                      }}
                      className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
                      disabled={loading}
                    >
                      تغيير الصورة
                    </button>
                    
                    {loading && (
                      <button 
                        className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
                        disabled
                      >
                        <Loader2 className="w-4 h-4 animate-spin" />
                        جاري التحقق...
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* مدخل الملف المخفي */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
          )}

          {/* نتيجة المطابقة */}
          {step === 'result' && (
            <div className="bg-white rounded-2xl shadow-xl p-6 text-center">
              {result === 'success' ? (
                <>
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">مطابقة ناجحة!</h2>
                  <p className="text-gray-600">{verificationResult?.reason || 'تم التحقق من الإيصال بنجاح'}</p>
                  
                  <div className="mt-6 p-4 bg-green-50 rounded-lg text-right space-y-2">
                    {verificationResult?.transactionId && (
                      <p className="text-sm text-gray-700">
                        <strong>رقم العملية:</strong> {verificationResult.transactionId}
                      </p>
                    )}
                    {verificationResult?.date && (
                      <p className="text-sm text-gray-700">
                        <strong>التاريخ:</strong> {verificationResult.date}
                      </p>
                    )}
                    {verificationResult?.amount && (
                      <p className="text-sm text-gray-700">
                        <strong>المبلغ:</strong> {verificationResult.amount}
                      </p>
                    )}
                    <p className="text-sm text-gray-700">
                      <strong>الحساب:</strong> {savedData?.accountNumber}
                    </p>
                    <p className="text-sm text-gray-700">
                      <strong>الاسم:</strong> {savedData?.fullName}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">فشل في المطابقة</h2>
                  <p className="text-gray-600 mb-4">
                    {verificationResult?.reason || verificationResult?.error || 'الإيصال غير مطابق'}
                  </p>
                  
                  {verificationResult?.debug && (
                    <div className="mt-4 p-3 bg-red-50 rounded-lg text-xs text-right">
                      <p className="text-red-700 font-semibold">تفاصيل الخطأ:</p>
                      <p className="text-red-600">{verificationResult.reason}</p>
                    </div>
                  )}
                </>
              )}
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setStep('upload');
                    setReceiptImage(null);
                    setResult(null);
                    setVerificationResult(null);
                  }}
                  className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
                >
                  محاولة أخرى
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem('receiptData');
                    setStep('register');
                    setReceiptImage(null);
                    setResult(null);
                    setVerificationResult(null);
                    closeCamera();
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
                >
                  بدء جديد
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
