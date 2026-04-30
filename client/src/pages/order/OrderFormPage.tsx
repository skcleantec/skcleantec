import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getOrderFormByToken,
  getPublicProfessionalOptions,
  submitOrderForm,
  type ProfessionalSpecialtyOptionDto,
} from '../../api/orderform';
import { AddressSearch } from '../../components/forms/AddressSearch';
import { ORDER_TIME_SLOT_OPTIONS, labelForTimeSlot, type OrderTimeSlot } from '../../constants/orderFormSchedule';
import {
  ORDER_FORM_CONFIG_DEFAULTS,
  orderFormConfigLine,
} from '../../constants/orderFormConfigDefaults';
import {
  allowedPreferredTimeDetailValues,
  coercePreferredTimeDetailForSlot,
  getPreferredTimeDetailSelectOptions,
  preferredTimeDetailRangeHint,
} from '../../constants/orderFormPreferredTimeDetail';
import {
  formatProfOptionPriceDisplay,
  isSelectableProfOption,
  listProfChildren,
  listProfRootNodes,
} from '../../constants/professionalSpecialtyOptions';

const ORDER_TIME_SLOT_VALUE_SET = new Set<string>(ORDER_TIME_SLOT_OPTIONS.map((o) => o.value));

function isValidOrderTimeSlot(v: string): v is OrderTimeSlot {
  return ORDER_TIME_SLOT_VALUE_SET.has(v);
}
import { ORDER_BUILDING_TYPE_OPTIONS } from '../../constants/orderFormBuilding';
import { formatDateCompactWithWeekday, kstTodayYmd } from '../../utils/dateFormat';
import { subscribeOrderGuideAgreeTerms } from '../../utils/orderFormGuideBroadcast';
import { YmdSelect } from '../../components/ui/DateQuerySelects';
import { OrderFormPhotoSection } from '../../components/orderform/OrderFormPhotoSection';

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
    preferredDate: kstTodayYmd(),
    preferredTime: '',
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
      timeSlotAckTitle?: string | null;
      timeSlotAckBody?: string | null;
      timeSlotAckConsentHint?: string | null;
    };
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitErrorModal, setSubmitErrorModal] = useState<string | null>(null);
  const [timeSlotAckOpen, setTimeSlotAckOpen] = useState(false);
  const [pendingTimeSlot, setPendingTimeSlot] = useState<OrderTimeSlot | null>(null);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [professionalOptionIds, setProfessionalOptionIds] = useState<string[]>([]);
  const [professionalOptions, setProfessionalOptions] = useState<ProfessionalSpecialtyOptionDto[]>([]);
  /** 대분류(하위 있음) — 체크 시에만 세부 항목 표시 */
  const [profCatOpen, setProfCatOpen] = useState<Record<string, boolean>>({});
  const profRoots = useMemo(() => listProfRootNodes(professionalOptions), [professionalOptions]);

  useEffect(() => {
    setProfCatOpen((prev) => {
      const next = { ...prev };
      for (const root of listProfRootNodes(professionalOptions)) {
        const kids = listProfChildren(professionalOptions, root.id);
        if (kids.some((c) => professionalOptionIds.includes(c.id))) {
          next[root.id] = true;
        }
      }
      return next;
    });
  }, [professionalOptionIds, professionalOptions]);

  const cancelTimeSlotAck = useCallback(() => {
    setPendingTimeSlot(null);
    setTimeSlotAckOpen(false);
  }, []);

  const confirmTimeSlotAck = useCallback(() => {
    if (pendingTimeSlot) {
      setForm((f) => ({ ...f, preferredTime: pendingTimeSlot }));
    }
    setPendingTimeSlot(null);
    setTimeSlotAckOpen(false);
  }, [pendingTimeSlot]);

  useEffect(() => {
    if (!timeSlotAckOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelTimeSlotAck();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [timeSlotAckOpen, cancelTimeSlotAck]);

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
        const issuedPhone = (data.customerPhone ?? '').trim();
        setForm((f) => ({
          ...f,
          customerName: p?.customerName || data.customerName,
          customerPhone: issuedPhone || (p?.customerPhone ?? '').trim() || '',
          customerPhoneSecondary: p?.customerPhone2 ?? '',
          address: p?.address ?? '',
          addressDetail: p?.addressDetail ?? '',
          propertyType: p?.propertyType ?? '',
          areaBasis: p?.areaBasis ?? '',
          areaPyeong: p?.areaPyeong != null ? String(p.areaPyeong) : '',
          preferredDate: p?.preferredDate ?? data.preferredDate ?? kstTodayYmd(),
          preferredTime: p?.preferredTime ?? data.preferredTime ?? '',
          preferredTimeDetail: p?.preferredTimeDetail ?? data.preferredTimeDetail ?? '',
          roomCount: p?.roomCount != null ? String(p.roomCount) : '',
          bathroomCount: p?.bathroomCount != null ? String(p.bathroomCount) : '',
          balconyCount: p?.balconyCount != null ? String(p.balconyCount) : '',
          kitchenCount: p?.kitchenCount != null ? String(p.kitchenCount) : '',
          buildingType: p?.buildingType ?? '',
          moveInDate: p?.moveInDate ?? '',
          specialNotes: data.draftCustomerSpecialNotes ?? '',
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

  /** 시간대 변경 시 구체적 시각을 허용 목록에 맞게 유지 */
  useEffect(() => {
    const locked = Boolean(order?.preferredTimeDetail?.trim());
    if (!order || locked) return;
    const slot = form.preferredTime;
    if (!slot || !isValidOrderTimeSlot(slot)) {
      if (form.preferredTimeDetail) setForm((f) => ({ ...f, preferredTimeDetail: '' }));
      return;
    }
    const next = coercePreferredTimeDetailForSlot(form.preferredTimeDetail, slot);
    if (next !== form.preferredTimeDetail) {
      setForm((f) => ({ ...f, preferredTimeDetail: next }));
    }
  }, [order, form.preferredTime, form.preferredTimeDetail]);

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
      const useTimeRaw = scheduleLockedByAdmin
        ? (order!.preferredTime?.trim() || form.preferredTime)
        : form.preferredTime.trim();
      const useTime = useTimeRaw.trim();
      if (!useDate || !useTime) throw new Error('청소 날짜와 시간을 확인해주세요.');
      if (!isValidOrderTimeSlot(useTime)) {
        throw new Error('시간대를 선택해주세요.');
      }
      const useTimeDetail = detailLockedByAdmin
        ? order!.preferredTimeDetail!.trim()
        : form.preferredTimeDetail.trim() || undefined;
      if (
        !detailLockedByAdmin &&
        form.preferredTimeDetail.trim() &&
        isValidOrderTimeSlot(useTime) &&
        !allowedPreferredTimeDetailValues(useTime).has(form.preferredTimeDetail.trim())
      ) {
        throw new Error('구체적 시각을 해당 시간대 범위에서 선택해 주세요.');
      }
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
      setSubmitErrorModal(e instanceof Error ? e.message : '제출에 실패했습니다.');
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
          <p className="text-lg font-medium text-gray-900 whitespace-pre-line">{successTitle}</p>
          <p className="text-gray-600 mt-2 whitespace-pre-line">{successBody}</p>
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
        <h1 className="text-lg font-semibold text-gray-900 mb-1 whitespace-pre-line">
          {orderFormConfigLine(order?.formConfig?.formTitle, ORDER_FORM_CONFIG_DEFAULTS.formTitle)}
        </h1>
        {order && (
          <div className="mb-6 p-4 bg-white border border-gray-200 rounded text-sm">
            <p className="font-medium text-gray-900">
              총 금액 {(order.totalAmount ?? 0).toLocaleString()}원{' '}
              <span className="whitespace-pre-line align-top">
                {orderFormConfigLine(order.formConfig?.priceLabel, ORDER_FORM_CONFIG_DEFAULTS.priceLabel)}
              </span>
            </p>
            <p className="text-gray-600 mt-1">
              잔금 {(order.balanceAmount ?? 0).toLocaleString()}원, 예약금{' '}
              {(order.depositAmount ?? 0).toLocaleString()}원
            </p>
            <p className="text-gray-600 text-xs mt-1 whitespace-pre-line">
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

        <form onSubmit={handleSubmit} className="space-y-4 pb-20">
          <div>
            <label className={labelCls}>1. 성함 *</label>
            <input
              type="text"
              className={inputCls}
              value={form.customerName}
              onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
              placeholder="이름"
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
            />
            <label className="block text-xs text-gray-600 mb-1">보조 연락처 (필수) *</label>
            <input
              type="tel"
              className={inputCls}
              value={form.customerPhoneSecondary}
              onChange={(e) => setForm((f) => ({ ...f, customerPhoneSecondary: e.target.value }))}
              placeholder="예: 배우자, 가족 연락처"
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
                minYmd={kstTodayYmd()}
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
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '') {
                    setForm((f) => ({ ...f, preferredTime: '' }));
                    return;
                  }
                  if (!isValidOrderTimeSlot(v)) return;
                  if (v === form.preferredTime) return;
                  setPendingTimeSlot(v);
                  setTimeSlotAckOpen(true);
                }}
              >
                <option value="">선택하기</option>
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
            ) : !form.preferredTime || !isValidOrderTimeSlot(form.preferredTime) ? (
              <p className="text-xs text-gray-500 px-1 py-2">
                먼저 위에서 시간대(오전·오후·사이청소)를 선택하신 뒤, 희망 시각을 고를 수 있습니다.
              </p>
            ) : (
              <>
                <select
                  className={inputCls}
                  aria-label="구체적 시각 선택"
                  value={form.preferredTimeDetail}
                  onChange={(e) => setForm((f) => ({ ...f, preferredTimeDetail: e.target.value }))}
                >
                  <option value="">선택 안 함</option>
                  {getPreferredTimeDetailSelectOptions(form.preferredTime).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  {preferredTimeDetailRangeHint(form.preferredTime)} 비워 두셔도 접수는 가능합니다.
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
            <p className={`${labelCls} mb-2`}>12. 현장 사진 첨부 (선택)</p>
            {token ? (
              <OrderFormPhotoSection token={token} disabled={submitting} />
            ) : null}
          </div>

          <div>
            <p className={`${labelCls} mb-2`}>13. 전문 시공 옵션 (선택)</p>
            <div className="space-y-2.5 pl-0.5">
              {professionalOptions.length === 0 ? (
                <p className="text-sm text-gray-500">등록된 전문 시공 옵션이 없습니다.</p>
              ) : (
                profRoots.map((root) => {
                  const kids = listProfChildren(professionalOptions, root.id).filter((c) => c.isActive);
                  const showAsSection = root.isGroup || kids.length > 0;
                  if (showAsSection) {
                    if (kids.length === 0) return null;
                    const kidIds = kids.map((k) => k.id);
                    const catOpen = profCatOpen[root.id] ?? false;
                    return (
                      <div key={root.id} className="space-y-1.5">
                        <label className="flex items-start gap-2.5 text-sm text-gray-800 cursor-pointer leading-snug">
                          <input
                            type="checkbox"
                            checked={catOpen}
                            onChange={(e) => {
                              const on = e.target.checked;
                              setProfCatOpen((p) => ({ ...p, [root.id]: on }));
                              if (!on) {
                                setProfessionalOptionIds((ids) => ids.filter((id) => !kidIds.includes(id)));
                              }
                            }}
                            className="mt-0.5 shrink-0 w-4 h-4 border-gray-300"
                            aria-expanded={catOpen}
                            aria-controls={`prof-sub-${root.id}`}
                          />
                          <span className="min-w-0">
                            {root.emoji ? <span className="mr-1" aria-hidden>{root.emoji}</span> : null}
                            <span
                              className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle border border-gray-300"
                              style={{ backgroundColor: root.color }}
                              aria-hidden
                            />
                            <span className="font-medium">{root.label}</span>
                            <span className="block text-xs font-normal text-gray-500 mt-0.5">
                              선택 시 세부 항목·금액을 고를 수 있습니다.
                            </span>
                          </span>
                        </label>
                        {catOpen ? (
                          <div
                            id={`prof-sub-${root.id}`}
                            className="pl-2 sm:pl-3 space-y-2 border-l-2 border-gray-200"
                            role="group"
                            aria-label={`${root.label} 세부 옵션`}
                          >
                            {kids.map((o) => {
                              const price = formatProfOptionPriceDisplay(o);
                              return (
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
                                    <span className="font-medium">{o.label}</span>
                                    {price ? <span className="text-gray-500"> {price}</span> : null}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  }
                  if (!root.isActive || !isSelectableProfOption(professionalOptions, root)) {
                    return null;
                  }
                  const price = formatProfOptionPriceDisplay(root);
                  return (
                    <label
                      key={root.id}
                      className="flex items-start gap-2.5 text-sm text-gray-800 cursor-pointer leading-snug"
                    >
                      <input
                        type="checkbox"
                        checked={professionalOptionIds.includes(root.id)}
                        onChange={() => toggleProfessionalOption(root.id)}
                        className="mt-0.5 shrink-0 w-4 h-4 border-gray-300"
                      />
                      <span>
                        {root.emoji ? (
                          <span className="mr-1" aria-hidden>
                            {root.emoji}
                          </span>
                        ) : null}
                        <span
                          className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle border border-gray-300"
                          style={{ backgroundColor: root.color }}
                          aria-hidden
                        />
                        <span className="font-medium">{root.label}</span>
                        {price ? <span className="text-gray-500"> {price}</span> : null}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="py-4">
            <div className="mx-auto w-full max-w-lg rounded-xl border border-gray-200 bg-gradient-to-b from-gray-50/95 to-white px-4 py-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-black/[0.03]">
              <label
                htmlFor="agreeTerms"
                className="flex w-full cursor-pointer flex-row items-start gap-3"
              >
                <input
                  type="checkbox"
                  id="agreeTerms"
                  checked={agreeToTerms}
                  onChange={(e) => setAgreeToTerms(e.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 rounded border-2 border-gray-400 text-gray-900 accent-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-800"
                  aria-describedby="agreeTerms-hint"
                />
                <span
                  id="agreeTerms-hint"
                  className="min-w-0 flex-1 text-left text-fluid-base font-semibold leading-snug tracking-tight text-gray-900"
                >
                  <Link
                    to="/info"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-blue-700 underline decoration-2 underline-offset-[3px] transition hover:text-blue-900"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {orderFormConfigLine(
                      order?.formConfig?.infoLinkText,
                      ORDER_FORM_CONFIG_DEFAULTS.infoLinkText
                    )}
                  </Link>
                  <span className="font-semibold text-gray-900"> 에 동의합니다.</span>{' '}
                  <span className="text-fluid-xs font-medium text-gray-500">
                    (클릭 시 전체 내용 보기)
                  </span>
                </span>
              </label>
            </div>
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

        {submitErrorModal ? (
          <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4 animate-[fadeIn_150ms_ease-out]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-submit-error-title"
            onClick={() => setSubmitErrorModal(null)}
          >
            <div
              className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 animate-[popIn_180ms_cubic-bezier(0.2,0.7,0.2,1.2)]"
              onClick={(e) => e.stopPropagation()}
              role="presentation"
            >
              <div className="flex flex-col items-center px-6 pb-5 pt-7 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 ring-8 ring-amber-50/60">
                  <svg
                    className="h-7 w-7 text-amber-500"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 9v4" />
                    <path d="M12 17h.01" />
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                  </svg>
                </div>
                <h2
                  id="order-submit-error-title"
                  className="mt-4 text-base font-semibold tracking-tight text-gray-900"
                >
                  한 가지 확인이 필요해요
                </h2>
                <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-gray-700">
                  {submitErrorModal}
                </p>
                <p className="mt-3 text-xs text-gray-500">
                  해당 항목을 채우신 뒤 다시 제출해 주세요.
                </p>
              </div>
              <div className="flex justify-center border-t border-gray-100 bg-gray-50/60 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setSubmitErrorModal(null)}
                  className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 active:scale-[0.99]"
                  autoFocus
                >
                  확인했어요
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {timeSlotAckOpen && pendingTimeSlot ? (
          <div
            className="fixed inset-0 z-[1001] flex items-end justify-center bg-black/50 backdrop-blur-[2px] p-0 sm:items-center sm:p-4 animate-[fadeIn_150ms_ease-out]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="time-slot-ack-title"
            aria-describedby="time-slot-ack-desc"
            onClick={() => cancelTimeSlotAck()}
          >
            <div
              className="w-full max-h-[min(92dvh,640px)] sm:max-h-[85vh] max-w-lg overflow-hidden rounded-t-2xl bg-white shadow-2xl ring-1 ring-black/5 sm:rounded-2xl animate-[popIn_180ms_cubic-bezier(0.2,0.7,0.2,1.2)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="max-h-[min(92dvh,640px)] sm:max-h-[85vh] overflow-y-auto overscroll-y-contain">
                <div className="border-b border-gray-100 bg-gradient-to-b from-gray-50/90 to-white px-5 pb-4 pt-5 sm:px-6">
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 ring-1 ring-blue-100/80"
                      aria-hidden
                    >
                      <svg
                        className="h-6 w-6 text-blue-700"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 7v6l3 2" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2
                        id="time-slot-ack-title"
                        className="text-base font-semibold leading-snug tracking-tight text-gray-900"
                      >
                        {orderFormConfigLine(
                          order?.formConfig?.timeSlotAckTitle,
                          ORDER_FORM_CONFIG_DEFAULTS.timeSlotAckTitle
                        )}
                      </h2>
                      <p className="mt-1 text-fluid-xs text-gray-500">
                        선택 예정:{' '}
                        <span className="font-medium text-gray-800">
                          {labelForTimeSlot(pendingTimeSlot)}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
                <div id="time-slot-ack-desc" className="px-5 py-4 text-fluid-sm leading-relaxed text-gray-700 sm:px-6">
                  <div className="whitespace-pre-wrap break-words">
                    {orderFormConfigLine(
                      order?.formConfig?.timeSlotAckBody,
                      ORDER_FORM_CONFIG_DEFAULTS.timeSlotAckBody
                    )}
                  </div>
                  <p className="mt-4 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2.5 text-fluid-xs text-amber-950 whitespace-pre-wrap break-words">
                    {orderFormConfigLine(
                      order?.formConfig?.timeSlotAckConsentHint,
                      ORDER_FORM_CONFIG_DEFAULTS.timeSlotAckConsentHint
                    )}
                  </p>
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50/80 px-4 py-3 sm:flex-row sm:justify-end sm:gap-3 sm:px-5">
                <button
                  type="button"
                  onClick={() => cancelTimeSlotAck()}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-fluid-sm font-medium text-gray-800 shadow-sm transition hover:bg-gray-50 active:scale-[0.99] sm:w-auto sm:min-w-[7rem] sm:py-2.5"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => confirmTimeSlotAck()}
                  className="w-full rounded-lg bg-gray-900 px-4 py-3 text-fluid-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 active:scale-[0.99] sm:w-auto sm:min-w-[11rem] sm:py-2.5"
                  autoFocus
                >
                  동의하고 선택하기
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="text-xs text-gray-500 mt-8 text-center space-y-1">
          <p className="whitespace-pre-line">
            {orderFormConfigLine(
              order?.formConfig?.footerNotice1,
              ORDER_FORM_CONFIG_DEFAULTS.footerNotice1
            )}
          </p>
          <p className="whitespace-pre-line">
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
