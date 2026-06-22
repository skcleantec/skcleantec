import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFormConfig, updateFormConfig } from '../../api/orderform';
import { getToken } from '../../stores/auth';
import {
  buildOrderFormCustomerMessage,
  customerLinkCopyPayloadFromEditor,
  normalizeMsgConfigForEditor,
  type FormMessagesState,
} from '../../utils/orderFormCustomerCopy';
import { ORDER_FORM_CONFIG_DEFAULTS } from '../../constants/orderFormConfigDefaults';
import { ORDER_FORM_CUSTOMER_LINK_COPY_DEFAULTS } from '@shared/orderFormCustomerLinkCopy';
import { resolvePublicTenantSlug } from '../../utils/publicTenantQuery';
import { HelpTooltip } from '../../components/ui/HelpTooltip';

const MSG_TEXTAREA_CLS =
  'w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-fluid-sm leading-relaxed focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500';

/** 미리보기용 샘플 — 페이백 링크는 발급 시 토큰이 있는 발주서에 포함됩니다 */
const PREVIEW_SAMPLE_ORDER = {
  token: 'sample-preview-token',
  reviewPaybackToken: 'sample-payback-preview-token',
  totalAmount: 880_000,
  depositAmount: 100_000,
  balanceAmount: 780_000,
  preferredDate: '2026-06-20',
  preferredTime: '오전',
  preferredTimeDetail: '09:00',
} as const;

const HELP =
  '발주서 발급·목록에서 「메시지 복사」할 때 고객에게 보내는 안내 문구입니다.\n' +
  '금액·일정·발주서·C/S·페이백 URL은 발급 건마다 자동으로 채워집니다.\n' +
  '{{amount}}, {{priceLabel}}, {{balance}}, {{deposit}}, {{date}}, {{timeSlot}}, {{timeDetail}}, {{paybackLink}} 치환을 사용할 수 있습니다.';

type LinkFieldDef = {
  key: keyof Pick<
    FormMessagesState,
    | 'formTitle'
    | 'priceLabel'
    | 'reviewEventText'
    | 'customerLinkTotalLine'
    | 'customerLinkBalanceLine'
    | 'customerLinkScheduleLine'
    | 'customerLinkTimeDetailLine'
    | 'customerLinkOrderIntro'
    | 'customerLinkCsNotice'
    | 'customerLinkCsUrlLabel'
    | 'customerLinkPaybackBlock'
    | 'footerNotice1'
    | 'footerNotice2'
  >;
  label: string;
  hint?: string;
  rows?: number;
  placeholder?: string;
  allowEmpty?: boolean;
};

