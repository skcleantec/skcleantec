import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  expandGuideSectionItems,
  GUIDE_PLACEHOLDER_CANCELLATION_POLICY,
  buildGuidePlaceholderContextFromPolicy,
} from '@shared/orderFormGuidePlaceholders';
import { resolveOperatingCompanyCancellationPolicy } from '@shared/operatingCompanyCancellationPolicy';
import { listOperatingCompanies } from '../../api/operatingCompanies';
import { OPERATING_COMPANIES_CANCELLATION_HREF } from '../../constants/operatingCompanyNav';
import type { GuideSection } from '../../constants/orderInfoDefaultSections';

function pickPreviewBrand<T extends { isActive: boolean; isDefault: boolean; displayName: string }>(
  items: T[],
): T | null {
  const active = items.filter((r) => r.isActive);
  return active.find((r) => r.isDefault) ?? active[0] ?? items[0] ?? null;
}

export function OrderGuideCancellationPreview(props: {
  token: string | null;
  cancellationSection: GuideSection | undefined;
  /** 있으면 이 브랜드로 미리보기. 없으면 기본 브랜드 */
  previewBrand?: { displayName: string; cancellationPolicy?: unknown } | null;
}) {
  const { token, cancellationSection, previewBrand } = props;
  const [fetchedLabel, setFetchedLabel] = useState<string | null>(null);
  const [fetchedPolicy, setFetchedPolicy] = useState<unknown>(undefined);

  useEffect(() => {
    if (previewBrand) return;
    if (!token) return;
    let cancelled = false;
    listOperatingCompanies(token)
      .then((r) => {
        if (cancelled) return;
        const row = pickPreviewBrand(r.items);
        setFetchedLabel(row?.displayName ?? null);
        setFetchedPolicy(row?.config.cancellationPolicy);
      })
      .catch(() => {
        if (!cancelled) {
          setFetchedLabel(null);
          setFetchedPolicy(undefined);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, previewBrand]);

  const brandLabel = previewBrand?.displayName ?? fetchedLabel;
  const policyRaw = previewBrand ? previewBrand.cancellationPolicy : fetchedPolicy;

  const previewLines = useMemo(() => {
    if (!cancellationSection) return [];
    const policy = resolveOperatingCompanyCancellationPolicy(policyRaw);
    return expandGuideSectionItems(
      cancellationSection.items,
      buildGuidePlaceholderContextFromPolicy(policy),
    );
  }, [cancellationSection, policyRaw]);

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2.5 space-y-1.5">
      <p className="text-fluid-2xs text-gray-700 leading-relaxed">
        취소·변경에는{' '}
        <code className="rounded bg-white px-1 font-mono text-[11px]">
          {GUIDE_PLACEHOLDER_CANCELLATION_POLICY}
        </code>
        가 들어가 있어야 합니다. 고객 화면에서{' '}
        <Link
          to={OPERATING_COMPANIES_CANCELLATION_HREF}
          className="font-medium text-slate-800 underline decoration-slate-300 underline-offset-2 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 rounded-sm"
        >
          영업브랜드 → 위약금
        </Link>
        에 적은 문구로 바뀝니다. 당일 위약은 위약금 탭에서 구간 「0일 전」을 두면 아래에 같이 나옵니다.
        {brandLabel ? ` (미리보기 브랜드: ${brandLabel})` : ''}
      </p>
      {previewLines.length ? (
        <ul className="space-y-1 text-fluid-2xs text-gray-800 leading-relaxed">
          {previewLines.map((line, i) => (
            <li key={`${i}-${line.slice(0, 24)}`} className="flex gap-1.5">
              <span className="text-gray-400 shrink-0">•</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-fluid-2xs text-gray-500">위약 정책이 꺼져 있으면 이 코드는 비어 보입니다.</p>
      )}
    </div>
  );
}
