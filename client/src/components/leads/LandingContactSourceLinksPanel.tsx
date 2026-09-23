import { useCallback, useEffect, useState } from 'react';
import type { LandingContactCustomFieldDef } from '@shared/landingContactForm';
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
import { normalizeLandingContactFields } from './LandingContactFieldEditor';
import { LandingContactSourceLinkModal, type LandingContactLinkModalMode } from './LandingContactSourceLinkModal';

const btnPrimary =
  'min-h-10 rounded-lg bg-slate-900 px-3 py-2 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

const btnSecondary =
  'min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-fluid-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

export function LandingContactSourceLinksPanel() {
  const token = getToken();
  const [board, setBoard] = useState<LandingContactSourceLinkBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [modal, setModal] = useState<LandingContactLinkModalMode | null>(null);

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

  const run = async (work: () => Promise<void>) => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await work();
      setModal(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const create = (data: {
    label: string;
    code: string;
    operatingCompanyId: string | null;
    customFields: LandingContactCustomFieldDef[];
  }) =>
    void run(async () => {
      if (!token) return;
      await createLandingContactSourceLink(token, {
        label: data.label,
        code: data.code.trim() || null,
        operatingCompanyId: data.operatingCompanyId,
        customFields: normalizeLandingContactFields(data.customFields),
      });
    });

  const edit = (id: string, data: { label: string; operatingCompanyId: string | null }) =>
    void run(async () => {
      if (!token) return;
      await updateLandingContactSourceLink(token, id, data);
    });

  const saveFields = (id: string, fields: LandingContactCustomFieldDef[]) =>
    void run(async () => {
      if (!token) return;
      await updateLandingContactSourceLink(token, id, {
        customFields: normalizeLandingContactFields(fields),
      });
    });

  const toggle = (link: LandingContactSourceLink) =>
    void run(async () => {
      if (!token) return;
      await updateLandingContactSourceLink(token, link.id, { isActive: !link.isActive });
    });

  const buy = () =>
    void run(async () => {
      if (!token) return;
      await createLandingContactLinkRequest(token);
    });

  const cancelRequest = (id: string) =>
    void run(async () => {
      if (!token) return;
      await cancelLandingContactLinkSlotRequest(token, id);
    });

  const quota = board?.quota;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnPrimary} disabled={busy} onClick={() => { setError(null); setModal({ kind: 'create' }); }}>
            링크 생성
          </button>
          {quota?.pendingRequest ? (
            <button
              type="button"
              className={btnSecondary}
              disabled={busy}
              onClick={() => void cancelRequest(quota.pendingRequest!.id)}
            >
              구매 검토 중 · 취소
            </button>
          ) : (
            <button type="button" className={btnSecondary} disabled={busy} onClick={buy}>
              링크 구매
            </button>
          )}
        </div>
        {quota ? (
          <p className="text-fluid-2xs text-slate-600">
            무료 {quota.activeFree}/{quota.freeIncluded}
            {quota.approvedPaidSlots > 0
              ? ` · 구매 ${quota.approvedPaidSlots}개 · 월 ${quota.nextInvoiceAddonKrw.toLocaleString('ko-KR')}원`
              : ''}
          </p>
        ) : null}
      </div>
      {error && !modal ? <p className="mt-2 text-fluid-xs text-red-700">{error}</p> : null}

      <ul className="mt-3 space-y-2">
        {(board?.links ?? []).map((link) => {
          const url = getContactShortUrl(undefined, link.code);
          return (
            <li key={link.id} className="rounded-xl border border-slate-200 px-3 py-2">
              <div className="min-w-0">
                <p className="text-fluid-sm font-medium text-slate-900">
                  {link.label}
                  <span className="ml-1.5 text-fluid-2xs font-normal text-slate-500">
                    {link.slotKind === 'PAID' ? '유료' : '무료'}
                    {link.isActive ? '' : ' · 꺼짐'}
                    {link.brandName ? ` · ${link.brandName}` : ' · 고객이 브랜드 선택'}
                    {link.customFields.length > 0 ? ` · 항목 ${link.customFields.length}` : ''}
                  </span>
                </p>
                <p className="truncate font-mono text-fluid-2xs text-slate-600" title={url}>
                  {url}
                </p>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
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
                <button type="button" className={btnSecondary} disabled={busy} onClick={() => { setError(null); setModal({ kind: 'edit', link }); }}>
                  수정
                </button>
                <button type="button" className={btnSecondary} disabled={busy} onClick={() => { setError(null); setModal({ kind: 'fields', link }); }}>
                  문의 폼 수정
                </button>
                <button type="button" className={btnSecondary} disabled={busy} onClick={() => toggle(link)}>
                  {link.isActive ? '끄기' : '켜기'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <LandingContactSourceLinkModal
        mode={modal}
        brands={board?.brands ?? []}
        busy={busy}
        error={modal ? error : null}
        onClose={() => setModal(null)}
        onCreate={create}
        onEdit={edit}
        onSaveFields={saveFields}
      />
    </section>
  );
}
