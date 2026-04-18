import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getOrderFormByToken,
  getPublicProfessionalOptions,
  submitOrderForm,
  type ProfessionalSpecialtyOptionDto,
} from '../../api/orderform';
import { AddressSearch } from '../../components/forms/AddressSearch';
import { ORDER_TIME_SLOT_OPTIONS, labelForTimeSlot } from '../../constants/orderFormSchedule';
import {
  ORDER_FORM_CONFIG_DEFAULTS,
  orderFormConfigLine,
} from '../../constants/orderFormConfigDefaults';
import { ORDER_BUILDING_TYPE_OPTIONS } from '../../constants/orderFormBuilding';
import { formatDateCompactWithWeekday } from '../../utils/dateFormat';
import { subscribeOrderGuideAgreeTerms } from '../../utils/orderFormGuideBroadcast';
import { YmdSelect } from '../../components/ui/DateQuerySelects';

const PROPERTY_TYPE_OPTIONS = [
  { value: '아파트', label: '아파트' },
  { value: '오피스텔', label: '오피스텔' },
  { value: '빌라(연립)', label: '빌라(연립)' },
  { value: '상가', label: '상가' },
  { value: '기타', label: '기타' },
] as const;

const AREA_BASIS_OPTIONS = [
  { value: '공급', label: '공급면적 기준' },
  { value: '전용', label: '전용면적 기준' },
] as const;

