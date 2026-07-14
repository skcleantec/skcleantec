import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TENANT_BILLING_DUNNING_POPUP_DEFAULTS,
  TENANT_INVOICE_STATUS_LABEL,
  formatDunningBlockSoonText,
  resolveTenantBillingDunningPopupContent,
  type TenantBillingDunningPopupContent,
} from '@shared/tenantBilling';
import {
  getPlatformBillingSettings,
  patchPlatformBillingSettings,
  type PlatformBillingSettings,
} from '../../api/platformBilling';
import { getPlatformToken } from '../../stores/platformAuth';
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  CARD_SECTION,
  INPUT_BASE,
  PlatformAlert,
} from '../../utils/platformUi';
import { KoreanBankNameField } from '../../components/ui/KoreanBankNameField';

type FormState = {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  paymentGuideText: string;
  dunningPaymentNotifyEmail: string;
  dunningPopupTitle: string;
  dunningPopupSubtitle: string;
  dunningPopupBody: string;
  dunningBlockSoonText: string;
  dunningBlockTodayText: string;
  overdueGraceDays: string;
};

function bankSummaryFromSettings(s: PlatformBillingSettings): string {
  return [s.bankName, s.accountNumber, s.accountHolder].filter(Boolean).join(' · ');
}

function formFromSettings(s: PlatformBillingSettings): FormState {
  const popup = resolveTenantBillingDunningPopupContent(s);
  return {
    bankName: s.bankName?.trim() ?? '',
    accountNumber: s.accountNumber?.trim() ?? '',
    accountHolder: s.accountHolder?.trim() ?? '',
    paymentGuideText: s.paymentGuideText?.trim() ?? '',
    dunningPaymentNotifyEmail: s.dunningPaymentNotifyEmail?.trim() ?? '',
    dunningPopupTitle: s.dunningPopupTitle?.trim() || popup.title,
    dunningPopupSubtitle: s.dunningPopupSubtitle?.trim() || popup.subtitle,
    dunningPopupBody: s.dunningPopupBody?.trim() || popup.body,
    dunningBlockSoonText: s.dunningBlockSoonText?.trim() || popup.blockSoonText,
    dunningBlockTodayText: s.dunningBlockTodayText?.trim() || popup.blockTodayText,
    overdueGraceDays: String(s.overdueGraceDays),
  };
}

function previewPopup(form: FormState): TenantBillingDunningPopupContent {
  return resolveTenantBillingDunningPopupContent({
    dunningPopupTitle: form.dunningPopupTitle,
    dunningPopupSubtitle: form.dunningPopupSubtitle,
    dunningPopupBody: form.dunningPopupBody,
    dunningBlockSoonText: form.dunningBlockSoonText,
    dunningBlockTodayText: form.dunningBlockTodayText,
  });
}

function DunningPopupPreview({
  popup,
  bankLine,
  paymentGuideText,
  overdueGraceDays,
  previewDaysUntilBlock,
}: {
  popup: TenantBillingDunningPopupContent;
  bankLine: string;
  paymentGuideText: string | null;
  overdueGraceDays: number;
  previewDaysUntilBlock: number;
}) {
  const sampleAmount = 330_000;
  const sampleDue = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });

  return (
    <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white shadow-lg overflow-hidden mx-auto">
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 text-white">
        <h2 className="text-base font-semibold">{popup.title}</h2>
        <p className="mt-0.5 text-xs text-amber-50/95">{popup.subtitle}</p>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{popup.body}</p>
        <div className="rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2.5 text-sm space-y-1.5">
          <div className="flex flex-wrap justify-between gap-2">
            <span className="text-gray-600">청구 금액</span>
            <span className="font-semibold tabular-nums text-gray-900">
              {sampleAmount.toLocaleString('ko-KR')}원
              <span className="ml-1 text-xs font-normal text-gray-500">(VAT 별도)</span>
            </span>
          </div>
          <div className="flex flex-wrap justify-between gap-2 text-xs">
            <span className="text-gray-500">납부기한</span>
            <span className="text-gray-800">{sampleDue} (미리보기)</span>
          </div>
          <div className="flex flex-wrap justify-between gap-2 text-xs">
            <span className="text-gray-500">상태</span>
            <span className="font-medium text-amber-900">{TENANT_INVOICE_STATUS_LABEL.OVERDUE}</span>
          </div>
        </div>
        {previewDaysUntilBlock > 0 ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-950">
            <p className="font-medium">
              {formatDunningBlockSoonText(popup.blockSoonText, previewDaysUntilBlock)}
            </p>
            <p className="mt-1 text-xs text-rose-800/90">유예 {overdueGraceDays}일 기준 미리보기</p>
          </div>
        ) : (
          <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-900">
            {popup.blockTodayText}
          </div>
        )}
        {bankLine ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm">
            <p className="text-xs font-medium text-gray-500">입금 계좌</p>
            <p className="mt-1 text-gray-900">{bankLine}</p>
            {paymentGuideText ? (
              <p className="mt-1.5 text-xs text-gray-600 whitespace-pre-wrap">{paymentGuideText}</p>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-amber-700 rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2">
            입금 계좌를 설정하면 팝업에 표시됩니다.
          </p>
        )}
        <div className="flex flex-wrap gap-2 justify-end pt-1">
          <span className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-900">
            입금확인 요청
          </span>
          <span className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-400">
            이용료 상세 보기
          </span>
          <span className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white">확인</span>
        </div>
      </div>
    </div>
  );
}

