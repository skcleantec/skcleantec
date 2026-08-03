import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageTitleWithFavorite } from '../../components/layout/NavFavoritePageTitle';
import { Link, useSearchParams } from 'react-router-dom';
import { getBrandCustomerLinkConfig, updateBrandCustomerLinkConfig } from '../../api/orderform';
import { getToken } from '../../stores/auth';
import { buildDefaultCustomerLinkMessageTemplate } from '@shared/orderFormCustomerLinkCopy';
import {
  buildOrderFormCustomerMessage,
  normalizeMsgConfigForEditor,
  type FormMessagesState,
} from '../../utils/orderFormCustomerCopy';
import { useStaffTenantSlugForLinks } from '../../hooks/useStaffTenantSlugForLinks';
import { useOperatingCompanies } from '../../hooks/useOperatingCompanies';
import { invalidateOrderFormBrandCustomerLinkConfigCache } from '../../hooks/useOrderFormBrandCustomerLinkConfigs';
import { HelpTooltip } from '../../components/ui/HelpTooltip';
import { CustomerLinkMessagePreviewEditor } from '../../components/orderform/CustomerLinkMessagePreviewEditor';

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
  optionNote: '냉장고 내부 청소 포함',
} as const;

const HELP =
  '발주서 발급·목록에서 「메시지 복사」할 때 고객에게 보내는 안내 문구입니다.\n' +
  '라벨(청소일시·페이백 신청 등)은 글자로 쓰고, 값만 {{date}}·{{paybackLink}}처럼 넣으세요.\n' +
  '{{scheduleLine}}처럼 문장 통째 치환은 라벨을 고치기 어렵습니다.';

function pickDefaultBrandId(
  brands: Array<{ id: string; isDefault?: boolean }>,
  preferred?: string | null,
): string {
  if (preferred && brands.some((b) => b.id === preferred)) return preferred;
  const def = brands.find((b) => b.isDefault);
  return def?.id ?? brands[0]?.id ?? '';
}

function emptyEditorState(): FormMessagesState {
  return normalizeMsgConfigForEditor({
    formTitle: '',
    priceLabel: '',
    reviewEventText: '',
    footerNotice1: '',
    footerNotice2: '',
    infoContent: null,
    infoLinkText: null,
    submitSuccessTitle: null,
    submitSuccessBody: null,
  });
}

