import { useState, useEffect } from 'react';
import { getDashboardStats } from '../../api/dashboard';
import { createInquiry } from '../../api/inquiries';
import { getToken } from '../../stores/auth';
import { AddressSearch } from '../../components/forms/AddressSearch';

interface Stats {
  todayCount: number;
  unassignedCount: number;
  inProgressCount: number;
}

const SOURCE_OPTIONS = ['전화', '웹', '네이버', '인스타', '기타'];

export function AdminDashboardPage() {
  const token = getToken();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    address: '',
    addressDetail: '',
    areaPyeong: '',
    roomCount: 2,
    bathroomCount: 1,
    balconyCount: 1,
    preferredDate: '',
    preferredTime: '',
    callAttempt: 1,
    memo: '',
    source: '전화',
  });

  useEffect(() => {
    if (!token) return;
    setApiError(null);
    getDashboardStats(token)
      .then((data) => {
        setStats(data);
        setApiError(null);
      })
      .catch((err) => {
        setStats({ todayCount: 0, unassignedCount: 0, inProgressCount: 0 });
        setApiError(err instanceof Error ? err.message : '서버에 연결할 수 없습니다.');
      })
      .finally(() => setLoading(false));
  }, [token, success]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const numFields = ['roomCount', 'bathroomCount', 'balconyCount', 'callAttempt', 'areaPyeong'];
    setForm((prev) => ({
      ...prev,
      [name]: numFields.includes(name) ? (value === '' ? '' : Number(value)) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitLoading(true);
    setSuccess(false);
    try {
      await createInquiry(token, {
        ...form,
        areaPyeong: form.areaPyeong ? Number(form.areaPyeong) : null,
        preferredDate: form.preferredDate || null,
      });
      setForm({
        customerName: '',
        customerPhone: '',
        address: '',
        addressDetail: '',
        areaPyeong: '',
        roomCount: 2,
        bathroomCount: 1,
        balconyCount: 1,
        preferredDate: '',
        preferredTime: '',
        callAttempt: 1,
        memo: '',
        source: '전화',
      });
      setSuccess(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : '등록에 실패했습니다.');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-800">메인 대시보드</h1>

      {apiError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {apiError} (서버가 실행 중인지 확인하세요.)
        </div>
      )}

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="오늘 접수"
          value={loading ? '-' : stats?.todayCount ?? 0}
        />
        <StatCard
          label="미분배"
          value={loading ? '-' : stats?.unassignedCount ?? 0}
        />
        <StatCard
          label="진행중"
          value={loading ? '-' : stats?.inProgressCount ?? 0}
        />
      </div>

      {/* DB 접수 폼 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-base font-medium text-gray-800 mb-4">DB 접수 (고객 전화 시)</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">이름</label>
            <input
              name="customerName"
              value={form.customerName}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">연락처</label>
            <input
              name="customerPhone"
              value={form.customerPhone}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              placeholder="010-0000-0000"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm text-gray-600 mb-1">주소</label>
            <AddressSearch
              value={form.address}
              onChange={(address) => setForm((prev) => ({ ...prev, address }))}
              placeholder="주소 검색 버튼을 눌러 주소를 선택하세요"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm text-gray-600 mb-1">상세주소 (동·호수)</label>
            <input
              name="addressDetail"
              value={form.addressDetail}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              placeholder="101동 1001호"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">평수</label>
            <input
              name="areaPyeong"
              type="number"
              step="0.1"
              value={form.areaPyeong}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              placeholder="84"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">방·화·베</label>
            <div className="flex gap-2 items-center">
              <input
                name="roomCount"
                type="number"
                min={0}
                value={form.roomCount}
                onChange={handleChange}
                className="w-14 px-2 py-2 border border-gray-300 rounded text-sm text-center"
                title="방"
              />
              <span className="text-gray-500">방</span>
              <input
                name="bathroomCount"
                type="number"
                min={0}
                value={form.bathroomCount}
                onChange={handleChange}
                className="w-14 px-2 py-2 border border-gray-300 rounded text-sm text-center"
                title="화장실"
              />
              <span className="text-gray-500">화</span>
              <input
                name="balconyCount"
                type="number"
                min={0}
                value={form.balconyCount}
                onChange={handleChange}
                className="w-14 px-2 py-2 border border-gray-300 rounded text-sm text-center"
                title="베란다"
              />
              <span className="text-gray-500">베</span>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">희망일</label>
            <input
              name="preferredDate"
              type="date"
              value={form.preferredDate}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">희망 시간대</label>
            <input
              name="preferredTime"
              value={form.preferredTime}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              placeholder="오전 / 오후"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">통화시도</label>
            <input
              name="callAttempt"
              type="number"
              min={1}
              value={form.callAttempt}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">유입경로</label>
            <select
              name="source"
              value={form.source}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            >
              {SOURCE_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm text-gray-600 mb-1">특이사항</label>
            <textarea
              name="memo"
              value={form.memo}
              onChange={handleChange}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              placeholder="건물 구조, 특이사항 등"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={submitLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitLoading ? '등록 중...' : '접수 등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="text-2xl font-semibold text-gray-800 mt-1">{value}</p>
    </div>
  );
}