export function OrderFormPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{
    customerName: string;
    customerPhone: string;
    customerPhoneSecondary: string;
    address: string;
    addressDetail: string;
    propertyType: string;
    areaBasis: string;
    areaPyeong: string;
    preferredDate: string;
    preferredTime: string;
    preferredTimeDetail: string;
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
    customerPhoneSecondary: '',
    address: '',
    addressDetail: '',
    propertyType: '',
    areaBasis: '',
    areaPyeong: '',
    preferredDate: '',
    preferredTime: '오전',
    preferredTimeDetail: '',
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
    preferredTimeDetail: string | null;
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
  const [professionalOptionIds, setProfessionalOptionIds] = useState<string[]>([]);
  const [professionalOptions, setProfessionalOptions] = useState<ProfessionalSpecialtyOptionDto[]>([]);

  const toggleProfessionalOption = (id: string) => {
    setProfessionalOptionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

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
          preferredTimeDetail: data.preferredTimeDetail ?? null,
          formConfig: data.formConfig,
        });
        const p = data.pendingInquiry;
        setForm((f) => ({
          ...f,
          customerName: p?.customerName || data.customerName,
          customerPhone: p?.customerPhone ?? '',
          customerPhoneSecondary: p?.customerPhone2 ?? '',
          address: p?.address ?? '',
          addressDetail: p?.addressDetail ?? '',
          propertyType: p?.propertyType ?? '',
          areaBasis: p?.areaBasis ?? '',
          areaPyeong: p?.areaPyeong != null ? String(p.areaPyeong) : '',
          preferredDate: p?.preferredDate ?? data.preferredDate ?? '',
          preferredTime: p?.preferredTime ?? data.preferredTime ?? '오전',
          preferredTimeDetail: p?.preferredTimeDetail ?? data.preferredTimeDetail ?? '',
          roomCount: p?.roomCount != null ? String(p.roomCount) : '',
          bathroomCount: p?.bathroomCount != null ? String(p.bathroomCount) : '',
          balconyCount: p?.balconyCount != null ? String(p.balconyCount) : '',
          kitchenCount: p?.kitchenCount != null ? String(p.kitchenCount) : '',
          buildingType: p?.buildingType ?? '',
          moveInDate: p?.moveInDate ?? '',
          specialNotes: p?.specialNotes ?? '',
        }));
        const fromForm = data.professionalOptions;
        if (fromForm && fromForm.length > 0) {
          setProfessionalOptions(fromForm);
        } else {
          void getPublicProfessionalOptions()
            .then((r) => setProfessionalOptions(r.items))
            .catch(() => setProfessionalOptions([]));
        }
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : '발주서를 불러올 수 없습니다.'))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => subscribeOrderGuideAgreeTerms(() => setAgreeToTerms(true)), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      const area = parseFloat(form.areaPyeong.replace(/,/g, ''));
      if (!form.customerName?.trim()) throw new Error('성함을 입력해주세요.');
      if (!form.address?.trim()) throw new Error('주소를 검색해주세요.');
      if (!form.customerPhone?.trim()) throw new Error('대표 전화번호를 입력해주세요.');
      if (!form.customerPhoneSecondary?.trim()) throw new Error('보조 전화번호를 입력해주세요.');
      if (!form.propertyType) throw new Error('건축물 유형을 선택해주세요.');
      if (!form.areaBasis || (form.areaBasis !== '공급' && form.areaBasis !== '전용')) {
        throw new Error('평수 기준으로 공급 또는 전용을 선택해주세요.');
      }
      if (isNaN(area) || area <= 0) throw new Error('평수를 숫자로 입력해주세요. (단위: 평)');
      const scheduleLockedByAdmin = Boolean(order?.preferredDate?.trim());
      const detailLockedByAdmin = Boolean(order?.preferredTimeDetail?.trim());
      const useDate = scheduleLockedByAdmin
        ? order!.preferredDate!.trim()
        : form.preferredDate.trim();
      const useTime = scheduleLockedByAdmin
        ? (order!.preferredTime?.trim() || form.preferredTime)
        : form.preferredTime;
      if (!useDate || !useTime) throw new Error('청소 날짜와 시간을 확인해주세요.');
      const useTimeDetail = detailLockedByAdmin
        ? order!.preferredTimeDetail!.trim()
        : form.preferredTimeDetail.trim() || undefined;
      if (!form.buildingType) throw new Error('신축·구축·인테리어·거주(짐이있는상태) 중 하나를 선택해주세요.');
      if (!agreeToTerms) throw new Error('고객 정보처리 동의 및 안내사항에 동의해 주세요.');

      await submitOrderForm(token, {
        customerName: form.customerName.trim(),
        address: form.address.trim(),
        addressDetail: form.addressDetail.trim() || undefined,
        customerPhone: form.customerPhone.trim(),
        customerPhone2: form.customerPhoneSecondary.trim(),
        areaPyeong: area,
        areaBasis: form.areaBasis,
        propertyType: form.propertyType,
        preferredDate: useDate,
        preferredTime: useTime,
        preferredTimeDetail: useTimeDetail ?? null,
        roomCount: form.roomCount ? parseInt(form.roomCount, 10) : undefined,
        balconyCount: form.balconyCount ? parseInt(form.balconyCount, 10) : undefined,
        bathroomCount: form.bathroomCount ? parseInt(form.bathroomCount, 10) : undefined,
        kitchenCount: form.kitchenCount ? parseInt(form.kitchenCount, 10) : undefined,
        buildingType: form.buildingType,
        moveInDate: form.moveInDate || undefined,
        specialNotes: form.specialNotes.trim() || undefined,
        professionalOptionIds: professionalOptionIds.length ? professionalOptionIds : undefined,
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
    const successTitle = orderFormConfigLine(
      order?.formConfig?.submitSuccessTitle,
      ORDER_FORM_CONFIG_DEFAULTS.submitSuccessTitle
    );
    const successBody = orderFormConfigLine(
      order?.formConfig?.submitSuccessBody,
      ORDER_FORM_CONFIG_DEFAULTS.submitSuccessBody
    );
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
  const radioGroupCls = 'flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-800';
  const radioLabelCls = 'inline-flex items-center gap-2 cursor-pointer';
  const scheduleLockedByAdmin = Boolean(order?.preferredDate?.trim());
  const detailLockedByAdmin = Boolean(order?.preferredTimeDetail?.trim());

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-lg mx-auto px-4 py-6 relative">
        <div className="absolute top-4 right-4">
          <CloseButton />
        </div>
        <h1 className="text-lg font-semibold text-gray-900 mb-1">
          {orderFormConfigLine(order?.formConfig?.formTitle, ORDER_FORM_CONFIG_DEFAULTS.formTitle)}
        </h1>
        {order && (
          <div className="mb-6 p-4 bg-white border border-gray-200 rounded text-sm">
            <p className="font-medium text-gray-900">
              총 금액 {(order.totalAmount ?? 0).toLocaleString()}원{' '}
              {orderFormConfigLine(order.formConfig?.priceLabel, ORDER_FORM_CONFIG_DEFAULTS.priceLabel)}
            </p>
            <p className="text-gray-600 mt-1">
              잔금 {(order.balanceAmount ?? 0).toLocaleString()}원, 예약금{' '}
              {(order.depositAmount ?? 0).toLocaleString()}원
            </p>
            <p className="text-gray-600 text-xs mt-1">
              {orderFormConfigLine(
                order.formConfig?.reviewEventText,
                ORDER_FORM_CONFIG_DEFAULTS.reviewEventText
              )}
            </p>
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
            <p className="text-xs text-gray-600 mb-3 leading-relaxed">
              전일 연락 두절시 서비스가 취소되오니 반드시 정확하게 기재 부탁드립니다.
            </p>
            <label className="block text-xs text-gray-600 mb-1">대표 연락처 *</label>
            <input
              type="tel"
              className={`${inputCls} mb-3`}
              value={form.customerPhone}
              onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
              placeholder="010-0000-0000"
              required
            />
            <label className="block text-xs text-gray-600 mb-1">보조 연락처 (필수) *</label>
            <input
              type="tel"
              className={inputCls}
              value={form.customerPhoneSecondary}
              onChange={(e) => setForm((f) => ({ ...f, customerPhoneSecondary: e.target.value }))}
              placeholder="예: 배우자, 가족 연락처"
              required
            />
          </div>

          <div>
            <label className={labelCls}>4. 건축물 유형 및 평수 *</label>
            <p className="text-xs font-medium text-gray-700 mb-2">건축물 유형 (하나 선택) *</p>
            <div className={radioGroupCls} role="radiogroup" aria-label="건축물 유형">
              {PROPERTY_TYPE_OPTIONS.map((o) => (
                <label key={o.value} className={radioLabelCls}>
                  <input
                    type="radio"
                    name="propertyType"
                    value={o.value}
                    checked={form.propertyType === o.value}
                    onChange={() => setForm((f) => ({ ...f, propertyType: o.value }))}
                    className="w-4 h-4 border-gray-300 text-gray-800"
                  />
                  {o.label}
                </label>
              ))}
            </div>
            <p className="text-xs font-medium text-gray-700 mt-4 mb-2">평수 기준 (하나 선택) *</p>
            <div className={radioGroupCls} role="radiogroup" aria-label="평수 기준">
              {AREA_BASIS_OPTIONS.map((o) => (
                <label key={o.value} className={radioLabelCls}>
                  <input
                    type="radio"
                    name="areaBasis"
                    value={o.value}
                    checked={form.areaBasis === o.value}
                    onChange={() => setForm((f) => ({ ...f, areaBasis: o.value }))}
                    className="w-4 h-4 border-gray-300 text-gray-800"
                  />
                  {o.label}
                </label>
              ))}
            </div>
            <label className="block text-xs text-gray-600 mt-4 mb-1">평수 (숫자만 입력) *</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                className={`${inputCls} flex-1`}
                value={form.areaPyeong}
                onChange={(e) => setForm((f) => ({ ...f, areaPyeong: e.target.value }))}
                placeholder="예: 32"
              />
              <span className="text-sm text-gray-700 shrink-0">평</span>
            </div>
            <p className="text-xs text-gray-600 mt-2 leading-relaxed">
              반드시 <span className="font-medium">평(坪)</span> 단위로 입력해 주세요. 제곱미터(㎡)가 아닙니다. 복층은 층별로 기재해 주세요.
            </p>
          </div>

          <div>
            <label className={labelCls}>5. 청소 날짜 *</label>
            {scheduleLockedByAdmin ? (
              <div className="px-3 py-2 bg-gray-100 rounded text-gray-700 text-xs tabular-nums">
                {formatDateCompactWithWeekday(order!.preferredDate)}{' '}
                <span className="text-gray-500">(관리자 지정·수정 불가)</span>
              </div>
            ) : (
              <YmdSelect
                className={inputCls}
                value={form.preferredDate}
                onChange={(v) => setForm((f) => ({ ...f, preferredDate: v }))}
                allowEmpty
                emitOnCompleteOnly
                idPrefix="orderform-pref"
              />
            )}
          </div>

          <div>
            <label className={labelCls}>6. 시간대 선택 *</label>
            {scheduleLockedByAdmin ? (
              <div className="px-3 py-2 bg-gray-100 rounded text-gray-700 text-sm">
                {labelForTimeSlot(order!.preferredTime)}{' '}
                <span className="text-gray-500">(관리자 지정·수정 불가)</span>
              </div>
            ) : (
              <select
                className={inputCls}
                value={form.preferredTime}
                onChange={(e) => setForm((f) => ({ ...f, preferredTime: e.target.value }))}
              >
                {ORDER_TIME_SLOT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs text-gray-500 mt-1">* 청소 중 이사 들어오는 스케줄, 서비스 불가</p>
          </div>

          <div>
            <label className={labelCls}>7. 구체적 시각 (선택)</label>
            {detailLockedByAdmin ? (
              <div className="px-3 py-2 bg-gray-100 rounded text-gray-700 text-sm">
                {order!.preferredTimeDetail}{' '}
                <span className="text-gray-500">(관리자 지정·수정 불가)</span>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  className={inputCls}
                  value={form.preferredTimeDetail}
                  onChange={(e) => setForm((f) => ({ ...f, preferredTimeDetail: e.target.value }))}
                  placeholder="예: 10:30, 오전 10시"
                />
                <input
                  type="time"
                  className={`${inputCls} mt-2`}
                  aria-label="시·분 선택 (선택)"
                  value={
                    /^([01]\d|2[0-3]):[0-5]\d$/.test(form.preferredTimeDetail.trim())
                      ? form.preferredTimeDetail.trim()
                      : ''
                  }
                  onChange={(e) =>
                    setForm((f) => ({ ...f, preferredTimeDetail: e.target.value }))
                  }
                />
                <p className="text-xs text-gray-500 mt-1">
                  위에 직접 입력하거나, 아래에서 시·분만 고를 수 있습니다. 비워 두셔도 됩니다.
                </p>
              </>
            )}
          </div>

          <div>
            <p className={`${labelCls} mb-2`}>8. 방·베란다·화장실·주방</p>
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
            <p className="text-xs text-gray-500 mt-2">
              * 최초 견적요청 상이 시 요금 추가 또는 해당 구조 구역 청소 불가
            </p>
          </div>

          <div>
            <label className={labelCls}>9. 신축/구축/인테리어/거주 선택 *</label>
            <select
              className={inputCls}
              value={form.buildingType}
              onChange={(e) => setForm((f) => ({ ...f, buildingType: e.target.value }))}
              required
            >
              <option value="">선택</option>
              {ORDER_BUILDING_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">* 5년 이하 신축 구분</p>
          </div>

          <div>
            <label className={labelCls}>10. 이사 날짜 (선택사항)</label>
            <YmdSelect
              className={inputCls}
              value={form.moveInDate}
              onChange={(v) => setForm((f) => ({ ...f, moveInDate: v }))}
              allowEmpty
              emitOnCompleteOnly
              idPrefix="orderform-move"
            />
            <p className="text-xs text-gray-500 mt-1">* 이사 들어오는 일정</p>
          </div>

          <div>
            <label className={labelCls}>11. 특이사항</label>
            <textarea
              className={`${inputCls} min-h-[96px]`}
              value={form.specialNotes}
              onChange={(e) => setForm((f) => ({ ...f, specialNotes: e.target.value }))}
              placeholder={
                '전화 상담 시 언급 내용, 꼭 재 작성\n타운하우스, 주택 등 층수로 나눠진 건물은 반드시 정확히 적어주세요.'
              }
            />
            <p className="text-xs text-gray-500 mt-1">* 미작성 시 전달 누락</p>
          </div>

          <div>
            <p className={`${labelCls} mb-2`}>12. 전문 시공 옵션 (선택)</p>
            <div className="space-y-2.5 pl-0.5">
              {professionalOptions.length === 0 ? (
                <p className="text-sm text-gray-500">등록된 전문 시공 옵션이 없습니다.</p>
              ) : (
                professionalOptions.map((o) => (
                  <label
                    key={o.id}
                    className="flex items-start gap-2.5 text-sm text-gray-800 cursor-pointer leading-snug"
                  >
                    <input
                      type="checkbox"
                      checked={professionalOptionIds.includes(o.id)}
                      onChange={() => toggleProfessionalOption(o.id)}
                      className="mt-0.5 shrink-0 w-4 h-4 border-gray-300"
                    />
                    <span>
                      {o.emoji ? (
                        <span className="mr-1" aria-hidden>
                          {o.emoji}
                        </span>
                      ) : null}
                      <span
                        className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle border border-gray-300"
                        style={{ backgroundColor: o.color }}
                        aria-hidden
                      />
                      <span className="font-medium">{o.label}</span>{' '}
                      {o.priceHint ? <span className="text-gray-500">({o.priceHint})</span> : null}
                    </span>
                  </label>
                ))
              )}
            </div>
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
                {orderFormConfigLine(
                  order?.formConfig?.infoLinkText,
                  ORDER_FORM_CONFIG_DEFAULTS.infoLinkText
                )}
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
          <p>
            {orderFormConfigLine(
              order?.formConfig?.footerNotice1,
              ORDER_FORM_CONFIG_DEFAULTS.footerNotice1
            )}
          </p>
          <p>
            {orderFormConfigLine(
              order?.formConfig?.footerNotice2,
              ORDER_FORM_CONFIG_DEFAULTS.footerNotice2
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
