import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getOrderFormByToken, submitOrderForm } from '../../api/orderform';
import { AddressSearch } from '../../components/forms/AddressSearch';

const BUILDING_TYPES = [
  { value: '신축', label: '신축 (5년 이하)' },
  { value: '구축', label: '구축' },
  { value: '인테리어', label: '인테리어' },
];

export function OrderFormPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{
    customerName: string;
    customerPhone: string;
    address: string;
    addressDetail: string;
    areaPyeong: string;
    preferredDate: string;
    preferredTime: string;
    roomCount: string;
    balconyCount: string;
    bathroomCount: string;
    kitchenCount: string;
    buildingType: string;
    moveInDate: string;
    specialNotes: string;
  }>({
    customerName: '',
    customerPhone: '',
    address: '',
    addressDetail: '',
    areaPyeong: '',
    preferredDate: '',
    preferredTime: '오전',
    roomCount: '',
    balconyCount: '',
    bathroomCount: '',
    kitchenCount: '',
    buildingType: '',
    moveInDate: '',
    specialNotes: '',
  });
  const [order, setOrder] = useState<{
    customerName: string;
    totalAmount: number;
    depositAmount: number;
    balanceAmount: number;
    optionNote: string | null;
    preferredDate: string | null;
    preferredTime: string | null;
    formConfig?: {
      formTitle?: string;
      priceLabel?: string | null;
      reviewEventText?: string | null;
      footerNotice1?: string | null;
      footerNotice2?: string | null;
      infoContent?: string | null;
      infoLinkText?: string | null;
      submitSuccessTitle?: string | null;
      submitSuccessBody?: string | null;
    };
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  useEffect(() => {
    if (!token) return;
    getOrderFormByToken(token)
      .then((data) => {
        setOrder({
          customerName: data.customerName,
          totalAmount: data.totalAmount,
          depositAmount: data.depositAmount,
          balanceAmount: data.balanceAmount,
          optionNote: data.optionNote,
          preferredDate: data.preferredDate ?? null,
          preferredTime: data.preferredTime ?? null,
          formConfig: data.formConfig,
        });
        setForm((f) => ({
          ...f,
          customerName: data.customerName,
          preferredDate: data.preferredDate ?? '',
          preferredTime: data.preferredTime ?? '오전',
        }));
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : '발주서를 불러올 수 없습니다.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      const area = parseFloat(form.areaPyeong.replace(/,/g, ''));
      if (!form.customerName?.trim()) throw new Error('성함을 입력해주세요.');
      if (!form.address?.trim()) throw new Error('주소를 검색해주세요.');
      if (!form.customerPhone?.trim()) throw new Error('전화번호를 입력해주세요.');
      if (isNaN(area) || area <= 0) throw new Error('평수를 입력해주세요.');
      const useDate = order?.preferredDate || form.preferredDate;
      const useTime = order?.preferredTime || form.preferredTime;
      if (!useDate || !useTime) throw new Error('청소 날짜와 시간을 확인해주세요.');
      if (!form.buildingType) throw new Error('신축/구축/인테리어를 선택해주세요.');
      if (!agreeToTerms) throw new Error('고객 정보처리 동의 및 안내사항에 동의해 주세요.');

      await submitOrderForm(token, {
        customerName: form.customerName.trim(),
        address: form.address.trim(),
        addressDetail: form.addressDetail.trim() || undefined,
        customerPhone: form.customerPhone.trim(),
        areaPyeong: area,
        preferredDate: useDate,
        preferredTime: useTime,
        roomCount: form.roomCount ? parseInt(form.roomCount, 10) : undefined,
        balconyCount: form.balconyCount ? parseInt(form.balconyCount, 10) : undefined,
        bathroomCount: form.bathroomCount ? parseInt(form.bathroomCount, 10) : undefined,
        kitchenCount: form.kitchenCount ? parseInt(form.kitchenCount, 10) : undefined,
        buildingType: form.buildingType,
        moveInDate: form.moveInDate || undefined,
        specialNotes: form.specialNotes.trim() || undefined,
      });
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '제출에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const CloseButton = () => (
    <button
      type="button"
      onClick={() => (window.opener ? window.close() : window.history.back())}
      className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-300 rounded"
    >
      닫기
    </button>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative">
        <div className="absolute top-4 right-4"><CloseButton /></div>
        <p className="text-gray-600">로딩 중...</p>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative">
        <div className="absolute top-4 right-4"><CloseButton /></div>
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <p className="text-sm text-gray-500 mt-2">링크가 만료되었거나 잘못된 주소일 수 있습니다.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    const successTitle = order?.formConfig?.submitSuccessTitle ?? '제출이 완료되었습니다.';
    const successBody = order?.formConfig?.submitSuccessBody ?? '청소 전일 저녁, 담당 팀장이 연락드립니다.';
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative">
        <div className="absolute top-4 right-4"><CloseButton /></div>
        <div className="text-center max-w-sm">
          <p className="text-lg font-medium text-gray-900">{successTitle}</p>
          <p className="text-gray-600 mt-2">{successBody}</p>
        </div>
      </div>
    );
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded text-sm';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-lg mx-auto px-4 py-6 relative">
        <div className="absolute top-4 right-4">
          <CloseButton />
        </div>
        <h1 className="text-lg font-semibold text-gray-900 mb-1">
          {order?.formConfig?.formTitle ?? 'SK클린텍 입주청소 발주서'}
        </h1>
        {order && (
          <div className="mb-6 p-4 bg-white border border-gray-200 rounded text-sm">
            <p className="font-medium text-gray-900">
              총 금액 {order.totalAmount.toLocaleString()}원 {order.formConfig?.priceLabel ?? '(특가)'}
            </p>
            <p className="text-gray-600 mt-1">
              잔금 {order.balanceAmount.toLocaleString()}원, 예약금 {order.depositAmount.toLocaleString()}원
            </p>
            {(order.formConfig?.reviewEventText ?? '* 리뷰 별5점 이벤트 참여, 1만원 입금') && (
              <p className="text-gray-500 text-xs mt-1">
                {order.formConfig?.reviewEventText ?? '* 리뷰 별5점 이벤트 참여, 1만원 입금'}
              </p>
            )}
            {order.optionNote && (
              <p className="text-gray-600 mt-2">추가: {order.optionNote}</p>
            )}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pb-20">
          <div>
            <label className={labelCls}>1. 성함 *</label>
            <input
              type="text"
              className={inputCls}
              value={form.customerName}
              onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
              placeholder="이름"
              required
            />
          </div>

          <div>
            <label className={labelCls}>2. 주소 (전체 상세주소) *</label>
            <AddressSearch
              value={form.address}
              onChange={(addr) => setForm((f) => ({ ...f, address: addr }))}
              placeholder="주소 검색"
              className="mb-2"
            />
            <input
              type="text"
              className={inputCls}
              value={form.addressDetail}
              onChange={(e) => setForm((f) => ({ ...f, addressDetail: e.target.value }))}
              placeholder="상세주소 (동, 호수 등)"
            />
          </div>

          <div>
            <label className={labelCls}>3. 전화번호 *</label>
            <input
              type="tel"
              className={inputCls}
              value={form.customerPhone}
              onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
              placeholder="010-0000-0000"
              required
            />
          </div>

          <div>
            <label className={labelCls}>4. 평수 (공급 기준) *</label>
            <input
              type="text"
              inputMode="decimal"
              className={inputCls}
              value={form.areaPyeong}
              onChange={(e) => setForm((f) => ({ ...f, areaPyeong: e.target.value }))}
              placeholder="예: 84"
            />
            <p className="text-xs text-gray-500 mt-1">* 복층은 층별 기재</p>
          </div>

          <div>
            <label className={labelCls}>5. 청소 날짜 *</label>
            {order?.preferredDate ? (
              <div className="px-3 py-2 bg-gray-100 rounded text-gray-700 text-sm">
                {order.preferredDate} (고정됨)
              </div>
            ) : (
              <input
                type="date"
                className={inputCls}
                value={form.preferredDate}
                onChange={(e) => setForm((f) => ({ ...f, preferredDate: e.target.value }))}
                required
              />
            )}
          </div>

          <div>
            <label className={labelCls}>6. 오전 or 오후 선택 *</label>
            {order?.preferredTime ? (
              <div className="px-3 py-2 bg-gray-100 rounded text-gray-700 text-sm">
                {order.preferredTime} (고정됨)
              </div>
            ) : (
              <select
                className={inputCls}
                value={form.preferredTime}
                onChange={(e) => setForm((f) => ({ ...f, preferredTime: e.target.value }))}
              >
                <option value="오전">오전 (8시~12시)</option>
                <option value="오후">오후 (12시~4시)</option>
              </select>
            )}
            <p className="text-xs text-gray-500 mt-1">* 청소 중 이사 들어오는 스케줄, 서비스 불가</p>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className={labelCls}>방</label>
              <input
                type="number"
                min={0}
                className={inputCls}
                value={form.roomCount}
                onChange={(e) => setForm((f) => ({ ...f, roomCount: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div>
              <label className={labelCls}>베란다</label>
              <input
                type="number"
                min={0}
                className={inputCls}
                value={form.balconyCount}
                onChange={(e) => setForm((f) => ({ ...f, balconyCount: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div>
              <label className={labelCls}>화장실</label>
              <input
                type="number"
                min={0}
                className={inputCls}
                value={form.bathroomCount}
                onChange={(e) => setForm((f) => ({ ...f, bathroomCount: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div>
              <label className={labelCls}>주방</label>
              <input
                type="number"
                min={0}
                className={inputCls}
                value={form.kitchenCount}
                onChange={(e) => setForm((f) => ({ ...f, kitchenCount: e.target.value }))}
                placeholder="0"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            * 최초 견적요청 상이 시 요금 추가 또는 해당 구조 구역 청소 불가
          </p>

          <div>
            <label className={labelCls}>8. 신축/구축/인테리어 선택 *</label>
            <select
              className={inputCls}
              value={form.buildingType}
              onChange={(e) => setForm((f) => ({ ...f, buildingType: e.target.value }))}
              required
            >
              <option value="">선택</option>
              {BUILDING_TYPES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">* 5년 이하 신축 구분</p>
          </div>

          <div>
            <label className={labelCls}>9. 이사 날짜</label>
            <input
              type="date"
              className={inputCls}
              value={form.moveInDate}
              onChange={(e) => setForm((f) => ({ ...f, moveInDate: e.target.value }))}
            />
            <p className="text-xs text-gray-500 mt-1">* 이사 들어오는 일정</p>
          </div>

          <div>
            <label className={labelCls}>10. 특이사항</label>
            <textarea
              className={`${inputCls} min-h-[80px]`}
              value={form.specialNotes}
              onChange={(e) => setForm((f) => ({ ...f, specialNotes: e.target.value }))}
              placeholder="전화 상담 시 언급 내용, 꼭 재 작성"
            />
            <p className="text-xs text-gray-500 mt-1">* 미작성 시 전달 누락</p>
          </div>

          <div className="flex items-start gap-2 py-4">
            <input
              type="checkbox"
              id="agreeTerms"
              checked={agreeToTerms}
              onChange={(e) => setAgreeToTerms(e.target.checked)}
              className="mt-1 shrink-0 w-4 h-4"
            />
            <label htmlFor="agreeTerms" className="text-sm text-gray-700 leading-relaxed cursor-pointer">
              <Link
                to="/info"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-700"
                onClick={(e) => e.stopPropagation()}
              >
                고객 정보처리 동의 및 안내사항
              </Link>
              에 동의합니다. (클릭 시 전체 내용 보기)
            </label>
          </div>

          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-gray-800 text-white font-medium rounded disabled:opacity-50"
            >
              {submitting ? '제출 중...' : '제출하기'}
            </button>
          </div>
        </form>

        <div className="text-xs text-gray-500 mt-8 text-center">
          <p>{order?.formConfig?.footerNotice1 ?? '‼️ 청소 전일 저녁, 담당 팀장 연락 드림'}</p>
          <p>{order?.formConfig?.footerNotice2 ?? '❌ 연락 없을 시, 본사 확인 요청 필'}</p>
        </div>
      </div>
    </div>
  );
}
