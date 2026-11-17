import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchBrandChannelCopy,
  fetchPlatformBrandChannelReview,
  openPlatformTemplateReview,
  savePlatformBrandChannelFees,
  syncPlatformBrandChannels,
  type BrandTemplateCopy,
  type PlatformBrandChannelReview,
} from '../../api/alimtalkBrandChannel';
import { BTN_PRIMARY, BTN_SECONDARY, CARD_SECTION } from '../../utils/platformUi';

function clock(iso: string | null): string {
  if (!iso) return '아직 없음';
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' });
}

export function PlatformAlimtalkChannelReview() {
  const [data, setData] = useState<PlatformBrandChannelReview | null>(null);
  const [setupFee, setSetupFee] = useState('99000');
  const [copyFee, setCopyFee] = useState('30000');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copies, setCopies] = useState<BrandTemplateCopy[] | null>(null);

  const load = useCallback(async () => {
    const next = await fetchPlatformBrandChannelReview();
    setData(next);
    setSetupFee(String(next.fees.setupFeeKrw));
    setCopyFee(String(next.fees.customCopyFeeKrw));
  }, []);

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : '채널 심사를 불러오지 못했습니다.'));
  }, [load]);

  const summary = data?.summary;
  const tiles = [
    ['연결된 브랜드', summary?.linked ?? 0],
    ['입금 대기', summary?.paymentPending ?? 0],
    ['심사 중', summary?.inReview ?? 0],
    ['반려', summary?.rejected ?? 0],
    ['신청 대기', summary?.ready ?? 0],
  ] as const;

  return (
    <div className="space-y-4">
      <section className={CARD_SECTION}>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-fluid-2xs text-gray-500">
            세팅비 (부가세 포함)
            <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-fluid-sm" value={setupFee} onChange={(e) => setSetupFee(e.target.value)} />
          </label>
          <label className="text-fluid-2xs text-gray-500">
            문구 커스텀 건당 (부가세 포함)
            <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-fluid-sm" value={copyFee} onChange={(e) => setCopyFee(e.target.value)} />
          </label>
        </div>
        <button
          type="button"
          className={`${BTN_SECONDARY} mt-2`}
          onClick={() => {
            void savePlatformBrandChannelFees({ setupFeeKrw: Number(setupFee), customCopyFeeKrw: Number(copyFee) })
              .then(() => load())
              .catch((err) => setError(err instanceof Error ? err.message : '금액을 저장하지 못했습니다.'));
          }}
        >
          금액 저장
        </button>
      </section>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-3">
            <p className="text-xl font-bold tabular-nums text-slate-900">{value}</p>
            <p className="text-fluid-2xs text-gray-500">
              {label}
              {label === '신청 대기' ? <span className="ml-1 text-gray-400">연결 필요 {summary?.needsLink ?? 0}</span> : null}
            </p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-fluid-2xs text-gray-500">마지막 확인 {clock(data?.lastCheckedAt ?? null)}</p>
        <button
          type="button"
          className={BTN_PRIMARY}
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError('');
            void syncPlatformBrandChannels()
              .then(() => load())
              .catch((err) => setError(err instanceof Error ? err.message : '확인하지 못했습니다.'))
              .finally(() => setBusy(false));
          }}
        >
          지금 확인
        </button>
      </div>
      {error ? <p className="text-fluid-2xs text-red-700">{error}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full text-fluid-xs">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">업체</th>
              <th className="px-3 py-2 text-left font-medium">브랜드</th>
              <th className="px-3 py-2 text-left font-medium">채널</th>
              <th className="px-3 py-2 text-left font-medium">상태</th>
              <th className="px-3 py-2 text-left font-medium">서식</th>
              <th className="px-3 py-2 text-left font-medium" />
            </tr>
          </thead>
          <tbody>
            {(data?.rows ?? []).map((row) => (
              <tr key={row.id} className="border-t border-gray-100">
                <td className="px-3 py-2">{row.tenantName}</td>
                <td className="px-3 py-2">{row.brandName}</td>
                <td className="px-3 py-2">{row.searchId}</td>
                <td className="px-3 py-2">{row.badge?.label ?? row.status}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {row.templates.map((item) => (
                      <span key={item.label} className="rounded-full bg-slate-100 px-2 py-0.5 text-fluid-2xs font-semibold text-slate-700" title={item.rejectReason ?? item.statusLabel}>
                        {item.statusLabel}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <Link to={`/platform/tenants/${row.tenantId}`} className="text-sky-700 hover:underline">
                    열기
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-fluid-2xs text-gray-500">「신청 대기」는 채널만 연결하고 서식 심사를 아직 신청하지 않은 건이에요.</p>
      <button
        type="button"
        className={BTN_SECONDARY}
        onClick={() => {
          void openPlatformTemplateReview().then((result) => window.open(result.url, '_blank', 'noopener,noreferrer'));
        }}
      >
        심사 화면 열기
      </button>
      <button
        type="button"
        className={BTN_SECONDARY}
        onClick={() => {
          void fetchBrandChannelCopy()
            .then((result) => setCopies(result.templates))
            .catch((err) => setError(err instanceof Error ? err.message : '서식 원문을 불러오지 못했습니다.'));
        }}
      >
        업체 채널용 서식 원문
      </button>
      {copies ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-4 shadow-lg">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-fluid-sm font-semibold text-gray-900">업체 채널용 서식 원문</h3>
              <button type="button" className={BTN_SECONDARY} onClick={() => setCopies(null)}>
                닫기
              </button>
            </div>
            {copies.map((item) => (
              <article key={item.name} className="mt-4 space-y-2 border-t border-gray-100 pt-3">
                <CopyRow label="이름" value={item.name} />
                <CopyRow label="카테고리" value={item.category} />
                <CopyRow label="강조 유형" value={item.emphasizeType} />
                <CopyRow label="강조 제목" value={item.title} />
                <CopyRow label="보조문구" value={item.extra} />
                <CopyRow label="본문" value={item.content} />
                {item.buttons.map((button, index) => (
                  <div key={`${item.name}-${index}`} className="space-y-1">
                    <CopyRow label={`버튼 ${index + 1} 유형`} value={button.type} />
                    <CopyRow label={`버튼 ${index + 1} 이름`} value={button.name} />
                    <CopyRow label={`버튼 ${index + 1} 모바일`} value={button.mobileUrl} />
                    <CopyRow label={`버튼 ${index + 1} PC`} value={button.pcUrl} />
                  </div>
                ))}
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-fluid-2xs text-gray-500">{label}</p>
        <button
          type="button"
          className="text-fluid-2xs text-sky-700"
          onClick={() => void navigator.clipboard.writeText(value)}
        >
          복사
        </button>
      </div>
      <pre className="whitespace-pre-wrap break-words font-sans text-fluid-xs text-gray-900">{value || '—'}</pre>
    </div>
  );
}
