import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  getFormConfig,
  updateFormConfig,
  getDesignerPreviewOrderToken,
} from '../../api/orderform';
import {
  getEstimateConfig,
  updateEstimateConfig,
  getEstimateOptions,
  createEstimateOption,
  updateEstimateOption,
  deleteEstimateOption,
  type EstimateOption,
} from '../../api/estimate';
import { getToken } from '../../stores/auth';
import { normalizeMsgConfigForEditor, type FormMessagesState } from '../../utils/orderFormCustomerCopy';
import { ORDER_FORM_CONFIG_DEFAULTS } from '../../constants/orderFormConfigDefaults';
import { appendPublicQuery } from '../../utils/publicTenantQuery';
import { useStaffTenantSlugForLinks } from '../../hooks/useStaffTenantSlugForLinks';
import { AdminOrderFormNoticePage } from './AdminOrderFormNoticePage';
import { AdminOrderFormSpecialtySettingsPage } from './AdminOrderFormSpecialtySettingsPage';
import { AdminOrderFormLeadSourceSettingsPage } from './AdminOrderFormLeadSourceSettingsPage';

/** 서버 미리보기 발주서와 동일 기준 (표시 안내용) */
const DEMO_PYEONG = 32;

/** 폼 메시지 편집 — 줄바꿈 가능 */
const MSG_TEXTAREA_CLS =
  'w-full resize-y rounded border border-gray-300 px-2 py-2 text-fluid-sm leading-relaxed';

type DesignerPanel =
  | 'title'
  | 'price'
  | 'review'
  | 'footer'
  | 'success'
  | 'timeAck'
  | 'guide'
  | 'specialty'
  | 'leadSource'
  | 'fields';

const PANEL_TAB_ORDER: DesignerPanel[] = [
  'title',
  'price',
  'review',
  'footer',
  'success',
  'timeAck',
  'guide',
  'specialty',
  'leadSource',
  'fields',
];

const PANEL_TAB_LABEL: Record<DesignerPanel, string> = {
  title: '제목',
  price: '금액·견적',
  review: '리뷰',
  footer: '하단안내',
  success: '제출완료',
  timeAck: '시간대확인',
  guide: '안내·동의',
  specialty: '전문시공',
  leadSource: '유입경로',
  fields: '입력안내',
};

function parsePanel(raw: string | null): DesignerPanel {
  if (raw && PANEL_TAB_ORDER.includes(raw as DesignerPanel)) return raw as DesignerPanel;
  return 'title';
}

