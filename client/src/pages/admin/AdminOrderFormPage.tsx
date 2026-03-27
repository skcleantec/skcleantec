import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AdminOrderFormNoticePage } from './AdminOrderFormNoticePage';
import { AdminOrderFormSpecialtySettingsPage } from './AdminOrderFormSpecialtySettingsPage';
import {
  getEstimateConfig,
  updateEstimateConfig,
  getEstimateOptions,
  createEstimateOption,
  updateEstimateOption,
  deleteEstimateOption,
  type EstimateOption,
} from '../../api/estimate';
import {
  getOrderForms,
  createOrderForm,
  getFormConfig,
  updateFormConfig,
  type OrderForm,
  type OrderFormConfigPublic,
} from '../../api/orderform';
import { getToken } from '../../stores/auth';
import { ORDER_TIME_SLOT_OPTIONS } from '../../constants/orderFormSchedule';
import {
  ORDER_FORM_CONFIG_DEFAULTS,
  orderFormConfigLine,
} from '../../constants/orderFormConfigDefaults';

type Tab = 'config' | 'messages' | 'issue' | 'list' | 'specialty' | 'notice';

const VALID_TABS: Tab[] = ['config', 'messages', 'issue', 'list', 'specialty', 'notice'];

function parseTabParam(raw: string | null): Tab {
  if (raw && VALID_TABS.includes(raw as Tab)) return raw as Tab;
  return 'issue';
}

type FormMsgDefaultKey = keyof typeof ORDER_FORM_CONFIG_DEFAULTS;

function withDefaultText(raw: string | null | undefined, key: FormMsgDefaultKey): string {
  return orderFormConfigLine(raw, ORDER_FORM_CONFIG_DEFAULTS[key]);
}

/** 폼 메시지 탭에서 다루는 필드 (고객 안내 본문은 발주서 화면의 안내사항설정 탭에서 편집) */
type FormMessagesState = Pick<
  OrderFormConfigPublic,
  | 'formTitle'
  | 'priceLabel'
  | 'reviewEventText'
  | 'footerNotice1'
  | 'footerNotice2'
  | 'submitSuccessTitle'
  | 'submitSuccessBody'
>;

/** API 응답을 편집용 상태로: 비어 있는 항목은 기본 문구로 채워 placeholder 없이 바로 수정 가능 */
function normalizeMsgConfigForEditor(c: OrderFormConfigPublic): FormMessagesState {
  return {
    formTitle: withDefaultText(c.formTitle, 'formTitle'),
    priceLabel: withDefaultText(c.priceLabel, 'priceLabel'),
    reviewEventText: withDefaultText(c.reviewEventText, 'reviewEventText'),
    footerNotice1: withDefaultText(c.footerNotice1, 'footerNotice1'),
    footerNotice2: withDefaultText(c.footerNotice2, 'footerNotice2'),
    submitSuccessTitle: withDefaultText(c.submitSuccessTitle, 'submitSuccessTitle'),
    submitSuccessBody: withDefaultText(c.submitSuccessBody, 'submitSuccessBody'),
  };
}

