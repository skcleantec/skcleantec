import { useCallback, useEffect, useState } from 'react';
import {
  downloadAdminInspectionPdf,
  downloadAdminInspectionPhotosZip,
  fetchAdminInspectionChecklist,
  INSPECTION_STATUS_LABELS,
  resendAdminInspectionEmail,
  voidAdminInspectionChecklist,
  type InspectionChecklistDto,
} from '../../api/inquiryInspection';
import {
  InspectionAreaSection,
  InspectionBasicSection,
  InspectionConsentSection,
  InspectionHeaderBlock,
} from './inspectionUiBlocks';
import { ContaminationPhotosSection } from './ContaminationPhotosSection';
import { useInspectionCompareLightbox } from './useInspectionCompareLightbox';
import { getMe } from '../../api/auth';
import { copyTextToClipboard } from '../../utils/clipboard';
import { getInspectionCustomerViewUrl } from '../../utils/inspectionCustomerCopy';
import { useStaffTenantSlugForLinks } from '../../hooks/useStaffTenantSlugForLinks';
import { isContaminationInspectionArea } from '@shared/inquiryInspectionContamination';
import { useInspectionChecklistRealtime } from '../../hooks/useInspectionChecklistRealtime';

export function AdminInspectionPanel({
  inquiryId,
  token,
}: {
  inquiryId: string;
  token: string;
}) {
  const staffTenantSlug = useStaffTenantSlugForLinks(token);
  const [checklist, setChecklist] = useState<InspectionChecklistDto | null | undefined>(undefined);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voidPassword, setVoidPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const { openCompare, lightbox: compareLightbox } = useInspectionCompareLightbox(checklist);

  const reload = useCallback(async () => {
    setErr(null);
    try {
      const { checklist: dto, smtpConfigured: smtp } = await fetchAdminInspectionChecklist(token, inquiryId);
      setChecklist(dto);
      setSmtpConfigured(smtp);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '불러오기 실패');
      setChecklist(null);
    }
  }, [token, inquiryId]);

  useEffect(() => {
    void reload();
    void getMe(token)
      .then((me) => setIsAdmin(me.role === 'ADMIN'))
      .catch(() => setIsAdmin(false));
  }, [reload, token]);

  const reloadSilent = useCallback(async () => {
    try {
      const { checklist: dto, smtpConfigured: smtp } = await fetchAdminInspectionChecklist(token, inquiryId);
      setChecklist(dto);
      setSmtpConfigured(smtp);
    } catch {
      /* WS silent */
    }
  }, [token, inquiryId]);

  useInspectionChecklistRealtime(token, reloadSilent, Boolean(token && inquiryId && checklist !== undefined));

  const downloadAllPhotos = () => {
    void downloadAdminInspectionPhotosZip(token, inquiryId).catch((e) => {
      alert(e instanceof Error ? e.message : 'ZIP 다운로드 실패');
    });
  };

  const downloadPdf = () => {
    void downloadAdminInspectionPdf(token, inquiryId).catch((e) => {
      alert(e instanceof Error ? e.message : 'PDF 다운로드 실패');
    });
  };

  if (checklist === undefined) {
    return <p className="text-fluid-xs text-gray-500">현장 검수 정보를 불러오는 중…</p>;
  }

  if (!checklist) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-fluid-xs text-gray-600">
        아직 현장 검수 체크리스트가 없습니다. 팀장이 현장에서 「청소 전 촬영」 또는 「현장 검수 · 청소완료」를 진행하면 여기에 표시됩니다.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {err && <p className="text-fluid-xs text-rose-700">{err}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-fluid-2xs font-medium text-slate-800">
          {INSPECTION_STATUS_LABELS[checklist.status]}
        </span>
        {checklist.completedAt && (
          <span className="text-fluid-2xs text-gray-600">
            완료 {new Date(checklist.completedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
          </span>
        )}
        {checklist.emailSentAt ? (
          <span className="text-fluid-2xs text-emerald-700">이메일 발송됨</span>
        ) : checklist.status === 'COMPLETED' ? (
          <span className="text-fluid-2xs text-amber-700">
            {smtpConfigured ? '이메일 발송 대기/실패' : 'SMTP 미설정 (업체등록정보)'}
          </span>
        ) : null}
        {checklist.status === 'COMPLETED' && (
          <span className="text-fluid-2xs text-gray-600">
            수신: {checklist.customerEmail?.trim() || '— (이메일 없음)'}
          </span>
        )}
        {checklist.status === 'COMPLETED' && (
          <>
            <button
              type="button"
              onClick={downloadPdf}
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-fluid-2xs hover:bg-gray-50"
            >
              PDF 다운로드
            </button>
            <button
              type="button"
              onClick={downloadAllPhotos}
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-fluid-2xs hover:bg-gray-50"
            >
              사진 ZIP
            </button>
            {checklist.customerViewToken ? (
              <button
                type="button"
                onClick={() => {
                  const url = getInspectionCustomerViewUrl(
                    checklist.customerViewToken!,
                    undefined,
                    staffTenantSlug || null,
                  );
                  void copyTextToClipboard(url).then((ok) => {
                    setCopyHint(ok ? '복사됨' : '복사 실패');
                    window.setTimeout(() => setCopyHint(null), 2000);
                  });
                }}
                className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-fluid-2xs text-indigo-900 hover:bg-indigo-100"
              >
                {copyHint ?? '고객 열람 링크 복사'}
              </button>
            ) : null}
            {isAdmin && smtpConfigured && (
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const dto = await resendAdminInspectionEmail(token, inquiryId);
                    setChecklist(dto);
                    alert('이메일을 재발송했습니다.');
                  } catch (e) {
                    alert(e instanceof Error ? e.message : '재발송 실패');
                  } finally {
                    setBusy(false);
                  }
                }}
                className="rounded-lg border border-blue-600 bg-blue-50 px-2.5 py-1 text-fluid-2xs text-blue-900 hover:bg-blue-100 disabled:opacity-50"
              >
                이메일 재발송
              </button>
            )}
          </>
        )}
      </div>

      <ContaminationPhotosSection
        checklist={checklist}
        inquiryId={inquiryId}
        token={token}
        readOnly
        onChecklistUpdate={setChecklist}
      />

      <details className="group rounded-lg border border-gray-200 bg-white">
        <summary className="cursor-pointer list-none px-3 py-2 text-fluid-xs font-medium text-gray-800 select-none [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="text-gray-400 transition-transform group-open:rotate-90"
            >
              ▸
            </span>
            검수 상세 내용 보기
          </span>
        </summary>
        <div className="space-y-5 border-t border-gray-100 p-3 pt-4">
          <InspectionHeaderBlock checklist={checklist} />

          <InspectionBasicSection checklist={checklist} readOnly onPatch={() => {}} />

          <section className="space-y-2">
            <h3 className="text-fluid-sm font-semibold text-gray-900">구역별 세부 항목 사진</h3>
            {checklist.areas.filter((a) => !isContaminationInspectionArea(a.areaKey)).map((area) => (
              <InspectionAreaSection
                key={area.id}
                area={area}
                readOnly
                busy={false}
                photoMode="both"
                enablePhotoLightbox
                onComparePhotoOpen={openCompare}
                defaultOpen={false}
                onToggleItemNa={() => {}}
                onUpload={() => {}}
                onDeletePhoto={() => {}}
              />
            ))}
          </section>

          {checklist.leaderNotes?.trim() && (
            <section>
              <h3 className="text-fluid-sm font-semibold text-gray-900 mb-1">특이사항</h3>
              <p className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-3 text-fluid-xs">
                {checklist.leaderNotes}
              </p>
            </section>
          )}

          <InspectionConsentSection
            checklist={checklist}
            readOnly
            consentItemsDefaultOpen={false}
            onConsentChange={() => {}}
            onEmailChange={() => {}}
          />

          {checklist.signature?.secureUrl && (
            <section>
              <h3 className="text-fluid-sm font-semibold text-gray-900 mb-2">고객 서명</h3>
              <img
                src={checklist.signature.secureUrl}
                alt="고객 서명"
                className="max-h-36 rounded-lg border bg-white"
              />
            </section>
          )}

          {checklist.status === 'VOID' && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-fluid-xs text-rose-900">
              무효 처리: {checklist.voidedBy?.name ?? '—'} ·{' '}
              {checklist.voidedAt
                ? new Date(checklist.voidedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
                : '—'}
              <p className="mt-1 whitespace-pre-wrap">{checklist.voidReason}</p>
            </div>
          )}

          {isAdmin && checklist.status === 'COMPLETED' && (
            <details className="rounded-lg border border-amber-200 bg-amber-50/50">
              <summary className="cursor-pointer px-3 py-2 text-fluid-xs font-medium text-amber-950">
                관리자 — 검수본 무효(VOID)
              </summary>
              <div className="space-y-2 border-t border-amber-100 px-3 py-3">
                <textarea
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  rows={2}
                  placeholder="무효 사유 (필수)"
                  className="w-full rounded border border-gray-300 px-2 py-1 text-fluid-xs"
                />
                <input
                  type="password"
                  value={voidPassword}
                  onChange={(e) => setVoidPassword(e.target.value)}
                  placeholder="관리자 비밀번호"
                  className="w-full rounded border border-gray-300 px-2 py-1 text-fluid-xs"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const dto = await voidAdminInspectionChecklist(token, inquiryId, voidPassword, voidReason);
                      setChecklist(dto);
                      setVoidPassword('');
                      setVoidReason('');
                    } catch (e) {
                      alert(e instanceof Error ? e.message : '무효 처리 실패');
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="rounded-lg border border-rose-700 bg-white px-3 py-1.5 text-fluid-xs text-rose-900"
                >
                  무효 처리
                </button>
              </div>
            </details>
          )}
        </div>
      </details>

      {compareLightbox}
    </div>
  );
}