export function AdminOrderFormCustomerLinkSettingsPage() {
  const token = getToken();
  const staffTenantSlug = useStaffTenantSlugForLinks(token);
  const brands = useOperatingCompanies(token);
  const activeBrands = useMemo(() => brands.filter((b) => b.isActive), [brands]);
  const [searchParams, setSearchParams] = useSearchParams();
  const brandFromUrl = searchParams.get('brand');

  const [operatingCompanyId, setOperatingCompanyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [msgConfig, setMsgConfig] = useState<FormMessagesState>(emptyEditorState);

  const selectedBrand = useMemo(
    () => activeBrands.find((b) => b.id === operatingCompanyId) ?? null,
    [activeBrands, operatingCompanyId],
  );

  const setBrandId = useCallback(
    (id: string) => {
      setOperatingCompanyId(id);
      setSearchParams(id ? { brand: id } : {}, { replace: true });
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (activeBrands.length === 0) return;
    const next = pickDefaultBrandId(activeBrands, brandFromUrl);
    if (next && next !== operatingCompanyId) setOperatingCompanyId(next);
  }, [activeBrands, brandFromUrl, operatingCompanyId]);

  useEffect(() => {
    if (!token || !operatingCompanyId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSavedAt(null);
    getBrandCustomerLinkConfig(token, operatingCompanyId)
      .then((c) => {
        if (cancelled) return;
        setMsgConfig(
          normalizeMsgConfigForEditor({
            ...c,
            infoContent: null,
            infoLinkText: null,
            submitSuccessTitle: null,
            submitSuccessBody: null,
          }),
        );
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
  }, [token, operatingCompanyId]);

  const previewMessage = useMemo(() => {
    const brandSlug = selectedBrand?.slug ?? null;
    const brandDisplayName = selectedBrand?.displayName ?? selectedBrand?.name ?? null;
    return buildOrderFormCustomerMessage(
      msgConfig,
      PREVIEW_SAMPLE_ORDER,
      typeof window !== 'undefined' ? window.location.origin : undefined,
      staffTenantSlug || null,
      brandSlug,
      brandDisplayName,
    );
  }, [msgConfig, staffTenantSlug, selectedBrand]);

  const handleSave = async () => {
    if (!token || !operatingCompanyId) return;
    const body = (msgConfig.customerLinkMessageTemplate ?? '').trim();
    if (!body) {
      setError('메시지 본문이 비어 있습니다.');
      return;
    }
    setSaving(true);
    setError(null);
    setSavedAt(null);
    try {
      const saved = await updateBrandCustomerLinkConfig(token, operatingCompanyId, {
        customerLinkMessageTemplate: body,
      });
      setMsgConfig(
        normalizeMsgConfigForEditor({
          ...saved,
          infoContent: null,
          infoLinkText: null,
          submitSuccessTitle: null,
          submitSuccessBody: null,
        }),
      );
      invalidateOrderFormBrandCustomerLinkConfigCache();
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaultTemplate = () => {
    if (!window.confirm('본문을 기본 양식(값만 치환)으로 다시 채울까요? 지금 편집 내용은 사라집니다.')) {
      return;
    }
    setMsgConfig({
      ...msgConfig,
      customerLinkMessageTemplate: buildDefaultCustomerLinkMessageTemplate(msgConfig),
    });
    setSavedAt(null);
  };

  if (activeBrands.length === 0 && !loading) {
    return (
      <p className="p-6 text-center text-fluid-sm text-gray-500">
        등록된 영업 브랜드가 없습니다. 관리자 전용에서 브랜드를 먼저 등록해 주세요.
      </p>
    );
  }

  if (loading && !operatingCompanyId) {
    return <p className="p-6 text-center text-fluid-sm text-gray-500">불러오는 중…</p>;
  }

  return (
    <div className="min-w-0 w-full max-w-full space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <PageTitleWithFavorite label="고객링크설정">
              <h1 className="text-fluid-base font-semibold text-gray-900">고객링크설정</h1>
            </PageTitleWithFavorite>
            <div className="mt-1 flex flex-wrap items-start gap-1 text-fluid-xs leading-relaxed text-gray-600">
              <span>고객 발송 메시지를 한 칸에서 자유롭게 편집합니다.</span>
              <HelpTooltip text={HELP} className="shrink-0 align-middle" />
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link
              to="/admin/inquiries/order-customer-preview"
              className="text-fluid-xs text-blue-700 underline hover:text-blue-800"
            >
              발주서설정
            </Link>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label className="text-fluid-xs font-medium text-gray-700" htmlFor="customer-link-brand">
            영업 브랜드
          </label>
          <select
            id="customer-link-brand"
            value={operatingCompanyId}
            onChange={(e) => setBrandId(e.target.value)}
            className="min-w-[10rem] rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-fluid-xs text-gray-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            {activeBrands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.displayName || b.name}
              </option>
            ))}
          </select>
        </div>

        {error ? (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-fluid-xs text-red-800">
            {error}
          </p>
        ) : null}

        <CustomerLinkMessagePreviewEditor
          msgConfig={msgConfig}
          onChange={(next) => {
            setMsgConfig(next);
            setSavedAt(null);
          }}
          assembledPreview={previewMessage}
          loading={loading}
        />

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || loading || !operatingCompanyId}
            className="rounded-lg bg-slate-900 px-4 py-2 text-fluid-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
          <button
            type="button"
            onClick={handleResetDefaultTemplate}
            disabled={loading}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-fluid-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            기본 양식으로 다시 채우기
          </button>
          {savedAt ? (
            <span className="text-fluid-2xs text-emerald-700">
              저장되었습니다. 새로 발급·복사하는 메시지부터 반영됩니다.
            </span>
          ) : (
            <span className="text-fluid-2xs text-gray-500">본문을 수정한 뒤 저장하세요.</span>
          )}
        </div>
      </div>
    </div>
  );
}
