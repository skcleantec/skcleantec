import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getToken } from '../../stores/auth';
import { getInquiries } from '../../api/inquiries';
import { listOrderFormTemplates, type OrderFormTemplate } from '../../api/orderFormTemplates';
import type { OrderForm } from '../../api/orderform';
import { useStaffTenantSlugForLinks } from '../../hooks/useStaffTenantSlugForLinks';
import { useOrderFormBrandCustomerLinkConfigs } from '../../hooks/useOrderFormBrandCustomerLinkConfigs';
import { useOrderIssueOperatingCompanies } from '../../hooks/useOrderIssueOperatingCompanies';
import { InternalCustomerToneRadio } from '../admin/InternalCustomerToneRadio';
import { InquiryLeadSourceSelect } from '../inquiry/InquiryLeadSourceSelect';
import { CollaborationMarketerSelect } from '../inquiry/CollaborationMarketerSelect';
import { useCollaborationMarketerOptions } from '../../hooks/useCollaborationMarketerOptions';
import { useAdminStaffSession } from '../../hooks/useAdminStaffSession';
import {
  DEFAULT_INTERNAL_CUSTOMER_TONE,
  normalizeInternalCustomerTone,
  type InternalCustomerTone,
} from '../../constants/internalCustomerTone';
import { OrderFormPage, type OrderFormEditorContext } from '../../pages/order/OrderFormPage';
import { OrderFormIssueCompleteCard } from './OrderFormIssueCompleteCard';
import {
  buildOrderFormCustomerMessage,
  customerLinkMsgConfigForBrand,
  getOrderFormPublicUrl,
  normalizeMsgConfigForEditor,
  orderFormBrandFromOperatingCompany,
} from '../../utils/orderFormCustomerCopy';
import { copyTextToClipboard } from '../../utils/clipboard';
import { scrollElementIntoNearestScrollContainer } from '../../utils/staffAppScrollRestore';
import { HelpTooltip } from '../ui/HelpTooltip';
import { defaultScheduleLeadSourceLabel } from '@shared/inquiryLeadSourceDefaults';

export type CrmOrderIssueSeed = {
  customerName?: string;
  customerPhone?: string;
  areaPyeong?: string;
  areaBasis?: string;
  address?: string;
  preferredDate?: string;
  roomCount?: string;
  bathroomCount?: string;
  balconyCount?: string;
  totalAmount?: string;
  depositAmount?: string;
  /** CRM 견적 — source=order 전문시공 (수동 단가 포함) */
  professionalOptionIds?: Array<{ id: string; quantity?: number; unitAmount?: number | null }>;
  /** CRM 견적 항목별 내역 — 발주서 커스텀 필드 `crmQuoteBreakdown` prefill */
  crmQuoteBreakdown?: string;
};

