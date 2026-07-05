import { useCallback, useEffect, useRef, useState } from 'react';
import { getToken } from '../../stores/auth';
import { getInquiries } from '../../api/inquiries';
import { getFormConfig, type OrderForm } from '../../api/orderform';
import { listOrderFormTemplates, type OrderFormTemplate } from '../../api/orderFormTemplates';
import { useStaffTenantSlugForLinks } from '../../hooks/useStaffTenantSlugForLinks';
import { InternalCustomerToneRadio } from '../admin/InternalCustomerToneRadio';
import {
  DEFAULT_INTERNAL_CUSTOMER_TONE,
  normalizeInternalCustomerTone,
  type InternalCustomerTone,
} from '../../constants/internalCustomerTone';
import { OrderFormPage, type OrderFormEditorContext } from '../../pages/order/OrderFormPage';
import {
  buildOrderFormCustomerMessage,
  getOrderFormPublicUrl,
  normalizeMsgConfigForEditor,
  orderFormBrandFromOperatingCompany,
  type FormMessagesState,
} from '../../utils/orderFormCustomerCopy';
import { copyTextToClipboard } from '../../utils/clipboard';
import { HelpTooltip } from '../ui/HelpTooltip';

export type CrmOrderIssueSeed = {
  customerName?: string;
  customerPhone?: string;
  areaPyeong?: string;
  areaBasis?: string;
  address?: string;
  preferredDate?: string;
  totalAmount?: string;
  depositAmount?: string;
};

