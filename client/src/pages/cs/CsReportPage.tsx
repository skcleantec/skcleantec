import { useState } from 'react';
import { submitCsReport, uploadCsImage } from '../../api/cs';

export function CsReportPage() {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [content, setContent] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setError(null);
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 5 * 1024 * 1024) {
          setError(`${file.name}이(가) 5MB를 초과합니다.`);
          continue;
        }
        const { url } = await uploadCsImage(file);
        setImageUrls((prev) => [...prev, url]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '이미지 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeImage = (idx: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim() || !content.trim()) {
      setError('성함, 연락처, 내용을 입력해 주세요.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await submitCsReport({ customerName: customerName.trim(), customerPhone: customerPhone.trim(), content: content.trim(), imageUrls });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '제출에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow p-6 text-center">
          <h1 className="text-lg font-semibold text-gray-900 mb-2">접수 완료</h1>
          <p className="text-gray-600">C/S 접수가 완료되었습니다. 확인 후 연락드리겠습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-lg font-semibold text-gray-900 mb-4">C/S 접수</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">성함</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="홍길동"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">연락처</label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="010-1234-5678"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none"
              placeholder="문의 내용을 입력해 주세요."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">사진 (선택)</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {imageUrls.map((url, i) => (
                <div key={i} className="relative">
                  <img src={url} alt={`첨부 ${i + 1}`} className="w-20 h-20 object-cover rounded border" />
                  <button type="button" onClick={() => removeImage(i)} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs leading-none">×</button>
                </div>
              ))}
            </div>
            <label className="inline-block">
              <input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" disabled={uploading} />
              <span className="inline-block px-3 py-2 text-sm border border-gray-300 rounded-md bg-white cursor-pointer hover:bg-gray-50">
                {uploading ? '업로드 중...' : '사진 추가'}
              </span>
            </label>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={submitting} className="w-full py-2 bg-gray-800 text-white text-sm font-medium rounded-md disabled:opacity-50">
            {submitting ? '접수 중...' : '접수하기'}
          </button>
        </form>
      </div>
    </div>
  );
}