export function AdminOrderFormCustomerPreviewPage() {
  const token = getToken();
  const staffTenantSlug = useStaffTenantSlugForLinks(token);
  const [searchParams, setSearchParams] = useSearchParams();
  const activePanel = parsePanel(searchParams.get('panel'));

  const setPanel = useCallback(
    (p: DesignerPanel) => {
      setSearchParams({ panel: p }, { replace: true });
    },
    [setSearchParams]
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);

  const [configForm, setConfigForm] = useState({
    pricePerPyeong: '',
    minimumTotalAmount: '',
    depositAmount: '',
  });
  const [configSaving, setConfigSaving] = useState(false);
  const [options, setOptions] = useState<EstimateOption[]>([]);
  const [newOptionName, setNewOptionName] = useState('');
  const [newOptionAmount, setNewOptionAmount] = useState('');

  const [msgConfig, setMsgConfig] = useState<FormMessagesState>(() =>
    normalizeMsgConfigForEditor({
      formTitle: '',
      priceLabel: '',
      reviewEventText: '',
      footerNotice1: '',
      footerNotice2: '',
      infoContent: null,
      infoLinkText: null,
      submitSuccessTitle: '',
      submitSuccessBody: '',
    })
  );
  const [msgSaving, setMsgSaving] = useState(false);

  const refreshEstimate = useCallback(() => {
    if (!token) return;
    getEstimateConfig(token)
      .then((c) => {
        setConfigForm({
          pricePerPyeong: String(c.pricePerPyeong),
          minimumTotalAmount: String(c.minimumTotalAmount ?? 0),
          depositAmount: String(c.depositAmount),
        });
      })
      .catch(() => {});
  }, [token]);

  const refreshOptions = useCallback(() => {
    if (!token) return;
    getEstimateOptions(token).then((r) => setOptions(r.items)).catch(() => {});
  }, [token]);

  const refreshMsg = useCallback(() => {
    if (!token) return;
    getFormConfig(token)
      .then((c) => {
        setMsgConfig(normalizeMsgConfigForEditor(c));
      })
      .catch(() => {});
  }, [token]);

  /** 서버 미리보기 발주서 금액 동기화 후 iframe reload — 고객 화면과 동일 컴포넌트 반영 */
  const bumpIframe = useCallback(async () => {
    if (!token) return;
    try {
      await getDesignerPreviewOrderToken(token);
      setIframeKey((k) => k + 1);
    } catch {
      /* ignore */
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getDesignerPreviewOrderToken(token),
      getFormConfig(token),
      getEstimateConfig(token),
      getEstimateOptions(token),
    ])
      .then(([pv, fc, ec, eo]) => {
        if (cancelled) return;
        setPreviewToken(pv.token);
        setMsgConfig(normalizeMsgConfigForEditor(fc));
        setConfigForm({
          pricePerPyeong: String(ec.pricePerPyeong),
          minimumTotalAmount: String(ec.minimumTotalAmount ?? 0),
          depositAmount: String(ec.depositAmount),
        });
        setOptions(eo.items);
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '불러오기에 실패했습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token || (activePanel !== 'guide' && activePanel !== 'timeAck')) return;
    getFormConfig(token)
      .then((c) => setMsgConfig(normalizeMsgConfigForEditor(c)))
      .catch(() => {});
  }, [token, activePanel]);

  const iframeSrc =
    typeof window !== 'undefined' && previewToken
      ? appendPublicQuery(`${window.location.origin}/order/${encodeURIComponent(previewToken)}`, {
          tenantSlug: staffTenantSlug || null,
        })
      : '';

  const handleSaveMsg = async () => {
    if (!token) return;
    setMsgSaving(true);
    setError(null);
    try {
      await updateFormConfig(token, {
        formTitle: msgConfig.formTitle || undefined,
        priceLabel: msgConfig.priceLabel || undefined,
        // 리뷰 문구는 빈 값('')도 그대로 전송해 "숨김"을 저장 (undefined로 바꾸면 서버가 무시 → 기본문구 복귀)
        reviewEventText: msgConfig.reviewEventText ?? '',
        footerNotice1: msgConfig.footerNotice1 || undefined,
        footerNotice2: msgConfig.footerNotice2 || undefined,
        submitSuccessTitle: msgConfig.submitSuccessTitle || undefined,
        submitSuccessBody: msgConfig.submitSuccessBody || undefined,
        timeSlotAckTitle: msgConfig.timeSlotAckTitle || undefined,
        timeSlotAckBody: msgConfig.timeSlotAckBody || undefined,
        timeSlotAckConsentHint: msgConfig.timeSlotAckConsentHint || undefined,
      });
      refreshMsg();
      await bumpIframe();
    } catch (e) {
      setError(e instanceof Error ? e.message : '폼 메시지 저장에 실패했습니다.');
    } finally {
      setMsgSaving(false);
    }
  };

  const handleSaveEstimate = async () => {
    if (!token) return;
    setConfigSaving(true);
    setError(null);
    try {
      const price = parseInt(configForm.pricePerPyeong, 10);
      const minimum = parseInt(configForm.minimumTotalAmount, 10);
      const deposit = parseInt(configForm.depositAmount, 10);
      if (Number.isNaN(price) || Number.isNaN(minimum) || Number.isNaN(deposit)) {
        throw new Error('평당 금액·최소 금액·예약금을 숫자로 입력해 주세요.');
      }
      await updateEstimateConfig(token, {
        pricePerPyeong: price,
        minimumTotalAmount: Math.max(0, minimum),
        depositAmount: deposit,
      });
      refreshEstimate();
      refreshOptions();
      await bumpIframe();
    } catch (e) {
      setError(e instanceof Error ? e.message : '견적 설정 저장에 실패했습니다.');
    } finally {
      setConfigSaving(false);
    }
  };

  const handleAddOption = async () => {
    if (!token || !newOptionName.trim()) return;
    try {
      await createEstimateOption(token, {
        name: newOptionName.trim(),
        extraAmount: newOptionAmount ? parseInt(newOptionAmount, 10) : 0,
      });
      setNewOptionName('');
      setNewOptionAmount('');
      refreshOptions();
      await bumpIframe();
    } catch (e) {
      setError(e instanceof Error ? e.message : '옵션 추가에 실패했습니다.');
    }
  };

  const handleToggleOption = async (opt: EstimateOption) => {
    if (!token) return;
    try {
      await updateEstimateOption(token, opt.id, { isActive: !opt.isActive });
      refreshOptions();
      await bumpIframe();
    } catch (e) {
      setError(e instanceof Error ? e.message : '옵션 수정에 실패했습니다.');
    }
  };

  const handleDeleteOption = async (opt: EstimateOption) => {
    if (!token) return;
    if (!confirm(`"${opt.name}" 옵션을 삭제할까요?`)) return;
    try {
      await deleteEstimateOption(token, opt.id);
      refreshOptions();
      await bumpIframe();
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제에 실패했습니다.');
    }
  };

  const panelTitle: Record<DesignerPanel, string> = {
    title: '폼 제목',
    price: '금액·견적·추가 옵션',
    review: '리뷰 이벤트 문구',
    footer: '하단 안내 문구',
    success: '제출 완료 문구',
    timeAck: '시간대 확인 모달',
    guide: '안내사항·동의 링크',
    specialty: '전문 시공 옵션',
    leadSource: '유입경로(플랫폼)',
    fields: '입력 필드',
  };

  return (
    <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col gap-3">
      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 sm:px-4">
        <h2 className="text-fluid-base font-semibold text-gray-900">고객 발주서 편집</h2>
        <p className="mt-1 text-fluid-xs text-gray-400">
          여기서는 <b>모든 발주서에 공통으로 쓰는 메시지·옵션</b>(가격 라벨·하단 안내·제출완료 문구·시간대 안내·견적/전문시공 옵션)을 설정합니다. 발주서별 <b>제목·아이콘·추가 항목</b>은{' '}
          <Link to="/admin/inquiries/order-templates" className="text-blue-700 underline hover:text-blue-800">
            발주서 양식
          </Link>
          에서 만듭니다.
        </p>
        {error ? <p className="mt-2 text-fluid-xs text-red-600">{error}</p> : null}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-amber-50 px-3 py-2">
            <p className="text-[11px] font-medium text-amber-950">실제 고객 발주서 화면</p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void bumpIframe()}
                className="rounded border border-amber-300 bg-white px-2 py-1 text-[11px] font-medium text-amber-950 hover:bg-amber-100"
              >
                고객 화면 새로고침
              </button>
              {previewToken ? (
                <a
                  href={iframeSrc}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-medium text-blue-700 underline"
                >
                  새 탭
                </a>
              ) : null}
            </div>
          </div>
          <div className="min-h-0 flex-1 bg-white p-2">
            {loading ? (
              <div className="flex h-[min(70vh,560px)] items-center justify-center text-fluid-sm text-gray-500">
                고객 화면 불러오는 중…
              </div>
            ) : iframeSrc ? (
              <iframe
                key={iframeKey}
                title="고객 발주서"
                src={iframeSrc}
                className="h-[min(78vh,920px)] w-full min-h-[420px] rounded border border-gray-200 bg-gray-50 sm:h-[min(82vh,960px)]"
              />
            ) : (
              <p className="p-4 text-fluid-sm text-gray-600">미리보기 주소를 불러오지 못했습니다.</p>
            )}
          </div>
          <p className="shrink-0 border-t border-gray-200 bg-gray-50 px-3 py-1.5 text-center text-[10px] text-gray-500">
            안내사항·전문 시공 등 저장 후에는 「고객 화면 새로고침」으로 반영하세요.
          </p>
        </div>

        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="shrink-0 border-b border-gray-200 bg-gray-50 px-2 py-2">
            <div
              className="flex flex-wrap gap-1 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              role="tablist"
              aria-label="편집 항목 선택"
            >
              {PANEL_TAB_ORDER.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={activePanel === id}
                  onClick={() => setPanel(id)}
                  className={`shrink-0 rounded border px-2 py-1 text-[10px] font-medium sm:text-[11px] ${
                    activePanel === id
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {PANEL_TAB_LABEL[id]}
                </button>
              ))}
            </div>
          </div>
          <div className="shrink-0 border-b border-gray-100 px-3 py-2 sm:px-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">편집</p>
            <h3 className="text-fluid-sm font-semibold text-gray-900">{panelTitle[activePanel]}</h3>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-3 sm:px-4 sm:py-4">
            {activePanel === 'title' && (
              <div className="space-y-3">
                <p className="rounded border border-blue-100 bg-blue-50 px-2.5 py-2 text-[11px] leading-relaxed text-blue-900">
                  이 제목은 <b>기본 발주서</b>의 제목입니다. 「발주서 양식」에서 만든 다른 발주서로 발급하면, 그 양식에 지정한 <b>제목·아이콘이 우선</b> 표시됩니다.
                </p>
                <label className="block text-fluid-xs font-medium text-gray-700">폼 제목</label>
                <textarea
                  rows={4}
                  className={`${MSG_TEXTAREA_CLS} min-h-[5rem]`}
                  value={msgConfig.formTitle}
                  onChange={(e) => setMsgConfig((c) => ({ ...c, formTitle: e.target.value }))}
                />
                <button
                  type="button"
                  onClick={() => void handleSaveMsg()}
                  disabled={msgSaving}
                  className="rounded bg-gray-900 px-3 py-2 text-fluid-xs font-medium text-white disabled:opacity-50"
                >
                  {msgSaving ? '저장 중…' : '저장'}
                </button>
              </div>
            )}

            {activePanel === 'price' && (
              <div className="space-y-5">
                <section>
                  <h4 className="mb-2 text-fluid-xs font-semibold text-gray-800">견적 기본</h4>
                  <p className="mb-2 text-[11px] text-gray-500">
                    왼쪽 금액은 서버에서 {DEMO_PYEONG}평·추가 옵션 합계와 예약금을 반영해 미리보기 발주서와 동기화됩니다.
                  </p>
                  <div className="grid max-w-md grid-cols-2 gap-3">
                    <div>
                      <label className="block text-fluid-xs text-gray-600">평당 금액 (원)</label>
                      <input
                        type="number"
                        className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-fluid-sm"
                        value={configForm.pricePerPyeong}
                        onChange={(e) => setConfigForm((f) => ({ ...f, pricePerPyeong: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-fluid-xs text-gray-600">최소 금액 (원)</label>
                      <input
                        type="number"
                        min={0}
                        className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-fluid-sm"
                        value={configForm.minimumTotalAmount}
                        onChange={(e) => setConfigForm((f) => ({ ...f, minimumTotalAmount: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-fluid-xs text-gray-600">예약금 (원)</label>
                      <input
                        type="number"
                        className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-fluid-sm"
                        value={configForm.depositAmount}
                        onChange={(e) => setConfigForm((f) => ({ ...f, depositAmount: e.target.value }))}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSaveEstimate()}
                    disabled={configSaving}
                    className="mt-3 rounded bg-gray-900 px-3 py-2 text-fluid-xs font-medium text-white disabled:opacity-50"
                  >
                    {configSaving ? '저장 중…' : '견적 저장'}
                  </button>
                </section>
                <section>
                  <h4 className="mb-2 text-fluid-xs font-semibold text-gray-800">금액 옆 라벨 (폼 메시지)</h4>
                  <textarea
                    rows={3}
                    className={`max-w-md ${MSG_TEXTAREA_CLS} min-h-[4rem]`}
                    value={msgConfig.priceLabel ?? ''}
                    onChange={(e) => setMsgConfig((c) => ({ ...c, priceLabel: e.target.value }))}
                    placeholder={ORDER_FORM_CONFIG_DEFAULTS.priceLabel}
                  />
                  <button
                    type="button"
                    onClick={() => void handleSaveMsg()}
                    disabled={msgSaving}
                    className="mt-2 rounded border border-gray-300 bg-white px-3 py-1.5 text-fluid-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                  >
                    문구 저장
                  </button>
                </section>
                <section>
                  <h4 className="mb-2 text-fluid-xs font-semibold text-gray-800">추가 옵션 (금액에 합산)</h4>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <input
                      type="text"
                      className="min-w-[8rem] flex-1 rounded border border-gray-300 px-2 py-1.5 text-fluid-xs"
                      placeholder="옵션명"
                      value={newOptionName}
                      onChange={(e) => setNewOptionName(e.target.value)}
                    />
                    <input
                      type="number"
                      className="w-24 rounded border border-gray-300 px-2 py-1.5 text-fluid-xs"
                      placeholder="추가금"
                      value={newOptionAmount}
                      onChange={(e) => setNewOptionAmount(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => void handleAddOption()}
                      className="rounded bg-gray-700 px-2 py-1.5 text-fluid-xs text-white"
                    >
                      추가
                    </button>
                  </div>
                  <ul className="max-w-lg space-y-1">
                    {options.map((opt) => (
                      <li
                        key={opt.id}
                        className="flex items-center justify-between gap-2 border-b border-gray-100 py-1.5 text-fluid-xs last:border-0"
                      >
                        <span className={opt.isActive ? '' : 'text-gray-400 line-through'}>
                          {opt.name}{' '}
                          {opt.extraAmount > 0 ? `+${opt.extraAmount.toLocaleString('ko-KR')}원` : ''}
                        </span>
                        <span className="flex shrink-0 gap-1">
                          <button type="button" className="text-blue-700" onClick={() => void handleToggleOption(opt)}>
                            {opt.isActive ? '끄기' : '켜기'}
                          </button>
                          <button type="button" className="text-red-600" onClick={() => void handleDeleteOption(opt)}>
                            삭제
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            )}

            {activePanel === 'review' && (
              <div className="space-y-3">
                <label className="block text-fluid-xs font-medium text-gray-700">리뷰 이벤트 문구</label>
                <textarea
                  rows={5}
                  className={`${MSG_TEXTAREA_CLS} min-h-[6rem]`}
                  value={msgConfig.reviewEventText ?? ''}
                  onChange={(e) => setMsgConfig((c) => ({ ...c, reviewEventText: e.target.value }))}
                  placeholder="비워 두면 발주서에서 리뷰 문구가 표시되지 않습니다."
                />
                <p className="text-fluid-2xs text-gray-500">
                  내용을 모두 지우고 저장하면 고객 발주서에서 리뷰 문구가 숨겨집니다.
                </p>
                <button
                  type="button"
                  onClick={() => void handleSaveMsg()}
                  disabled={msgSaving}
                  className="rounded bg-gray-900 px-3 py-2 text-fluid-xs font-medium text-white disabled:opacity-50"
                >
                  {msgSaving ? '저장 중…' : '저장'}
                </button>
              </div>
            )}

            {activePanel === 'footer' && (
              <div className="space-y-3">
                <p className="text-fluid-xs text-gray-600">
                  제출 완료 후 확인 화면·고객 안내 문자 하단에 표시됩니다. 작성 중 발주서 본문에는 나오지 않습니다.
                </p>
                <div>
                  <label className="block text-fluid-xs text-gray-700">안내 문구 1</label>
                  <textarea
                    rows={4}
                    className={`mt-1 ${MSG_TEXTAREA_CLS} min-h-[5rem]`}
                    value={msgConfig.footerNotice1 ?? ''}
                    onChange={(e) => setMsgConfig((c) => ({ ...c, footerNotice1: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-fluid-xs text-gray-700">안내 문구 2</label>
                  <textarea
                    rows={4}
                    className={`mt-1 ${MSG_TEXTAREA_CLS} min-h-[5rem]`}
                    value={msgConfig.footerNotice2 ?? ''}
                    onChange={(e) => setMsgConfig((c) => ({ ...c, footerNotice2: e.target.value }))}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleSaveMsg()}
                  disabled={msgSaving}
                  className="rounded bg-gray-900 px-3 py-2 text-fluid-xs font-medium text-white disabled:opacity-50"
                >
                  {msgSaving ? '저장 중…' : '저장'}
                </button>
              </div>
            )}

            {activePanel === 'success' && (
              <div className="space-y-3">
                <p className="text-fluid-xs text-gray-600">
                  제출 완료 후 화면 문구입니다. 저장 후 왼쪽에서 제출까지 확인하거나 새 탭으로만 볼 수 있습니다.
                </p>
                <div>
                  <label className="block text-fluid-xs text-gray-700">제출 완료 제목</label>
                  <textarea
                    rows={3}
                    className={`mt-1 ${MSG_TEXTAREA_CLS} min-h-[4rem]`}
                    value={msgConfig.submitSuccessTitle ?? ''}
                    onChange={(e) => setMsgConfig((c) => ({ ...c, submitSuccessTitle: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-fluid-xs text-gray-700">제출 완료 안내</label>
                  <textarea
                    rows={6}
                    className={`mt-1 ${MSG_TEXTAREA_CLS} min-h-[8rem]`}
                    value={msgConfig.submitSuccessBody ?? ''}
                    onChange={(e) => setMsgConfig((c) => ({ ...c, submitSuccessBody: e.target.value }))}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleSaveMsg()}
                  disabled={msgSaving}
                  className="rounded bg-gray-900 px-3 py-2 text-fluid-xs font-medium text-white disabled:opacity-50"
                >
                  {msgSaving ? '저장 중…' : '저장'}
                </button>
              </div>
            )}

            {activePanel === 'timeAck' && (
              <div className="space-y-3">
                <p className="text-fluid-xs text-gray-600">
                  고객이 시간대(오전·오후·사이청소)를 바꿀 때 뜨는 확인 모달 문구입니다. 저장 후 미리보기에서 드롭다운으로
                  확인하세요.
                </p>
                <div>
                  <label className="block text-fluid-xs font-medium text-gray-700">모달 제목</label>
                  <textarea
                    rows={2}
                    className={`mt-1 ${MSG_TEXTAREA_CLS} min-h-[3rem]`}
                    value={msgConfig.timeSlotAckTitle ?? ''}
                    onChange={(e) => setMsgConfig((c) => ({ ...c, timeSlotAckTitle: e.target.value }))}
                    placeholder={ORDER_FORM_CONFIG_DEFAULTS.timeSlotAckTitle}
                  />
                </div>
                <div>
                  <label className="block text-fluid-xs font-medium text-gray-700">본문</label>
                  <textarea
                    rows={12}
                    className={`mt-1 min-h-[180px] ${MSG_TEXTAREA_CLS}`}
                    value={msgConfig.timeSlotAckBody ?? ''}
                    onChange={(e) => setMsgConfig((c) => ({ ...c, timeSlotAckBody: e.target.value }))}
                    placeholder={ORDER_FORM_CONFIG_DEFAULTS.timeSlotAckBody.slice(0, 80)}
                  />
                </div>
                <div>
                  <label className="block text-fluid-xs font-medium text-gray-700">하단 안내(노란 박스)</label>
                  <textarea
                    rows={4}
                    className={`mt-1 min-h-[72px] ${MSG_TEXTAREA_CLS}`}
                    value={msgConfig.timeSlotAckConsentHint ?? ''}
                    onChange={(e) => setMsgConfig((c) => ({ ...c, timeSlotAckConsentHint: e.target.value }))}
                    placeholder={ORDER_FORM_CONFIG_DEFAULTS.timeSlotAckConsentHint}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleSaveMsg()}
                  disabled={msgSaving}
                  className="rounded bg-gray-900 px-3 py-2 text-fluid-xs font-medium text-white disabled:opacity-50"
                >
                  {msgSaving ? '저장 중…' : '저장'}
                </button>
              </div>
            )}

            {activePanel === 'guide' && (
              <div className="max-w-none">
                <AdminOrderFormNoticePage embedded />
              </div>
            )}

            {activePanel === 'specialty' && (
              <div>
                <AdminOrderFormSpecialtySettingsPage onCatalogChanged={bumpIframe} />
              </div>
            )}

            {activePanel === 'leadSource' && (
              <div>
                <AdminOrderFormLeadSourceSettingsPage />
              </div>
            )}

            {activePanel === 'fields' && (
              <div className="space-y-3 text-fluid-sm text-gray-700">
                <p>
                  왼쪽 입력란 레이아웃은 실제 고객 페이지와 동일합니다. 성함·주소 등 항목 순서는 폼 구조로 고정되어
                  있습니다.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setPanel('guide')}
                    className="rounded border border-gray-300 bg-white px-3 py-1.5 text-fluid-xs font-medium hover:bg-gray-50"
                  >
                    안내·동의 링크 편집으로
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanel('title')}
                    className="rounded border border-gray-300 bg-white px-3 py-1.5 text-fluid-xs font-medium hover:bg-gray-50"
                  >
                    폼 제목 편집으로
                  </button>
                  <Link
                    to="/admin/inquiries/order-customer-preview?panel=guide"
                    className="inline-flex items-center rounded border border-blue-200 bg-blue-50 px-3 py-1.5 text-fluid-xs font-medium text-blue-800 hover:bg-blue-100"
                  >
                    안내·동의 편집(미리보기)
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