export function OrderIssueInlinePanel({
  pendingInquiryId: pendingInquiryIdProp,
  crmSeed,
  onIssued,
  compact,
}: {
  pendingInquiryId?: string;
  crmSeed?: CrmOrderIssueSeed;
  onIssued?: () => void;
  compact?: boolean;
}) {
  const token = getToken();
  const staffTenantSlug = useStaffTenantSlugForLinks(token);
  const [pendingLinkOptions, setPendingLinkOptions] = useState<
    Array<{
      id: string;
      customerName: string;
      customerPhone: string;
      internalCustomerTone?: InternalCustomerTone | null;
    }>
  >([]);
  const [issueTemplatesLoaded, setIssueTemplatesLoaded] = useState(false);
  const [pendingLinkId, setPendingLinkId] = useState(pendingInquiryIdProp?.trim() ?? '');
  const [issueInternalCustomerTone, setIssueInternalCustomerTone] =
    useState<InternalCustomerTone>(DEFAULT_INTERNAL_CUSTOMER_TONE);
  const [orderTemplates, setOrderTemplates] = useState<OrderFormTemplate[]>([]);
  const [issueTemplateId, setIssueTemplateId] = useState('');
  const [issueFormKey, setIssueFormKey] = useState(0);
  const [newOrder, setNewOrder] = useState<OrderForm | null>(null);
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
    }),
  );
  const completeRef = useRef<HTMLDivElement>(null);
  const pendingFromPropApplied = useRef<string | null>(null);

  useEffect(() => {
    const raw = pendingInquiryIdProp?.trim();
    if (!raw) return;
    if (pendingFromPropApplied.current === raw) return;
    pendingFromPropApplied.current = raw;
    setPendingLinkId(raw);
  }, [pendingInquiryIdProp]);

  useEffect(() => {
    if (!token) return;
    getFormConfig(token)
      .then((c) => setMsgConfig(normalizeMsgConfigForEditor(c)))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;
    getInquiries(token, { status: 'PENDING,DEPOSIT_COMPLETED,ORDER_FORM_PENDING', datePreset: 'all' })
      .then(
        (r: {
          items: Array<{
            id: string;
            customerName: string;
            customerPhone?: string | null;
            internalCustomerTone?: InternalCustomerTone | null;
          }>;
        }) => {
          setPendingLinkOptions(
            r.items.map((i) => ({
              id: i.id,
              customerName: i.customerName,
              customerPhone: (i.customerPhone ?? '').trim(),
              internalCustomerTone: i.internalCustomerTone ?? null,
            })),
          );
        },
      )
      .catch(() => setPendingLinkOptions([]));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setIssueTemplatesLoaded(false);
    void listOrderFormTemplates(token)
      .then((items) => {
        if (cancelled) return;
        const published = items.filter((t) => t.status === 'PUBLISHED');
        setOrderTemplates(published);
        setIssueTemplateId((prev) => {
          if (prev && published.some((t) => t.id === prev)) return prev;
          const def = published.find((t) => t.isDefault) ?? published[0];
          return def?.id ?? '';
        });
      })
      .catch(() => {
        if (!cancelled) setOrderTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setIssueTemplatesLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const brandSlugForOrder = (order: OrderForm) => order.operatingCompany?.slug ?? null;

  const getOrderLink = useCallback(
    (orderToken: string, brandSlug?: string | null) =>
      getOrderFormPublicUrl(orderToken, undefined, staffTenantSlug || null, brandSlug),
    [staffTenantSlug],
  );

  const getOrderMessage = useCallback(
    (order: OrderForm) => {
      const { brandSlug, brandDisplayName } = orderFormBrandFromOperatingCompany(order.operatingCompany);
      return buildOrderFormCustomerMessage(
        msgConfig,
        order,
        undefined,
        staffTenantSlug || null,
        brandSlug,
        brandDisplayName,
      );
    },
    [msgConfig, staffTenantSlug],
  );

  const handleOrderCreated = useCallback(
    (order: OrderForm) => {
      setNewOrder(order);
      setPendingLinkId('');
      setIssueFormKey((k) => k + 1);
      onIssued?.();
      requestAnimationFrame(() => {
        completeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    },
    [onIssued],
  );

  const copyMessage = async () => {
    if (!newOrder) return;
    const ok = await copyTextToClipboard(getOrderMessage(newOrder));
    if (!ok) alert('복사에 실패했습니다.');
  };

  const copyLink = async () => {
    if (!newOrder) return;
    const ok = await copyTextToClipboard(getOrderLink(newOrder.token, brandSlugForOrder(newOrder)));
    if (!ok) alert('복사에 실패했습니다.');
  };

  if (!token) {
    return <p className="text-fluid-sm text-gray-500">로그인이 필요합니다.</p>;
  }

  const editorCreate: NonNullable<OrderFormEditorContext['create']> = {
    templateId: issueTemplateId || undefined,
    pendingInquiryId: pendingLinkId || undefined,
    internalCustomerTone: issueInternalCustomerTone,
    onCreated: handleOrderCreated,
    crmSeed,
  };

  return (
    <div className={compact ? 'space-y-4' : 'min-w-0 w-full max-w-full space-y-4'}>
      <div className="flex items-center gap-2">
        <h3 className="text-fluid-sm font-semibold text-gray-900">발주서 발급</h3>
        <HelpTooltip
          className="shrink-0"
          text="대기 접수를 연결하면 고객 제출 시 같은 접수로 전환됩니다. CRM 접수 저장 직후 연결하는 것을 권장합니다."
        />
      </div>

      <div className="space-y-4">
        {orderTemplates.length > 0 ? (
          <label className="block space-y-1">
            <span className="text-fluid-xs font-medium text-gray-700">발주서 양식</span>
            <select
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-fluid-sm"
              value={issueTemplateId}
              onChange={(e) => setIssueTemplateId(e.target.value)}
            >
              {orderTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.icon ? `${t.icon} ` : ''}
                  {t.title}
                  {t.isDefault ? ' (기본)' : ''}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="block space-y-1">
          <span className="text-fluid-xs font-medium text-gray-700">대기 접수 연결 (선택)</span>
          <select
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-fluid-sm"
            value={pendingLinkId}
            onChange={(e) => {
              const id = e.target.value;
              setPendingLinkId(id);
              const row = pendingLinkOptions.find((o) => o.id === id);
              if (row?.internalCustomerTone) {
                setIssueInternalCustomerTone(normalizeInternalCustomerTone(row.internalCustomerTone));
              } else {
                setIssueInternalCustomerTone(DEFAULT_INTERNAL_CUSTOMER_TONE);
              }
            }}
          >
            <option value="">없음 (일반 발급)</option>
            {pendingLinkOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.customerName} · {o.customerPhone || o.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>

        <InternalCustomerToneRadio
          value={issueInternalCustomerTone}
          onChange={setIssueInternalCustomerTone}
          name="crmIssueInternalCustomerTone"
        />
      </div>

      <div className="border-t border-gray-100 pt-4">
        <p className="mb-3 text-fluid-2xs text-gray-500">
          상담 내용을 미리 채우면 고객 화면에서 해당 항목이 잠깁니다.
        </p>
        {!issueTemplatesLoaded ? (
          <p className="py-4 text-center text-fluid-sm text-gray-500">발주서 양식 불러오는 중…</p>
        ) : (
          <OrderFormPage
            key={`crm-issue-${issueTemplateId}-${pendingLinkId}-${issueFormKey}`}
            editor={{
              authToken: token,
              inline: true,
              create: editorCreate,
            }}
          />
        )}
      </div>

      {newOrder ? (
        <div ref={completeRef} className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
          <p className="text-fluid-sm font-semibold text-gray-900">발급 완료</p>
          <p className="text-fluid-sm text-gray-700 tabular-nums">
            {newOrder.customerName} · {newOrder.totalAmount.toLocaleString('ko-KR')}원
          </p>
          <p className="break-all text-fluid-2xs text-gray-600">
            {getOrderLink(newOrder.token, brandSlugForOrder(newOrder))}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyMessage()}
              className="rounded-lg bg-slate-900 px-3 py-2 text-fluid-xs text-white"
            >
              메시지 복사
            </button>
            <button
              type="button"
              onClick={() => void copyLink()}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-fluid-xs text-gray-800"
            >
              링크 복사
            </button>
            <button
              type="button"
              onClick={() => window.open(getOrderLink(newOrder.token, brandSlugForOrder(newOrder)), '_blank')}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-fluid-xs text-gray-800"
            >
              새 창
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
