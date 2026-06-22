import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFormConfig, updateFormConfig } from '../../api/orderform';
import { getToken } from '../../stores/auth';
import {
  buildOrderFormCustomerMessage,
  normalizeMsgConfigForEditor,
  type FormMessagesState,
} from '../../utils/orderFormCustomerCopy';
import { ORDER_FORM_CONFIG_DEFAULTS } from '../../constants/orderFormConfigDefaults';
import { resolvePublicTenantSlug } from '../../utils/publicTenantQuery';
import { HelpTooltip } from '../../components/ui/HelpTooltip';

const MSG_TEXTAREA_CLS =
  'w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-fluid-sm leading-relaxed focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500';

/** 미리보기용 샘플 — 실제 발급 건 금액·일정은 발주서마다 달라집니다 */
const PREVIEW_SAMPLE_ORDER = {
  token: 'sample-preview-token',
  totalAmount: 880_000,
  depositAmount: 100_000,
  balanceAmount: 780_000,
  preferredDate: '2026-06-20',
  preferredTime: '오전',
  preferredTimeDetail: '09:00',
} as const;

const HELP =
  '발주서 발급·목록에서 「메시지 복사」할 때 고객에게 보내는 안내 문구입니다.\n' +
  '금액·청소일·링크 URL은 발급한 발주서마다 자동으로 채워집니다.\n' +
  '발주서 화면 제목·안내 등 더 많은 설정은 「발주서설정」에서 편집할 수 있습니다.';

type LinkMsgFields = Pick<
  FormMessagesState,
  'formTitle' | 'priceLabel' | 'reviewEventText' | 'footerNotice1' | 'footerNotice2'
>;

function pickLinkMsgFields(c: FormMessagesState): LinkMsgFields {
  return {
    formTitle: c.formTitle,
    priceLabel: c.priceLabel,
    reviewEventText: c.reviewEventText,
    footerNotice1: c.footerNotice1,
    footerNotice2: c.footerNotice2,
  };
}