export function OrderIssueInlinePanel({
  pendingInquiryId: pendingInquiryIdProp,
  crmSeed,
  defaultOperatingCompanyId,
  onIssued,
  compact,
  hideTitle,
}: {
  pendingInquiryId?: string;
  crmSeed?: CrmOrderIssueSeed;
  /** CRM 작업 브랜드 등 — 초기 선택값 */
  defaultOperatingCompanyId?: string | null;
  onIssued?: (order: OrderForm) => void;
  compact?: boolean;
  hideTitle?: boolean;
}) {
  const token = getToken();
  const staffTenantSlug = useStaffTenantSlugForLinks(token);
  const issueBrands = useOrderIssueOperatingCompanies(token);
  const [pendingLinkOptions, setPendingLinkOptions] = useState<
    Array<{
      id: string;
      customerName: string;
      customerPhone: string;
      internalCustomerTone?: InternalCustomerTone | null;
      operatingCompanyId?: string | null;
      createdById?: string | null;
    }>
  >([]);
  const [issueTemplatesLoaded, setIssueTemplatesLoaded] = useState(false);
  const [issueTemplatesError, setIssueTemplatesError] = useState<string | null>(null);
  const [pendingLinkId, setPendingLinkId] = useState(pendingInquiryIdProp?.trim() ?? '');
  const [issueInternalCustomerTone, setIssueInternalCustomerTone] =
    useState<InternalCustomerTone>(DEFAULT_INTERNAL_CUSTOMER_TONE);
  const [orderTemplates, setOrderTemplates] = useState<OrderFormTemplate[]>([]);
  const [issueTemplateId, setIssueTemplateId] = useState('');
  const [issueLeadSource, setIssueLeadSource] = useState('');
  const [issueCollaborationMarketerId, setIssueCollaborationMarketerId] = useState('');
  const [issueOperatingCompanyId, setIssueOperatingCompanyId] = useState('');
  const collaborationMarketerOptions = useCollaborationMarketerOptions(token);
  const { userId: issueUserId, userName: issueUserName, role: issueUserRole } = useAdminStaffSession();
  const pendingLinkedBrandId =
    pendingLinkOptions.find((o) => o.id === pendingLinkId)?.operatingCompanyId?.trim() || '';
  const issueBrandLocked = Boolean(pendingLinkedBrandId);
  const effectiveIssueOperatingCompanyId = issueBrandLocked
    ? pendingLinkedBrandId
    : issueOperatingCompanyId;
  const issuePrimaryMarketerId =
    pendingLinkOptions.find((o) => o.id === pendingLinkId)?.createdById?.trim() ||
    issueUserId ||
    '';

  useEffect(() => {
    const def = defaultScheduleLeadSourceLabel(staffTenantSlug);
    if (!def) return;
    setIssueLeadSource((prev) => (prev.trim() ? prev : def));
  }, [staffTenantSlug]);

  useEffect(() => {
    const preferred = defaultOperatingCompanyId?.trim() || '';
    const fallback = issueBrands.defaultOperatingCompanyId;
    const next =
      preferred && issueBrands.items.some((oc) => oc.operatingCompanyId === preferred)
        ? preferred
        : fallback;
    if (!next) return;
    setIssueOperatingCompanyId((prev) => {
      if (prev && issueBrands.items.some((oc) => oc.operatingCompanyId === prev)) return prev;
      return next;
    });
  }, [defaultOperatingCompanyId, issueBrands.defaultOperatingCompanyId, issueBrands.items]);

  const [issueFormKey, setIssueFormKey] = useState(0);
  const [newOrder, setNewOrder] = useState<OrderForm | null>(null);
  const { map: brandMsgConfigMap, tenantFallback: brandMsgTenantFallback } =
    useOrderFormBrandCustomerLinkConfigs(token);
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
    getInquiries(token, { status: 'PENDING,DEPOSIT_COMPLETED,ORDER_FORM_PENDING', datePreset: 'all' })
      .then(
        (r: {
          items: Array<{
            id: string;
            customerName: string;
            customerPhone?: string | null;
            internalCustomerTone?: InternalCustomerTone | null;
            operatingCompanyId?: string | null;
            createdBy?: { id: string } | null;
          }>;
        }) => {
          setPendingLinkOptions(
            r.items.map((i) => ({
              id: i.id,
              customerName: i.customerName,
              customerPhone: (i.customerPhone ?? '').trim(),
              internalCustomerTone: i.internalCustomerTone ?? null,
              operatingCompanyId: i.operatingCompanyId ?? null,
              createdById: i.createdBy?.id ?? null,
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
    setIssueTemplatesError(null);
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
      .catch((e) => {
        if (!cancelled) {
          setOrderTemplates([]);
          setIssueTemplatesError(
            e instanceof Error ? e.message : '발주서 양식 목록을 불러올 수 없습니다.',
          );
        }
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
      const msgConfig = customerLinkMsgConfigForBrand(
        brandMsgConfigMap,
        order.operatingCompany?.id,
        brandMsgTenantFallback ??
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
      return buildOrderFormCustomerMessage(
        msgConfig,
        order,
        undefined,
        staffTenantSlug || null,
        brandSlug,
        brandDisplayName,
      );
    },
    [brandMsgConfigMap, brandMsgTenantFallback, staffTenantSlug],
  );

  const handleOrderCreated = useCallback(
    (order: OrderForm) => {
      setNewOrder(order);
      onIssued?.(order);
    },
    [onIssued],
  );

  useLayoutEffect(() => {
    if (!newOrder) return;
    const el = completeRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      scrollElementIntoNearestScrollContainer(el, 'smooth', 16);
    });
  }, [newOrder]);

  const startNewIssue = useCallback(() => {
    setNewOrder(null);
    setPendingLinkId('');
    setIssueLeadSource(defaultScheduleLeadSourceLabel(staffTenantSlug) || '');
    setIssueCollaborationMarketerId('');
    setIssueFormKey((k) => k + 1);
  }, [staffTenantSlug]);

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
    leadSource: issueLeadSource,
    operatingCompanyId: effectiveIssueOperatingCompanyId || undefined,
    collaborationMarketerId: issueCollaborationMarketerId.trim() || null,
    onCreated: handleOrderCreated,
    crmSeed,
  };

  return (
    <div className={compact ? 'space-y-4' : 'min-w-0 w-full max-w-full space-y-4'}>
      {hideTitle ? null : (
        <div className="flex items-center gap-2">
          <h3 className="text-fluid-sm font-semibold text-gray-900">발주서 발급</h3>
          <HelpTooltip
            className="shrink-0"
            text="대기 접수를 연결하면 고객 제출 시 같은 접수로 전환됩니다. CRM 접수 저장 직후 연결하는 것을 권장합니다."
          />
        </div>
      )}

      <div className="space-y-4">
        {issueTemplatesLoaded ? (
          <label className="block space-y-1">
            <span className="text-fluid-xs font-medium text-gray-700">발주서 양식</span>
            {orderTemplates.length > 0 ? (
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
            ) : (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-fluid-xs text-amber-950">
                {issueTemplatesError ??
                  '발행된 발주서 양식이 없습니다. 「발주서 양식」 메뉴에서 발행 후 다시 시도해 주세요.'}
              </p>
            )}
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

        {issueBrands.items.length > 0 ? (
          <label className="block space-y-1">
            <span className="text-fluid-xs font-medium text-gray-700">영업 브랜드 *</span>
            <select
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-fluid-sm disabled:bg-gray-50 disabled:text-gray-600"
              value={effectiveIssueOperatingCompanyId}
              disabled={issueBrandLocked || issueBrands.loading}
              onChange={(e) => setIssueOperatingCompanyId(e.target.value)}
            >
              {issueBrands.items.map((oc) => (
                <option key={oc.operatingCompanyId} value={oc.operatingCompanyId}>
                  {oc.displayName}
                  {oc.isPrimary ? ' (기본)' : ''}
                </option>
              ))}
            </select>
            <span className="block text-fluid-2xs text-gray-500">
              {issueBrandLocked
                ? '대기 접수에 연결된 영업 브랜드로 발급됩니다.'
                : issueBrands.isAdmin
                  ? '관리자는 지정 여부와 관계없이 브랜드를 선택할 수 있습니다.'
                  : '본인에게 지정된 영업 브랜드만 선택할 수 있습니다.'}
            </span>
          </label>
        ) : null}

        <CollaborationMarketerSelect
          value={issueCollaborationMarketerId}
          onChange={setIssueCollaborationMarketerId}
          marketerOptions={collaborationMarketerOptions}
          excludeMarketerId={issuePrimaryMarketerId}
          meUser={
            issueUserId && issueUserName
              ? { id: issueUserId, name: issueUserName, role: issueUserRole ?? undefined }
              : null
          }
          labelClassName="text-fluid-xs font-medium text-gray-700"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-fluid-sm"
        />

        <label className="block space-y-1">
          <span className="text-fluid-xs font-medium text-gray-700">유입 경로 *</span>
          <InquiryLeadSourceSelect
            value={issueLeadSource}
            onChange={setIssueLeadSource}
            required
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-fluid-sm"
          />
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
            key={`crm-issue-${issueTemplateId}-${issueFormKey}`}
            editor={{
              authToken: token,
              inline: true,
              create: editorCreate,
            }}
          />
        )}
      </div>

      {newOrder ? (
        <div ref={completeRef}>
          <OrderFormIssueCompleteCard
            compact
            customerName={newOrder.customerName}
            totalAmount={newOrder.totalAmount}
            link={getOrderLink(newOrder.token, brandSlugForOrder(newOrder))}
            message={getOrderMessage(newOrder)}
            onCopyMessage={copyMessage}
            onCopyLink={copyLink}
            onOpenNewTab={() =>
              window.open(getOrderLink(newOrder.token, brandSlugForOrder(newOrder)), '_blank')
            }
            onNewIssue={startNewIssue}
            showPrefill={false}
          />
        </div>
      ) : null}
    </div>
  );
}