export function AdminOrderFormPage() {
  const token = getToken();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => parseTabParam(searchParams.get('tab')));

  useEffect(() => {
    setTab(parseTabParam(searchParams.get('tab')));
  }, [searchParams]);

  const goTab = (t: Tab) => {
    setTab(t);
    if (t === 'issue') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab: t }, { replace: true });
    }
  };
  const [options, setOptions] = useState<EstimateOption[]>([]);
  const [orderForms, setOrderForms] = useState<OrderForm[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 발급 폼
  const [issueForm, setIssueForm] = useState({
    customerName: '',
    totalAmount: '',
    depositAmount: '20000',
    balanceAmount: '',
    optionNote: '',
    preferredDate: '',
    preferredTime: '오전',
    preferredTimeDetail: '',
  });
  const [newOrder, setNewOrder] = useState<OrderForm | null>(null);
  const [issueLoading, setIssueLoading] = useState(false);

  // 설정 폼
  const [configForm, setConfigForm] = useState({ pricePerPyeong: '', depositAmount: '' });
  const [newOptionName, setNewOptionName] = useState('');
  const [newOptionAmount, setNewOptionAmount] = useState('');
  const [configSaving, setConfigSaving] = useState(false);

  // 폼 메시지 설정 (빈 API와 동일하게 기본 문구로 채워 두어 첫 화면부터 실제 문구가 보임)
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

  const refreshConfig = () => {
    if (!token) return;
    getEstimateConfig(token).then((c) => {
      setConfigForm({
        pricePerPyeong: String(c.pricePerPyeong),
        depositAmount: String(c.depositAmount),
      });
    }).catch(() => setError('설정을 불러올 수 없습니다.'));
  };

  const refreshOptions = () => {
    if (!token) return;
    getEstimateOptions(token).then((r) => setOptions(r.items)).catch(() => {});
  };

  const refreshOrderForms = () => {
    if (!token) return;
    setLoading(true);
    getOrderForms(token)
      .then((r) => setOrderForms(r.items))
      .catch(() => setError('발주서 목록을 불러올 수 없습니다.'))
      .finally(() => setLoading(false));
  };

  const refreshMsgConfig = () => {
    if (!token) return;
    getFormConfig(token)
      .then((c) => setMsgConfig(normalizeMsgConfigForEditor(c)))
      .catch(() => {
        setError('폼 메시지를 불러올 수 없습니다. 기본값으로 편집 가능합니다.');
        setMsgConfig(
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
      });
  };

  useEffect(() => {
    if (!token) return;
    refreshConfig();
    refreshOptions();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    refreshMsgConfig();
  }, [token]);

  useEffect(() => {
    if (!token || tab !== 'list') return;
    refreshOrderForms();
  }, [token, tab]);

  const handleSaveConfig = async () => {
    if (!token) return;
    setConfigSaving(true);
    setError(null);
    try {
      const price = parseInt(configForm.pricePerPyeong, 10);
      const deposit = parseInt(configForm.depositAmount, 10);
      if (isNaN(price) || isNaN(deposit)) throw new Error('숫자를 입력해주세요.');
      await updateEstimateConfig(token, {
        pricePerPyeong: price,
        depositAmount: deposit,
      });
      refreshConfig();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setConfigSaving(false);
    }
  };

  const handleAddOption = async () => {
    if (!token || !newOptionName.trim()) return;
    setError(null);
    try {
      await createEstimateOption(token, {
        name: newOptionName.trim(),
        extraAmount: newOptionAmount ? parseInt(newOptionAmount, 10) : 0,
      });
      setNewOptionName('');
      setNewOptionAmount('');
      refreshOptions();
    } catch (e) {
      setError(e instanceof Error ? e.message : '추가 실패');
    }
  };

  const handleToggleOption = async (opt: EstimateOption) => {
    if (!token) return;
    try {
      await updateEstimateOption(token, opt.id, { isActive: !opt.isActive });
      refreshOptions();
    } catch (e) {
      setError(e instanceof Error ? e.message : '수정 실패');
    }
  };

  const handleSaveMsgConfig = async () => {
    if (!token) return;
    setMsgSaving(true);
    setError(null);
    try {
      await updateFormConfig(token, {
        formTitle: msgConfig.formTitle || undefined,
        priceLabel: msgConfig.priceLabel || undefined,
        reviewEventText: msgConfig.reviewEventText || undefined,
        footerNotice1: msgConfig.footerNotice1 || undefined,
        footerNotice2: msgConfig.footerNotice2 || undefined,
        submitSuccessTitle: msgConfig.submitSuccessTitle || undefined,
        submitSuccessBody: msgConfig.submitSuccessBody || undefined,
      });
      refreshMsgConfig();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setMsgSaving(false);
    }
  };

  const handleDeleteOption = async (opt: EstimateOption) => {
    if (!token) return;
    if (!confirm(`"${opt.name}" 옵션을 비활성화할까요?`)) return;
    try {
      await deleteEstimateOption(token, opt.id);
      refreshOptions();
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패');
    }
  };

  const addToTotalAmount = (delta: number) => {
    setIssueForm((f) => {
      const raw = f.totalAmount.replace(/,/g, '').trim();
      const n = parseInt(raw, 10);
      const base = Number.isFinite(n) && !Number.isNaN(n) ? n : 0;
      return { ...f, totalAmount: String(base + delta) };
    });
  };

  const handleIssue = async () => {
    if (!token) return;
    const total = parseInt(issueForm.totalAmount.replace(/,/g, ''), 10);
    if (!issueForm.customerName.trim() || isNaN(total) || total < 0) {
      setError('고객명과 총 금액을 입력해주세요.');
      return;
    }
    setIssueLoading(true);
    setError(null);
    try {
      const deposit = issueForm.depositAmount
        ? parseInt(issueForm.depositAmount.replace(/,/g, ''), 10)
        : 20000;
      const balance = issueForm.balanceAmount
        ? parseInt(issueForm.balanceAmount.replace(/,/g, ''), 10)
        : Math.max(0, total - deposit);
      const order = await createOrderForm(token, {
        customerName: issueForm.customerName.trim(),
        totalAmount: total,
        depositAmount: deposit,
        balanceAmount: balance,
        optionNote: issueForm.optionNote.trim() || undefined,
        preferredDate: issueForm.preferredDate.trim() || undefined,
        preferredTime: issueForm.preferredDate.trim() ? issueForm.preferredTime : undefined,
        preferredTimeDetail: issueForm.preferredTimeDetail.trim() || undefined,
      });
      setNewOrder(order);
      setIssueForm({
        ...issueForm,
        customerName: '',
        totalAmount: '',
        balanceAmount: '',
        optionNote: '',
        preferredDate: '',
        preferredTime: '오전',
        preferredTimeDetail: '',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : '발급 실패');
    } finally {
      setIssueLoading(false);
    }
  };

  const getOrderLink = (orderToken: string) =>
    `${window.location.origin}/order/${orderToken}`;

  const getCsLink = () => `${window.location.origin}/cs`;

  const getOrderMessage = (order: OrderForm) => {
    const link = getOrderLink(order.token);
    const csLink = getCsLink();
    const title = withDefaultText(msgConfig.formTitle, 'formTitle');
    const priceLabel = withDefaultText(msgConfig.priceLabel, 'priceLabel');
    const reviewText = withDefaultText(msgConfig.reviewEventText, 'reviewEventText');
    const footer1 = withDefaultText(msgConfig.footerNotice1, 'footerNotice1');
    const footer2 = withDefaultText(msgConfig.footerNotice2, 'footerNotice2');

    let msg = `${title}

총 금액 ${order.totalAmount.toLocaleString()}원 ${priceLabel}
잔금 ${order.balanceAmount.toLocaleString()}원, 예약금 ${order.depositAmount.toLocaleString()}원
${reviewText}`;

    if (order.preferredDate && order.preferredTime) {
      const slotLabel =
        ORDER_TIME_SLOT_OPTIONS.find((o) => o.value === order.preferredTime)?.label ??
        order.preferredTime;
      msg += `\n청소일시: ${order.preferredDate} (${slotLabel})`;
    }
    if (order.preferredTimeDetail?.trim()) {
      msg += `\n희망 시각: ${order.preferredTimeDetail.trim()}`;
    }
    if (order.optionNote) {
      msg += `\n${order.optionNote}`;
    }

    msg += `

아래 링크에서 예약확정서를 작성해 주세요.
${link}

청소 후 청소팀 태도, 고객 불편 관련 신고는 본사에 직접 요청해주시면 바로 시정처리 해드리겠습니다.
신고 URL: ${csLink}

${footer1}
${footer2}`;

    return msg;
  };

  const copyLink = (orderToken: string) => {
    navigator.clipboard.writeText(getOrderLink(orderToken));
    alert('링크가 복사되었습니다.');
  };

  const copyMessage = (order: OrderForm) => {
    navigator.clipboard.writeText(getOrderMessage(order));
    alert('고객 발송용 메시지가 복사되었습니다.');
  };

  const openInNewTab = (orderToken: string) => {
    window.open(getOrderLink(orderToken), '_blank', 'noopener');
  };

  const tabClass = (t: Tab) =>
    `px-3 py-2 text-sm font-medium rounded ${tab === t ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:text-gray-900'}`;

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-4">발주서</h1>

      <div
        className="flex flex-wrap items-center gap-1 mb-6 w-full"
        role="tablist"
        aria-label="발주서 하위 메뉴"
      >
        <button type="button" onClick={() => goTab('config')} className={`${tabClass('config')} whitespace-nowrap`}>
          설정
        </button>
        <button type="button" onClick={() => goTab('messages')} className={`${tabClass('messages')} whitespace-nowrap`}>
          폼 메시지
        </button>
        <button type="button" onClick={() => goTab('issue')} className={`${tabClass('issue')} whitespace-nowrap`}>
          발주서 발급
        </button>
        <button type="button" onClick={() => goTab('list')} className={`${tabClass('list')} whitespace-nowrap`}>
          발주서 목록
        </button>
        <button type="button" onClick={() => goTab('specialty')} className={`${tabClass('specialty')} whitespace-nowrap`}>
          발주서 설정
        </button>
        <button
          type="button"
          onClick={() => goTab('notice')}
          className={`${tabClass('notice')} whitespace-nowrap`}
          aria-label="안내사항설정"
        >
          안내사항설정
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded">{error}</div>
      )}

      {tab === 'config' && (
        <div className="space-y-6">
          <section className="p-4 bg-white border border-gray-200 rounded">
            <h2 className="text-base font-medium text-gray-900 mb-4">견적 기본 설정</h2>
            <div className="grid grid-cols-2 gap-4 max-w-md">
              <div>
                <label className="block text-sm text-gray-600 mb-1">평당 금액 (원)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  value={configForm.pricePerPyeong}
                  onChange={(e) => setConfigForm((f) => ({ ...f, pricePerPyeong: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">예약금 (원)</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  value={configForm.depositAmount}
                  onChange={(e) => setConfigForm((f) => ({ ...f, depositAmount: e.target.value }))}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleSaveConfig}
              disabled={configSaving}
              className="mt-4 px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded disabled:opacity-50"
            >
              저장
            </button>
          </section>

          <section className="p-4 bg-white border border-gray-200 rounded">
            <h2 className="text-base font-medium text-gray-900 mb-4">추가 옵션</h2>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="옵션명 (예: 현장 선택 추가)"
                value={newOptionName}
                onChange={(e) => setNewOptionName(e.target.value)}
              />
              <input
                type="number"
                className="w-24 px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="추가금액"
                value={newOptionAmount}
                onChange={(e) => setNewOptionAmount(e.target.value)}
              />
              <button
                type="button"
                onClick={handleAddOption}
                className="px-4 py-2 bg-gray-700 text-white text-sm rounded"
              >
                추가
              </button>
            </div>
            <ul className="space-y-2">
              {options.map((opt) => (
                <li
                  key={opt.id}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <span className={opt.isActive ? '' : 'text-gray-400 line-through'}>
                    {opt.name} {opt.extraAmount > 0 ? `+${opt.extraAmount.toLocaleString()}원` : ''}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleOption(opt)}
                      className="text-xs text-gray-600"
                    >
                      {opt.isActive ? '비활성' : '활성'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteOption(opt)}
                      className="text-xs text-red-600"
                    >
                      삭제
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {tab === 'messages' && (
        <div className="space-y-6">
          <section className="p-4 bg-white border border-gray-200 rounded">
            <h2 className="text-base font-medium text-gray-900 mb-4">폼 메시지 편집</h2>
            <p className="text-sm text-gray-500 mb-4">
              고객이 보는 발주서 폼에 표시되는 문구를 수정할 수 있습니다. 저장 후 발급되는 새 발주서부터 적용됩니다.
            </p>
            <p className="text-sm text-gray-600 mb-4 p-3 bg-gray-50 border border-gray-200 rounded">
              <span className="font-medium text-gray-800">고객 안내사항</span> 본문과 동의란 링크 문구는{' '}
              <Link to="/admin/orderforms?tab=notice" className="text-blue-600 underline hover:text-blue-800">
                안내사항설정
              </Link>{' '}
              메뉴에서 편집합니다.
            </p>
            <div className="space-y-4 max-w-lg">
              <div>
                <label className="block text-sm text-gray-600 mb-1">폼 제목</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900"
                  value={msgConfig.formTitle}
                  onChange={(e) => setMsgConfig((c) => ({ ...c, formTitle: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">금액 라벨 (예: 특가)</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900"
                  value={msgConfig.priceLabel ?? ''}
                  onChange={(e) => setMsgConfig((c) => ({ ...c, priceLabel: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">리뷰 이벤트 문구</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900"
                  value={msgConfig.reviewEventText ?? ''}
                  onChange={(e) => setMsgConfig((c) => ({ ...c, reviewEventText: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">안내 문구 1</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900"
                  value={msgConfig.footerNotice1 ?? ''}
                  onChange={(e) => setMsgConfig((c) => ({ ...c, footerNotice1: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">안내 문구 2</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900"
                  value={msgConfig.footerNotice2 ?? ''}
                  onChange={(e) => setMsgConfig((c) => ({ ...c, footerNotice2: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">제출 완료 제목</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900"
                  value={msgConfig.submitSuccessTitle ?? ''}
                  onChange={(e) => setMsgConfig((c) => ({ ...c, submitSuccessTitle: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">제출 완료 안내</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-900"
                  value={msgConfig.submitSuccessBody ?? ''}
                  onChange={(e) => setMsgConfig((c) => ({ ...c, submitSuccessBody: e.target.value }))}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleSaveMsgConfig}
              disabled={msgSaving}
              className="mt-4 px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded disabled:opacity-50"
            >
              저장
            </button>
          </section>

          <section className="p-4 bg-gray-50 border border-gray-200 rounded">
            <h2 className="text-base font-medium text-gray-900 mb-3">미리보기</h2>
            <div className="bg-white p-4 rounded border border-gray-200 text-sm max-w-md">
              <h3 className="font-semibold text-gray-900 mb-2">
                {withDefaultText(msgConfig.formTitle, 'formTitle')}
              </h3>
              <p className="font-medium text-gray-900">
                총 금액 150,000원 {withDefaultText(msgConfig.priceLabel, 'priceLabel')}
              </p>
              <p className="text-gray-600 mt-1">잔금 130,000원, 예약금 20,000원</p>
              <p className="text-gray-800 text-xs mt-1">
                {withDefaultText(msgConfig.reviewEventText, 'reviewEventText')}
              </p>
              <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-700">
                <p>{withDefaultText(msgConfig.footerNotice1, 'footerNotice1')}</p>
                <p>{withDefaultText(msgConfig.footerNotice2, 'footerNotice2')}</p>
              </div>
            </div>
          </section>
        </div>
      )}

      {tab === 'issue' && (
        <div className="p-4 bg-white border border-gray-200 rounded max-w-md">
          <h2 className="text-base font-medium text-gray-900 mb-4">발주서 발급</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">고객명 *</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="홍길동"
                value={issueForm.customerName}
                onChange={(e) => setIssueForm((f) => ({ ...f, customerName: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">총 금액 (원) *</label>
              <input
                type="text"
                inputMode="numeric"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="150000"
                value={issueForm.totalAmount}
                onChange={(e) => setIssueForm((f) => ({ ...f, totalAmount: e.target.value }))}
              />
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => addToTotalAmount(1_000)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-800 hover:bg-gray-50"
                >
                  +천원
                </button>
                <button
                  type="button"
                  onClick={() => addToTotalAmount(10_000)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-800 hover:bg-gray-50"
                >
                  +만원
                </button>
                <button
                  type="button"
                  onClick={() => addToTotalAmount(100_000)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-800 hover:bg-gray-50"
                >
                  +십만원
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">예약금 (원)</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="20000"
                value={issueForm.depositAmount}
                onChange={(e) => setIssueForm((f) => ({ ...f, depositAmount: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">잔금 (원)</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="비어 있으면 자동 계산"
                value={issueForm.balanceAmount}
                onChange={(e) => setIssueForm((f) => ({ ...f, balanceAmount: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">청소 날짜</label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                value={issueForm.preferredDate}
                onChange={(e) => setIssueForm((f) => ({ ...f, preferredDate: e.target.value }))}
              />
              <p className="text-xs text-gray-500 mt-1">
                비워 두면 고객이 발주서에서 날짜·오전/오후를 직접 선택합니다. 지정하면 고객은 수정할 수 없습니다.
              </p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">시간대</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                value={issueForm.preferredTime}
                onChange={(e) => setIssueForm((f) => ({ ...f, preferredTime: e.target.value }))}
                disabled={!issueForm.preferredDate.trim()}
              >
                {ORDER_TIME_SLOT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {!issueForm.preferredDate.trim() && (
                <p className="text-xs text-gray-500 mt-1">날짜를 먼저 선택하면 함께 저장됩니다. (날짜 미지정 시 고객이 선택)</p>
              )}
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">구체적 시각 (선택)</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="예: 10:30, 오전 10시"
                value={issueForm.preferredTimeDetail}
                onChange={(e) => setIssueForm((f) => ({ ...f, preferredTimeDetail: e.target.value }))}
              />
              <p className="text-xs text-gray-500 mt-1">
                입력 시 고객 발주서에서 수정할 수 없습니다. 비우면 고객이 직접 적을 수 있습니다.
              </p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">추가 사항</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="견적 포함 추가, 현장 선택 추가 등"
                value={issueForm.optionNote}
                onChange={(e) => setIssueForm((f) => ({ ...f, optionNote: e.target.value }))}
              />
            </div>
            <button
              type="button"
              onClick={handleIssue}
              disabled={issueLoading}
              className="w-full py-2 bg-gray-800 text-white font-medium rounded disabled:opacity-50"
            >
              발급 및 링크 생성
            </button>
          </div>

          {newOrder && (
            <div className="mt-6 p-4 bg-gray-50 rounded border border-gray-200">
              <p className="text-sm font-medium text-gray-900">발급 완료</p>
              <p className="text-sm text-gray-600 mt-1">
                {newOrder.customerName}님 · {newOrder.totalAmount.toLocaleString()}원
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copyMessage(newOrder)}
                  className="px-4 py-2 bg-gray-800 text-white text-sm rounded font-medium"
                >
                  메시지 복사
                </button>
                <button
                  type="button"
                  onClick={() => copyLink(newOrder.token)}
                  className="px-4 py-2 bg-gray-700 text-white text-sm rounded"
                >
                  링크만 복사
                </button>
                <button
                  type="button"
                  onClick={() => openInNewTab(newOrder.token)}
                  className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50"
                >
                  새 창에서 열기
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">메시지 복사 후 카카오톡·문자로 고객에게 보내세요.</p>
              <details className="mt-2">
                <summary className="text-xs text-gray-600 cursor-pointer">미리보기</summary>
                <pre className="mt-1 p-3 bg-gray-50 rounded text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto">
                  {getOrderMessage(newOrder)}
                </pre>
              </details>
            </div>
          )}
        </div>
      )}

      {tab === 'list' && (
        <div className="overflow-x-auto">
          {loading ? (
            <p className="text-gray-500">로딩 중...</p>
          ) : (
            <table className="w-full border border-gray-200 rounded overflow-hidden">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">고객명</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">총액</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">상태</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">발급일</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">링크</th>
                </tr>
              </thead>
              <tbody>
                {orderForms.map((o) => (
                  <tr key={o.id} className="border-t border-gray-200">
                    <td className="px-4 py-2 text-sm">{o.customerName}</td>
                    <td className="px-4 py-2 text-sm">{o.totalAmount.toLocaleString()}원</td>
                    <td className="px-4 py-2 text-sm">
                      {o.submittedAt ? (
                        <span className="text-green-600">제출완료</span>
                      ) : (
                        <span className="text-gray-500">미제출</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {new Date(o.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => copyMessage(o)}
                          className="text-sm text-blue-600 font-medium"
                        >
                          메시지
                        </button>
                        <button
                          type="button"
                          onClick={() => copyLink(o.token)}
                          className="text-sm text-gray-600"
                        >
                          링크
                        </button>
                        <button
                          type="button"
                          onClick={() => openInNewTab(o.token)}
                          className="text-sm text-gray-600"
                        >
                          새 창
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'specialty' && <AdminOrderFormSpecialtySettingsPage />}

      {tab === 'notice' && <AdminOrderFormNoticePage embedded />}
    </div>
  );
}
