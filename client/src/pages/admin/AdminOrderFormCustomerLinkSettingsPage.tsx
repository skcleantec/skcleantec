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
import { useStaffTenantSlugForLinks } from '../../hooks/useStaffTenantSlugForLinks';
import { HelpTooltip } from '../../components/ui/HelpTooltip';
import { OrderFormLinkPlaceholderPicker } from '../../components/orderform/OrderFormLinkPlaceholderPicker';

const MSG_TEXTAREA_CLS =
  'w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-fluid-sm leading-relaxed focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500';

const PREVIEW_SAMPLE_ORDER = {
  token: 'sample-preview-token',
  customerName: '홍길동',
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
  '금액·일정·URL은 발급 건마다 자동으로 채워집니다.\n' +
  '치환 명령어는 드롭다운에서 선택 후 복사해 문장에 붙여 넣으세요.';

type LinkFieldKey = keyof Pick<
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

type LinkFieldDef = {
  key: LinkFieldKey;
  label: string;
  rows?: number;
  placeholder?: string;
};

type FieldGroup = {
  id: string;
  title: string;
  fields: LinkFieldDef[];
};

const FIELD_GROUPS: FieldGroup[] = [
  {
    id: 'amount',
    title: '제목·금액',
    fields: [
      { key: 'formTitle', label: '제목 (첫 줄)', rows: 2, placeholder: ORDER_FORM_CONFIG_DEFAULTS.formTitle },
      { key: 'priceLabel', label: '금액 옆 라벨', rows: 1, placeholder: ORDER_FORM_CONFIG_DEFAULTS.priceLabel },
      {
        key: 'customerLinkTotalLine',
        label: '총액 줄',
        rows: 2,
        placeholder: ORDER_FORM_CUSTOMER_LINK_COPY_DEFAULTS.customerLinkTotalLine,
      },
      {
        key: 'customerLinkBalanceLine',
        label: '잔금·예약금 줄',
        rows: 2,
        placeholder: ORDER_FORM_CUSTOMER_LINK_COPY_DEFAULTS.customerLinkBalanceLine,
      },
    ],
  },
  {
    id: 'schedule',
    title: '일정·리뷰',
    fields: [
      {
        key: 'reviewEventText',
        label: '리뷰 이벤트 (비우면 숨김)',
        rows: 3,
        placeholder: ORDER_FORM_CONFIG_DEFAULTS.reviewEventText,
      },
      {
        key: 'customerLinkScheduleLine',
        label: '청소일시 줄',
        rows: 2,
        placeholder: ORDER_FORM_CUSTOMER_LINK_COPY_DEFAULTS.customerLinkScheduleLine,
      },
      {
        key: 'customerLinkTimeDetailLine',
        label: '희망 시각 줄',
        rows: 2,
        placeholder: ORDER_FORM_CUSTOMER_LINK_COPY_DEFAULTS.customerLinkTimeDetailLine,
      },
    ],
  },
  {
    id: 'links',
    title: '링크·C/S·페이백',
    fields: [
      {
        key: 'customerLinkOrderIntro',
        label: '발주서 링크 안내',
        rows: 2,
        placeholder: ORDER_FORM_CUSTOMER_LINK_COPY_DEFAULTS.customerLinkOrderIntro,
      },
      {
        key: 'customerLinkCsNotice',
        label: 'C/S 신고 안내',
        rows: 3,
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
        label: '페이백 안내',
        rows: 5,
        placeholder: ORDER_FORM_CUSTOMER_LINK_COPY_DEFAULTS.customerLinkPaybackBlock,
      },
    ],
  },
  {
    id: 'footer',
    title: '하단 안내',
    fields: [
      { key: 'footerNotice1', label: '하단 안내 1', rows: 2, placeholder: ORDER_FORM_CONFIG_DEFAULTS.footerNotice1 },
      { key: 'footerNotice2', label: '하단 안내 2', rows: 2, placeholder: ORDER_FORM_CONFIG_DEFAULTS.footerNotice2 },
    ],
  },
];

function LinkFieldEditor({
  field,
  value,
  onChange,
}: {
  field: LinkFieldDef;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-fluid-xs font-medium text-gray-800">{field.label}</span>
      <textarea
        rows={field.rows ?? 2}
        className={`${MSG_TEXTAREA_CLS} min-h-[2.5rem]`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
      />
    </label>
  );
}

export function AdminOrderFormCustomerLinkSettingsPage() {
  const token = getToken();
  const staffTenantSlug = useStaffTenantSlugForLinks(token);
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
    return buildOrderFormCustomerMessage(
      msgConfig,
      PREVIEW_SAMPLE_ORDER,
      typeof window !== 'undefined' ? window.location.origin : undefined,
      staffTenantSlug || null,
    );
  }, [msgConfig, staffTenantSlug]);

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
              고객 발송 메시지를 미리보기 중심으로 편집합니다. URL은 발급 시 자동 삽입됩니다.
              <HelpTooltip text={HELP} className="ml-1 align-middle" />
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link
              to="/admin/inquiries/order-customer-preview"
              className="text-fluid-xs text-blue-700 underline hover:text-blue-800"
            >
              발주서설정
            </Link>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-fluid-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
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

        <section className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-fluid-xs font-semibold text-gray-800">메시지 미리보기</h2>
            <OrderFormLinkPlaceholderPicker compact />
          </div>
          <p className="text-fluid-2xs text-gray-500">
            샘플: {PREVIEW_SAMPLE_ORDER.customerName} · 금액·일정·페이백은 발급 건마다 달라집니다.
          </p>
          <pre className="max-h-[min(50vh,420px)] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-gray-200 bg-white p-3 text-fluid-xs leading-relaxed text-gray-800">
            {previewMessage}
          </pre>
        </section>

        <div className="mt-4 space-y-2">
          {FIELD_GROUPS.map((group) => (
              <details
                key={group.id}
                className="rounded-lg border border-gray-200 bg-white group"
              >
                <summary className="cursor-pointer list-none px-3 py-2.5 text-fluid-sm font-medium text-gray-800 hover:bg-gray-50 rounded-lg [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex items-center gap-2">
                    <span className="text-gray-400 text-xs group-open:hidden">▶</span>
                    <span className="text-gray-400 text-xs hidden group-open:inline">▼</span>
                    {group.title}
                    <span className="text-fluid-2xs font-normal text-gray-500">
                      ({group.fields.length}개)
                    </span>
                  </span>
                </summary>
                <div className="space-y-3 border-t border-gray-100 px-3 py-3">
                  {group.fields.map((field) => (
                    <LinkFieldEditor
                      key={field.key}
                      field={field}
                      value={msgConfig[field.key] ?? ''}
                      onChange={(next) =>
                        setMsgConfig((c) => ({
                          ...c,
                          [field.key]: next,
                        }))
                      }
                    />
                  ))}
                </div>
              </details>
            ))}
        </div>
      </div>
    </div>
  );
}
