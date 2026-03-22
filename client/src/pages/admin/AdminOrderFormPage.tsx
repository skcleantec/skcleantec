import { useState, useEffect } from 'react';
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

type Tab = 'config' | 'messages' | 'issue' | 'list';

export function AdminOrderFormPage() {
  const token = getToken();
  const [tab, setTab] = useState<Tab>('issue');
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
  });
  const [newOrder, setNewOrder] = useState<OrderForm | null>(null);
  const [issueLoading, setIssueLoading] = useState(false);

  // 설정 폼
  const [configForm, setConfigForm] = useState({ pricePerPyeong: '', depositAmount: '' });
  const [newOptionName, setNewOptionName] = useState('');
  const [newOptionAmount, setNewOptionAmount] = useState('');
  const [configSaving, setConfigSaving] = useState(false);

  // 폼 메시지 설정
  const [msgConfig, setMsgConfig] = useState<OrderFormConfigPublic>({
    formTitle: '',
    priceLabel: '',
    reviewEventText: '',
    footerNotice1: '',
    footerNotice2: '',
    infoContent: '',
    infoLinkText: '',
    submitSuccessTitle: '',
    submitSuccessBody: '',
  });
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
    getFormConfig(token).then((c) => setMsgConfig({
      formTitle: c.formTitle ?? '',
      priceLabel: c.priceLabel ?? '',
      reviewEventText: c.reviewEventText ?? '',
      footerNotice1: c.footerNotice1 ?? '',
      footerNotice2: c.footerNotice2 ?? '',
      infoContent: c.infoContent ?? '',
      infoLinkText: c.infoLinkText ?? '',
      submitSuccessTitle: c.submitSuccessTitle ?? '',
      submitSuccessBody: c.submitSuccessBody ?? '',
    })).catch(() => {
      setError('폼 메시지를 불러올 수 없습니다. 기본값으로 편집 가능합니다.');
      setMsgConfig({
        formTitle: '클린벨 입주청소 발주서',
        priceLabel: '(특가)',
        reviewEventText: '* 리뷰 별5점 이벤트 참여, 1만원 입금',
        footerNotice1: '‼️ 청소 전일 저녁, 담당 팀장 연락 드림',
        footerNotice2: '❌ 연락 없을 시, 본사 확인 요청 필',
        infoContent: '',
        infoLinkText: '안내사항',
        submitSuccessTitle: '제출이 완료되었습니다.',
        submitSuccessBody: '청소 전일 저녁, 담당 팀장이 연락드립니다.',
      });
    });
  };

  useEffect(() => {
    if (!token) return;
    refreshConfig();
    refreshOptions();
  }, [token]);

  useEffect(() => {
    if (!token || tab !== 'messages') return;
    refreshMsgConfig();
  }, [token, tab]);

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
        infoContent: msgConfig.infoContent || undefined,
        infoLinkText: msgConfig.infoLinkText || undefined,
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
      });
      setNewOrder(order);
      setIssueForm({ ...issueForm, customerName: '', totalAmount: '', balanceAmount: '', optionNote: '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : '발급 실패');
    } finally {
      setIssueLoading(false);
    }
  };

  const getOrderLink = (orderToken: string) =>
    `${window.location.origin}/order/${orderToken}`;

  const copyLink = (orderToken: string) => {
    navigator.clipboard.writeText(getOrderLink(orderToken));
    alert('링크가 복사되었습니다.');
  };

  const openInNewTab = (orderToken: string) => {
    window.open(getOrderLink(orderToken), '_blank', 'noopener');
  };

  const tabClass = (t: Tab) =>
    `px-3 py-2 text-sm font-medium rounded ${tab === t ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:text-gray-900'}`;

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-4">발주서</h1>

      <div className="flex gap-1 mb-6">
        <button type="button" onClick={() => setTab('config')} className={tabClass('config')}>
          설정
        </button>
        <button type="button" onClick={() => setTab('messages')} className={tabClass('messages')}>
          폼 메시지
        </button>
        <button type="button" onClick={() => setTab('issue')} className={tabClass('issue')}>
          발주서 발급
        </button>
        <button type="button" onClick={() => setTab('list')} className={tabClass('list')}>
          발주서 목록
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
            <div className="space-y-4 max-w-lg">
              <div>
                <label className="block text-sm text-gray-600 mb-1">폼 제목</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="클린벨 입주청소 발주서"
                  value={msgConfig.formTitle}
                  onChange={(e) => setMsgConfig((c) => ({ ...c, formTitle: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">금액 라벨 (예: 특가)</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="(특가)"
                  value={msgConfig.priceLabel ?? ''}
                  onChange={(e) => setMsgConfig((c) => ({ ...c, priceLabel: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">리뷰 이벤트 문구</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="* 리뷰 별5점 이벤트 참여, 1만원 입금"
                  value={msgConfig.reviewEventText ?? ''}
                  onChange={(e) => setMsgConfig((c) => ({ ...c, reviewEventText: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">안내 문구 1</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="‼️ 청소 전일 저녁, 담당 팀장 연락 드림"
                  value={msgConfig.footerNotice1 ?? ''}
                  onChange={(e) => setMsgConfig((c) => ({ ...c, footerNotice1: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">안내 문구 2</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="❌ 연락 없을 시, 본사 확인 요청 필"
                  value={msgConfig.footerNotice2 ?? ''}
                  onChange={(e) => setMsgConfig((c) => ({ ...c, footerNotice2: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">안내사항 (클릭 시 모달로 표시, 비우면 고객에게 안 보임)</label>
                <textarea
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="안내사항 내용을 입력하세요. 고객이 '안내사항'을 클릭하면 이 내용이 모달로 표시됩니다."
                  value={msgConfig.infoContent ?? ''}
                  onChange={(e) => setMsgConfig((c) => ({ ...c, infoContent: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">안내사항 버튼 텍스트 (작게 표시됨)</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="안내사항"
                  value={msgConfig.infoLinkText ?? ''}
                  onChange={(e) => setMsgConfig((c) => ({ ...c, infoLinkText: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">제출 완료 제목</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="제출이 완료되었습니다."
                  value={msgConfig.submitSuccessTitle ?? ''}
                  onChange={(e) => setMsgConfig((c) => ({ ...c, submitSuccessTitle: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">제출 완료 안내</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="청소 전일 저녁, 담당 팀장이 연락드립니다."
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
                {msgConfig.formTitle || '클린벨 입주청소 발주서'}
              </h3>
              <p className="font-medium text-gray-900">
                총 금액 150,000원 {msgConfig.priceLabel || '(특가)'}
              </p>
              <p className="text-gray-600 mt-1">잔금 130,000원, 예약금 20,000원</p>
              {(msgConfig.reviewEventText || '* 리뷰 별5점 이벤트 참여, 1만원 입금') && (
                <p className="text-gray-500 text-xs mt-1">
                  {msgConfig.reviewEventText || '* 리뷰 별5점 이벤트 참여, 1만원 입금'}
                </p>
              )}
              <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500">
                <p>{msgConfig.footerNotice1 || '‼️ 청소 전일 저녁, 담당 팀장 연락 드림'}</p>
                <p>{msgConfig.footerNotice2 || '❌ 연락 없을 시, 본사 확인 요청 필'}</p>
                {msgConfig.infoContent && (
                  <p className="text-gray-500 mt-2">안내사항: {msgConfig.infoContent.slice(0, 50)}...</p>
                )}
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
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                placeholder="150000"
                value={issueForm.totalAmount}
                onChange={(e) => setIssueForm((f) => ({ ...f, totalAmount: e.target.value }))}
              />
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
                  onClick={() => copyLink(newOrder.token)}
                  className="px-4 py-2 bg-gray-700 text-white text-sm rounded"
                >
                  링크 복사
                </button>
                <button
                  type="button"
                  onClick={() => openInNewTab(newOrder.token)}
                  className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50"
                >
                  새 창에서 열기
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2 break-all">
                {getOrderLink(newOrder.token)}
              </p>
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
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => copyLink(o.token)}
                          className="text-sm text-blue-600"
                        >
                          복사
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
    </div>
  );
}