const LINK_FIELDS: LinkFieldDef[] = [
  { key: 'formTitle', label: '제목 (첫 줄)', rows: 3, placeholder: ORDER_FORM_CONFIG_DEFAULTS.formTitle },
  { key: 'priceLabel', label: '금액 옆 라벨', rows: 2, placeholder: ORDER_FORM_CONFIG_DEFAULTS.priceLabel },
  {
    key: 'customerLinkTotalLine',
    label: '총액 줄',
    rows: 2,
    placeholder: ORDER_FORM_CUSTOMER_LINK_COPY_DEFAULTS.customerLinkTotalLine,
    hint: '치환: {{amount}}, {{priceLabel}}',
  },
  {
    key: 'customerLinkBalanceLine',
    label: '잔금·예약금 줄',
    rows: 2,
    placeholder: ORDER_FORM_CUSTOMER_LINK_COPY_DEFAULTS.customerLinkBalanceLine,
    hint: '치환: {{balance}}, {{deposit}}',
  },
  {
    key: 'reviewEventText',
    label: '리뷰 이벤트 문구',
    rows: 3,
    placeholder: ORDER_FORM_CONFIG_DEFAULTS.reviewEventText,
    hint: '비워 두고 저장하면 메시지에서 숨깁니다.',
    allowEmpty: true,
  },
  {
    key: 'customerLinkScheduleLine',
    label: '청소일시 줄 (예약일·시간대 있을 때)',
    rows: 2,
    placeholder: ORDER_FORM_CUSTOMER_LINK_COPY_DEFAULTS.customerLinkScheduleLine,
    hint: '치환: {{date}}, {{timeSlot}}',
  },
  {
    key: 'customerLinkTimeDetailLine',
    label: '희망 시각 줄 (상세 시각 있을 때)',
    rows: 2,
    placeholder: ORDER_FORM_CUSTOMER_LINK_COPY_DEFAULTS.customerLinkTimeDetailLine,
    hint: '치환: {{timeDetail}}',
  },
  {
    key: 'customerLinkOrderIntro',
    label: '발주서 링크 안내 (링크 바로 위)',
    rows: 2,
    placeholder: ORDER_FORM_CUSTOMER_LINK_COPY_DEFAULTS.customerLinkOrderIntro,
  },
  {
    key: 'customerLinkCsNotice',
    label: 'C/S 신고 안내 (신고 URL 위)',
    rows: 4,
    placeholder: ORDER_FORM_CUSTOMER_LINK_COPY_DEFAULTS.customerLinkCsNotice,
  },
  {
    key: 'customerLinkCsUrlLabel',
    label: '신고 URL 라벨',
    rows: 1,
    placeholder: ORDER_FORM_CUSTOMER_LINK_COPY_DEFAULTS.customerLinkCsUrlLabel,
  },
  {
    key: 'customerLinkPaybackBlock',
    label: '페이백 안내 (발급 시 페이백 토큰이 있을 때)',
    rows: 6,
    placeholder: ORDER_FORM_CUSTOMER_LINK_COPY_DEFAULTS.customerLinkPaybackBlock,
    hint: '치환: {{paybackLink}} — 미리보기에는 샘플 링크가 표시됩니다.',
  },
  { key: 'footerNotice1', label: '하단 안내 1', rows: 3, placeholder: ORDER_FORM_CONFIG_DEFAULTS.footerNotice1 },
  { key: 'footerNotice2', label: '하단 안내 2', rows: 3, placeholder: ORDER_FORM_CONFIG_DEFAULTS.footerNotice2 },
];

export function AdminOrderFormCustomerLinkSettingsPage() {
  const token = getToken();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [msgConfig, setMsgConfig] = useState<FormMessagesState>(() =>
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
  );

  const refresh = useCallback(() => {
    if (!token) return;
    getFormConfig(token)
      .then((c) => {
        setMsgConfig(normalizeMsgConfigForEditor(c));
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
        setMsgConfig(normalizeMsgConfigForEditor(c));
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
      msgConfig,
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
        ...customerLinkCopyPayloadFromEditor(msgConfig),
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
              고객에게 보내는 발주서 안내 메시지의 모든 문구를 편집합니다. URL은 발급 시 자동 삽입됩니다.
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

        <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
          <div className="min-w-0 space-y-4">
            {LINK_FIELDS.map((field) => (
              <section key={field.key} className="space-y-2">
                <label className="block text-fluid-xs font-medium text-gray-800">{field.label}</label>
                <textarea
                  rows={field.rows ?? 3}
                  className={`${MSG_TEXTAREA_CLS} min-h-[3rem]`}
                  value={msgConfig[field.key] ?? ''}
                  onChange={(e) =>
                    setMsgConfig((c) => ({
                      ...c,
                      [field.key]: e.target.value,
                    }))
                  }
                  placeholder={field.placeholder}
                />
                {field.hint ? <p className="text-fluid-2xs text-gray-500">{field.hint}</p> : null}
              </section>
            ))}

            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-fluid-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>

          <section className="min-w-0 rounded-xl border border-gray-200 bg-gray-50 p-4 xl:sticky xl:top-4">
            <h2 className="mb-2 text-fluid-xs font-semibold text-gray-800">메시지 미리보기</h2>
            <p className="mb-3 text-fluid-2xs leading-relaxed text-gray-500">
              샘플 금액·일정·페이백 링크 기준입니다. 실제 발주서 URL·금액·페이백 토큰은 발급 건마다 달라집니다.
            </p>
            <pre className="max-h-[min(75vh,720px)] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-gray-200 bg-white p-3 text-fluid-xs leading-relaxed text-gray-800">
              {previewMessage}
            </pre>
          </section>
        </div>
      </div>
    </div>
  );
}