export function PlatformUnpaidPopupSettingsPage() {
  const [form, setForm] = useState<FormState | null>(null);
  const [savedBankSummary, setSavedBankSummary] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [previewDaysUntilBlock, setPreviewDaysUntilBlock] = useState(2);

  const load = useCallback(async () => {
    const token = getPlatformToken();
    if (!token) {
      setLoading(false);
      setError('플랫폼 로그인이 필요합니다.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const s = await getPlatformBillingSettings(token);
      setForm(formFromSettings(s));
      setSavedBankSummary(bankSummaryFromSettings(s));
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const popupPreview = useMemo(() => (form ? previewPopup(form) : null), [form]);

  const bankLine = form
    ? [form.bankName, form.accountNumber, form.accountHolder].filter(Boolean).join(' · ')
    : '';
  const paymentGuidePreview = form?.paymentGuideText.trim() || null;

  const patchSettings = async (
    body: Parameters<typeof patchPlatformBillingSettings>[1],
    successMessage: string,
  ) => {
    const token = getPlatformToken();
    if (!token || !form) return false;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await patchPlatformBillingSettings(token, body);
      setForm(formFromSettings(updated));
      setSavedBankSummary(bankSummaryFromSettings(updated));
      setMessage(successMessage);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveBankSection = async () => {
    if (!form) return;
    if (!form.bankName.trim() || !form.accountNumber.trim() || !form.accountHolder.trim()) {
      setError('은행·계좌번호·예금주를 모두 입력해 주세요.');
      return;
    }
    await patchSettings(
      {
        bankName: form.bankName.trim() || null,
        accountNumber: form.accountNumber.trim() || null,
        accountHolder: form.accountHolder.trim() || null,
        paymentGuideText: form.paymentGuideText.trim() || null,
      },
      '입금 계좌 정보가 저장되었습니다.',
    );
  };

  const saveNotifySection = async () => {
    if (!form) return;
    const notifyEmail = form.dunningPaymentNotifyEmail.trim();
    if (notifyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notifyEmail)) {
      setError('입금 확인 알림 이메일 형식을 확인해 주세요.');
      return;
    }
    await patchSettings(
      { dunningPaymentNotifyEmail: notifyEmail || null },
      '입금 확인 알림 이메일이 저장되었습니다.',
    );
  };

  const savePopupSection = async () => {
    if (!form) return;
    const grace = Number(form.overdueGraceDays);
    if (!Number.isFinite(grace) || grace < 0 || grace > 30) {
      setError('접속 제한 유예일은 0~30 사이로 입력해 주세요.');
      return;
    }
    await patchSettings(
      {
        dunningPopupTitle: form.dunningPopupTitle.trim() || null,
        dunningPopupSubtitle: form.dunningPopupSubtitle.trim() || null,
        dunningPopupBody: form.dunningPopupBody.trim() || null,
        dunningBlockSoonText: form.dunningBlockSoonText.trim() || null,
        dunningBlockTodayText: form.dunningBlockTodayText.trim() || null,
        overdueGraceDays: Math.trunc(grace),
      },
      '팝업 문구가 저장되었습니다.',
    );
  };

  const saveAll = async () => {
    if (!form) return;
    const grace = Number(form.overdueGraceDays);
    if (!Number.isFinite(grace) || grace < 0 || grace > 30) {
      setError('접속 제한 유예일은 0~30 사이로 입력해 주세요.');
      return;
    }
    const notifyEmail = form.dunningPaymentNotifyEmail.trim();
    if (notifyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notifyEmail)) {
      setError('입금 확인 알림 이메일 형식을 확인해 주세요.');
      return;
    }
    await patchSettings(
      {
        bankName: form.bankName.trim() || null,
        accountNumber: form.accountNumber.trim() || null,
        accountHolder: form.accountHolder.trim() || null,
        paymentGuideText: form.paymentGuideText.trim() || null,
        dunningPaymentNotifyEmail: notifyEmail || null,
        dunningPopupTitle: form.dunningPopupTitle.trim() || null,
        dunningPopupSubtitle: form.dunningPopupSubtitle.trim() || null,
        dunningPopupBody: form.dunningPopupBody.trim() || null,
        dunningBlockSoonText: form.dunningBlockSoonText.trim() || null,
        dunningBlockTodayText: form.dunningBlockTodayText.trim() || null,
        overdueGraceDays: Math.trunc(grace),
      },
      '미결재 팝업 설정이 모두 저장되었습니다.',
    );
  };

  const resetDefaults = () => {
    if (!form) return;
    setForm({
      ...form,
      dunningPopupTitle: TENANT_BILLING_DUNNING_POPUP_DEFAULTS.title,
      dunningPopupSubtitle: TENANT_BILLING_DUNNING_POPUP_DEFAULTS.subtitle,
      dunningPopupBody: TENANT_BILLING_DUNNING_POPUP_DEFAULTS.body,
      dunningBlockSoonText: TENANT_BILLING_DUNNING_POPUP_DEFAULTS.blockSoonText,
      dunningBlockTodayText: TENANT_BILLING_DUNNING_POPUP_DEFAULTS.blockTodayText,
    });
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-gray-500">불러오는 중…</div>;
  }

  if (!form || !popupPreview) {
    return <PlatformAlert variant="error" message={error || '설정을 불러올 수 없습니다.'} />;
  }

  const graceDays = Number(form.overdueGraceDays) || 0;

  return (
    <div className="space-y-6 pb-8 min-w-0 w-full max-w-5xl">
      <div>
        <p className="text-xs font-medium text-gray-500">안내팝업</p>
        <h1 className="text-xl font-semibold text-gray-900">미결재 팝업</h1>
        <p className="mt-1 text-sm text-gray-500">
          납부기한이 지난 이용료가 있을 때 업체 <strong>관리자(ADMIN)</strong> 로그인 직후 표시되는
          팝업입니다. 세션마다 한 번 닫을 수 있습니다.
        </p>
      </div>

      {error ? <PlatformAlert variant="error" message={error} /> : null}
      {message ? <PlatformAlert variant="success" message={message} /> : null}

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" disabled={saving} onClick={() => void saveAll()} className={BTN_PRIMARY}>
          {saving ? '저장 중…' : '전체 저장'}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
        <section className={CARD_SECTION}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">입금 계좌 안내</h2>
              <p className="mt-1 text-xs text-gray-500">미결재 팝업·이용료 화면에 공통으로 표시됩니다.</p>
            </div>
            {savedBankSummary ? (
              <p className="text-xs text-emerald-700 font-medium shrink-0">등록됨 · 수정 가능</p>
            ) : (
              <p className="text-xs text-amber-700 shrink-0">미등록</p>
            )}
          </div>
          {savedBankSummary ? (
            <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">
              저장된 계좌: {savedBankSummary}
            </p>
          ) : null}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="text-gray-600">은행</span>
              <div className="mt-1">
                <KoreanBankNameField
                  value={form.bankName}
                  onChange={(bankName) => setForm((f) => (f ? { ...f, bankName } : f))}
                  selectClassName={INPUT_BASE}
                  inputClassName={INPUT_BASE}
                />
              </div>
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">계좌번호</span>
              <input
                className={`mt-1 ${INPUT_BASE}`}
                value={form.accountNumber}
                onChange={(e) => setForm((f) => (f ? { ...f, accountNumber: e.target.value } : f))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">예금주</span>
              <input
                className={`mt-1 ${INPUT_BASE}`}
                value={form.accountHolder}
                onChange={(e) => setForm((f) => (f ? { ...f, accountHolder: e.target.value } : f))}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-gray-600">납부 안내 문구</span>
              <textarea
                rows={3}
                className={`mt-1 ${INPUT_BASE}`}
                value={form.paymentGuideText}
                onChange={(e) => setForm((f) => (f ? { ...f, paymentGuideText: e.target.value } : f))}
                placeholder="입금 시 업체명을 반드시 기재해 주세요."
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 justify-end">
            <button type="button" disabled={saving} onClick={() => void saveBankSection()} className={BTN_PRIMARY}>
              {saving ? '저장 중…' : '입금 계좌 저장'}
            </button>
          </div>
        </section>

        <section className={CARD_SECTION}>
          <h2 className="text-sm font-semibold text-gray-900">입금 확인 요청 알림</h2>
          <p className="mt-1 text-xs text-gray-500">
            업체 관리자가 「입금확인 요청」을 누르면 아래 이메일로 알림이 발송됩니다. 메일 발송(SMTP)은{' '}
            <Link to="/platform/settings/smtp" className="text-blue-600 hover:underline">
              설정
            </Link>
            에서 구성합니다.
          </p>
          <label className="mt-3 block text-sm">
            <span className="text-gray-600">알림 받을 이메일</span>
            <input
              type="email"
              className={`mt-1 ${INPUT_BASE}`}
              value={form.dunningPaymentNotifyEmail}
              onChange={(e) => setForm((f) => (f ? { ...f, dunningPaymentNotifyEmail: e.target.value } : f))}
              placeholder="you@example.com"
            />
          </label>
          <div className="mt-4 flex justify-end">
            <button type="button" disabled={saving} onClick={() => void saveNotifySection()} className={BTN_PRIMARY}>
              {saving ? '저장 중…' : '알림 이메일 저장'}
            </button>
          </div>
        </section>

        <section className={CARD_SECTION}>
          <h2 className="text-sm font-semibold text-gray-900">팝업 문구</h2>
          <div className="mt-3 space-y-3">
            <label className="block text-sm">
              <span className="text-gray-600">제목</span>
              <input
                className={`mt-1 ${INPUT_BASE}`}
                value={form.dunningPopupTitle}
                onChange={(e) => setForm((f) => (f ? { ...f, dunningPopupTitle: e.target.value } : f))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">부제</span>
              <input
                className={`mt-1 ${INPUT_BASE}`}
                value={form.dunningPopupSubtitle}
                onChange={(e) => setForm((f) => (f ? { ...f, dunningPopupSubtitle: e.target.value } : f))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">본문</span>
              <textarea
                rows={4}
                className={`mt-1 ${INPUT_BASE}`}
                value={form.dunningPopupBody}
                onChange={(e) => setForm((f) => (f ? { ...f, dunningPopupBody: e.target.value } : f))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">접속 제한 예고 (유예일 남음)</span>
              <input
                className={`mt-1 ${INPUT_BASE}`}
                value={form.dunningBlockSoonText}
                onChange={(e) => setForm((f) => (f ? { ...f, dunningBlockSoonText: e.target.value } : f))}
              />
              <p className="mt-1 text-xs text-gray-500">
                <code className="rounded bg-gray-100 px-1">{'{days}'}</code> 자리에 남은 일수가 들어갑니다.
              </p>
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">접속 제한 당일 안내</span>
              <input
                className={`mt-1 ${INPUT_BASE}`}
                value={form.dunningBlockTodayText}
                onChange={(e) => setForm((f) => (f ? { ...f, dunningBlockTodayText: e.target.value } : f))}
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">접속 제한 유예일 (일)</span>
              <input
                type="number"
                min={0}
                max={30}
                className={`mt-1 ${INPUT_BASE} max-w-[120px]`}
                value={form.overdueGraceDays}
                onChange={(e) => setForm((f) => (f ? { ...f, overdueGraceDays: e.target.value } : f))}
              />
              <p className="mt-1 text-xs text-gray-500">납부기한 경과 후 업무 접속을 막기까지 기다리는 일수</p>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 justify-end">
            <button type="button" disabled={saving} onClick={resetDefaults} className={BTN_SECONDARY}>
              기본 문구로
            </button>
            <button type="button" disabled={saving} onClick={() => void savePopupSection()} className={BTN_PRIMARY}>
              {saving ? '저장 중…' : '팝업 문구 저장'}
            </button>
          </div>
        </section>
        </div>

        <section className={CARD_SECTION}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900">미리보기</h2>
            <label className="flex items-center gap-2 text-xs text-gray-600">
              남은 일수
              <input
                type="number"
                min={0}
                max={30}
                className="w-14 rounded border border-gray-300 px-2 py-1 text-sm"
                value={previewDaysUntilBlock}
                onChange={(e) => setPreviewDaysUntilBlock(Math.max(0, Number(e.target.value) || 0))}
              />
            </label>
          </div>
          <div className="mt-4">
            <DunningPopupPreview
              popup={popupPreview}
              bankLine={bankLine}
              paymentGuideText={paymentGuidePreview}
              overdueGraceDays={graceDays}
              previewDaysUntilBlock={previewDaysUntilBlock}
            />
          </div>
          <p className="mt-3 text-xs text-gray-500">
            입력 후 각 섹션의 「저장」 또는 상단 「전체 저장」을 눌러 반영하세요. 미리보기는 저장 전에도 입력값을
            보여 줍니다.
          </p>
        </section>
      </div>

      <section className={`${CARD_SECTION} text-sm text-gray-600 space-y-2`}>
        <h2 className="text-sm font-semibold text-gray-900">표시 조건</h2>
        <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
          <li>업체 관리자(ADMIN)로 로그인했을 때</li>
          <li>납부기한이 지난 ISSUED/OVERDUE 청구서가 있고, 아직 접속 차단 전일 때</li>
          <li>같은 청구서는 브라우저 세션에서 「확인」으로 한 번 닫을 수 있음</li>
          <li>유예일 경과 후에는 팝업 대신 로그인 차단(입금 안내 배너)</li>
        </ul>
      </section>
    </div>
  );
}