export function AdminOrderFormCustomerLinkSettingsPage() {
  const token = getToken();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [msgConfig, setMsgConfig] = useState<LinkMsgFields>(() =>
    pickLinkMsgFields(
      normalizeMsgConfigForEditor({
        formTitle: '',
        priceLabel: '',
        reviewEventText: '',
        footerNotice1: '',
        footerNotice2: '',
        infoContent: null,
        infoLinkText: null,
        submitSuccessTitle: null,
        submitSuccessBody: null,
      }),
    ),
  );

  const refresh = useCallback(() => {
    if (!token) return;
    getFormConfig(token)
      .then((c) => {
        setMsgConfig(pickLinkMsgFields(normalizeMsgConfigForEditor(c)));
        setError(null);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : '설정을 불러올 수 없습니다.');
      });
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    getFormConfig(token)
      .then((c) => {
        if (cancelled) return;
        setMsgConfig(pickLinkMsgFields(normalizeMsgConfigForEditor(c)));
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '설정을 불러올 수 없습니다.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const previewMessage = useMemo(() => {
    const tenantSlug = resolvePublicTenantSlug();
    return buildOrderFormCustomerMessage(
      {
        ...msgConfig,
        submitSuccessTitle: '',
        submitSuccessBody: '',
        timeSlotAckTitle: '',
        timeSlotAckBody: '',
        timeSlotAckConsentHint: '',
      },
      PREVIEW_SAMPLE_ORDER,
      typeof window !== 'undefined' ? window.location.origin : undefined,
      tenantSlug || null,
    );
  }, [msgConfig]);

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    setError(null);
    setSavedAt(null);
    try {
      await updateFormConfig(token, {
        formTitle: msgConfig.formTitle || undefined,
        priceLabel: msgConfig.priceLabel || undefined,
        reviewEventText: msgConfig.reviewEventText ?? '',
        footerNotice1: msgConfig.footerNotice1 || undefined,
        footerNotice2: msgConfig.footerNotice2 || undefined,
      });
      refresh();
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="p-6 text-center text-fluid-sm text-gray-500">불러오는 중…</p>;
  }

  return (
    <div className="min-w-0 w-full max-w-full space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-fluid-base font-semibold text-gray-900">고객링크설정</h1>
            <p className="mt-1 text-fluid-xs leading-relaxed text-gray-600">
              발주서 링크와 함께 보내는 고객 안내 메시지 문구를 편집합니다.
              <HelpTooltip text={HELP} className="ml-1 align-middle" />
            </p>
          </div>
          <Link
            to="/admin/inquiries/order-customer-preview"
            className="shrink-0 text-fluid-xs text-blue-700 underline hover:text-blue-800"
          >
            발주서설정(화면·견적)
          </Link>
        </div>

        {error ? (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-xs text-red-800">
            {error}
          </p>
        ) : null}
        {savedAt ? (
          <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-fluid-xs text-emerald-900">
            저장되었습니다. 새로 발급·복사하는 메시지부터 반영됩니다.
          </p>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <div className="min-w-0 space-y-4">
            <section className="space-y-2">
              <label className="block text-fluid-xs font-medium text-gray-800">제목 (첫 줄)</label>
              <textarea
                rows={3}
                className={`${MSG_TEXTAREA_CLS} min-h-[4.5rem]`}
                value={msgConfig.formTitle}
                onChange={(e) => setMsgConfig((c) => ({ ...c, formTitle: e.target.value }))}
                placeholder={ORDER_FORM_CONFIG_DEFAULTS.formTitle}
              />
              <p className="text-fluid-2xs text-gray-500">
                기본 발주서 제목과 동일합니다. 커스텀 양식 발급 시 양식 제목이 우선 표시됩니다.
              </p>
            </section>

            <section className="space-y-2">
              <label className="block text-fluid-xs font-medium text-gray-800">금액 옆 라벨</label>
              <textarea
                rows={2}
                className={`${MSG_TEXTAREA_CLS} min-h-[3rem]`}
                value={msgConfig.priceLabel ?? ''}
                onChange={(e) => setMsgConfig((c) => ({ ...c, priceLabel: e.target.value }))}
                placeholder={ORDER_FORM_CONFIG_DEFAULTS.priceLabel}
              />
            </section>

            <section className="space-y-2">
              <label className="block text-fluid-xs font-medium text-gray-800">리뷰 이벤트 문구</label>
              <textarea
                rows={3}
                className={`${MSG_TEXTAREA_CLS} min-h-[4.5rem]`}
                value={msgConfig.reviewEventText ?? ''}
                onChange={(e) => setMsgConfig((c) => ({ ...c, reviewEventText: e.target.value }))}
                placeholder={ORDER_FORM_CONFIG_DEFAULTS.reviewEventText}
              />
              <p className="text-fluid-2xs text-gray-500">비워 두고 저장하면 메시지에서 리뷰 문구가 숨겨집니다.</p>
            </section>

            <section className="space-y-2">
              <label className="block text-fluid-xs font-medium text-gray-800">하단 안내 1</label>
              <textarea
                rows={3}
                className={`${MSG_TEXTAREA_CLS} min-h-[4.5rem]`}
                value={msgConfig.footerNotice1 ?? ''}
                onChange={(e) => setMsgConfig((c) => ({ ...c, footerNotice1: e.target.value }))}
                placeholder={ORDER_FORM_CONFIG_DEFAULTS.footerNotice1}
              />
            </section>

            <section className="space-y-2">
              <label className="block text-fluid-xs font-medium text-gray-800">하단 안내 2</label>
              <textarea
                rows={3}
                className={`${MSG_TEXTAREA_CLS} min-h-[4.5rem]`}
                value={msgConfig.footerNotice2 ?? ''}
                onChange={(e) => setMsgConfig((c) => ({ ...c, footerNotice2: e.target.value }))}
                placeholder={ORDER_FORM_CONFIG_DEFAULTS.footerNotice2}
              />
            </section>

            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-fluid-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>

          <section className="min-w-0 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <h2 className="mb-2 text-fluid-xs font-semibold text-gray-800">메시지 미리보기</h2>
            <p className="mb-3 text-fluid-2xs leading-relaxed text-gray-500">
              샘플 금액·일정 기준입니다. 링크·금액·청소일은 실제 발급 건마다 자동 반영됩니다.
            </p>
            <pre className="max-h-[min(70vh,640px)] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-gray-200 bg-white p-3 text-fluid-xs leading-relaxed text-gray-800">
              {previewMessage}
            </pre>
          </section>
        </div>
      </div>
    </div>
  );
}
