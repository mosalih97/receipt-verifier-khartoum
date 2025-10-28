'use client';

import { useState, useRef } from 'react';
import Webcam from 'react-webcam';

export default function Home() {
  const [img, setImg] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const webcamRef = useRef<any>(null);

  const capture = () => {
    const imageSrc = webcamRef.current.getScreenshot();
    setImg(imageSrc);
    processOCR(imageSrc);
  };

  const processOCR = async (base64: string) => {
    const res = await fetch('/api/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64 }),
    });
    const result = await res.json();
    setData(result);
  };

  return (
    <div className="p-4 max-w-md mx-auto text-right" dir="rtl">
      <h1 className="text-2xl font-bold text-center mb-6 text-blue-700">
        محقق إيصالات بنك الخرطوم
      </h1>

      {!img ? (
        <div className="space-y-4">
          <Webcam
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            className="w-full rounded-lg border-2 border-gray-300"
            videoConstraints={{ facingMode: 'environment' }}
          />
          <button
            onClick={capture}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-lg"
          >
            التقاط الإيصال
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <img src={img} alt="إيصال" className="w-full rounded-lg border" />
          <div className="bg-white p-5 rounded-lg shadow-lg space-y-3">
            <p className="text-lg"><strong>المبلغ:</strong> <span className="text-green-600">{data?.amount || 'غير محدد'}</span></p>
            <p className="text-lg"><strong>التاريخ:</strong> {data?.date || 'غير محدد'}</p>
            <p className="text-lg"><strong>رقم المعاملة:</strong> {data?.transactionId || 'غير محدد'}</p>
            <p className={`text-xl font-bold ${data?.matched ? 'text-green-600' : 'text-red-600'}`}>
              {data?.matched ? '✅ تم التحقق بنجاح' : '❌ فشل التحقق'}
            </p>
          </div>
          <button
            onClick={() => { setImg(null); setData(null); }}
            className="w-full bg-gray-600 text-white py-3 rounded-lg"
          >
            إعادة التصوير
          </button>
        </div>
      )}
    </div>
  );
}
