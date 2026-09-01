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
}) {
  const { token, cancellationSection } = props;
  const [brandLabel, setBrandLabel] = useState<string | null>(null);
  const [policyRaw, setPolicyRaw] = useState<unknown>(undefined);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    listOperatingCompanies(token)
      .then((r) => {
        if (cancelled) return;
        const row = pickPreviewBrand(r.items);
        setBrandLabel(row?.displayName ?? null);
        setPolicyRaw(row?.config.cancellationPolicy);
      })
      .catch(() => {
        if (!cancelled) {
          setBrandLabel(null);
          setPolicyRaw(undefined);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

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
        에 적은 문구로 바뀝니다.
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
