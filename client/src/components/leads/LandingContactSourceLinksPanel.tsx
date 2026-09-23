import { useCallback, useEffect, useState } from 'react';
import { getToken } from '../../stores/auth';
import {
  cancelLandingContactLinkSlotRequest,
  createLandingContactLinkRequest,
  createLandingContactSourceLink,
  getLandingContactSourceLinks,
  updateLandingContactSourceLink,
  type LandingContactSourceLink,
  type LandingContactSourceLinkBoard,
} from '../../api/landingContact';
import { copyTextToClipboard } from '../../utils/clipboard';
import { getContactShortUrl } from '../../utils/landingContactPublicUrl';

const inputCls =
  'w-full min-h-9 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-fluid-xs text-slate-900 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10';

const btnPrimary =
  'rounded-lg bg-slate-900 px-3 py-2 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

const btnSecondary =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-fluid-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

export function LandingContactSourceLinksPanel() {
  const token = getToken();
  const [board, setBoard] = useState<LandingContactSourceLinkBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [code, setCode] = useState('');
  const [brandId, setBrandId] = useState('');
  const [requestCount, setRequestCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const next = await getLandingContactSourceLinks(token);
      setBoard(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '링크를 불러올 수 없습니다.');
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await createLandingContactSourceLink(token, {
        label,
        code: code.trim() || null,
        operatingCompanyId: board && board.brands.length > 1 ? brandId || null : null,
      });
      setLabel('');
      setCode('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '링크를 만들지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (link: LandingContactSourceLink) => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await updateLandingContactSourceLink(token, link.id, { isActive: !link.isActive });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '변경에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const applyPaid = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await createLandingContactLinkRequest(token, requestCount);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '신청에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const cancelRequest = async (id: string) => {
    if (!token) return;
    setBusy(true);
    try {
      await cancelLandingContactLinkSlotRequest(token, id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '취소에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const quota = board?.quota;
  const multiBrand = (board?.brands.length ?? 0) > 1;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="text-fluid-sm font-semibold text-slate-900">짧은 문의 링크</h2>
      <p className="mt-1 text-fluid-xs leading-relaxed text-slate-600">
        새로 만드는 주소는 <span className="font-medium text-slate-800">cbiseo.com/c/주소</span> 형태입니다. 예전
        문의 주소는 그대로 동작합니다. 유입명(유튜브, 블로그 등)은 주소에 넣지 않고 문의내역에 표시됩니다.
      </p>
      {quota ? (
        <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-fluid-2xs leading-snug text-slate-700">
          무료 {quota.activeFree}/{quota.freeIncluded}
          {quota.activePaid > 0
            ? ` · 유료 ${quota.activePaid}개 · 다음 이용료에 월 ${quota.nextInvoiceAddonKrw.toLocaleString('ko-KR')}원`
            : ''}
          {quota.approvedPaidSlots > quota.activePaid
            ? ` · 승인된 유료 자리 ${quota.approvedPaidSlots - quota.activePaid}개 남음`
            : ''}
          . 추가 링크는 1개당 월 {quota.monthlyKrwPerExtra.toLocaleString('ko-KR')}원이며, 끄면 다음 달부터 빠집니다.
        </p>
      ) : null}
      {error ? <p className="mt-2 text-fluid-xs text-red-700">{error}</p> : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="block text-fluid-2xs font-medium text-slate-600">
          유입명
          <input className={`${inputCls} mt-1`} value={label} placeholder="유튜브" onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label className="block text-fluid-2xs font-medium text-slate-600">
          주소 (비우면 자동)
          <input
            className={`${inputCls} mt-1`}
            value={code}
            placeholder="youtube"
            onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16))}
          />
        </label>
        {multiBrand ? (
          <label className="block text-fluid-2xs font-medium text-slate-600 sm:col-span-2">
            브랜드
            <select className={`${inputCls} mt-1`} value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              <option value="">고객이 브랜드를 고름</option>
              {board?.brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.displayName}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className={btnPrimary} disabled={busy || !label.trim()} onClick={() => void create()}>
          링크 만들기
        </button>
      </div>

      {quota?.needsApplication ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-fluid-xs text-amber-950">
            무료 2개를 모두 쓰는 중입니다. 더 만들려면 유료 자리를 신청해 주세요. 승인 후 링크를 만들 수 있습니다.
          </p>
          {quota.pendingRequest ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="text-fluid-xs text-amber-950">
                {quota.pendingRequest.requestedCount}개 신청을 검토 중입니다.
              </p>
              <button type="button" className={btnSecondary} disabled={busy} onClick={() => void cancelRequest(quota.pendingRequest!.id)}>
                신청 취소
              </button>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="text-fluid-xs text-amber-950">
                개수
                <input
                  className={`${inputCls} ml-2 w-16`}
                  type="number"
                  min={1}
                  max={20}
                  value={requestCount}
                  onChange={(e) => setRequestCount(Number(e.target.value))}
                />
              </label>
              <button type="button" className={btnPrimary} disabled={busy} onClick={() => void applyPaid()}>
                유료 신청
              </button>
            </div>
          )}
        </div>
      ) : null}

      <ul className="mt-3 space-y-2">
        {(board?.links ?? []).map((link) => {
          const url = getContactShortUrl(undefined, link.code);
          return (
            <li key={link.id} className="rounded-xl border border-slate-200 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-fluid-sm font-medium text-slate-900">
                    {link.label}
                    <span className="ml-1.5 text-fluid-2xs font-normal text-slate-500">
                      {link.slotKind === 'PAID' ? '유료' : '무료'}
                      {link.isActive ? '' : ' · 꺼짐'}
                      {link.brandName ? ` · ${link.brandName}` : ' · 고객이 브랜드 선택'}
                    </span>
                  </p>
                  <p className="truncate font-mono text-fluid-2xs text-slate-600" title={url}>
                    {url}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() => {
                      void copyTextToClipboard(url).then((ok) => {
                        if (!ok) return;
                        setCopiedId(link.id);
                        window.setTimeout(() => setCopiedId(null), 1500);
                      });
                    }}
                  >
                    {copiedId === link.id ? '복사됨' : '복사'}
                  </button>
                  <button type="button" className={btnSecondary} disabled={busy} onClick={() => void toggle(link)}>
                    {link.isActive ? '끄기' : '켜기'}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
