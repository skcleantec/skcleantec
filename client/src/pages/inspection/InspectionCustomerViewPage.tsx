import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { fetchPublicInspection } from '../../api/inspectionPublic';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import {
  InspectionAreaSection,
  InspectionBasicSection,
  InspectionConsentSection,
  InspectionHeaderBlock,
} from '../../components/inquiry-inspection/inspectionUiBlocks';
import type { InspectionChecklistDto } from '../../api/inquiryInspection';
import { formatDateCompactWithWeekday } from '../../utils/dateFormat';

function PageShell({
  brandName,
  customerName,
  children,
}: {
  brandName: string;
  customerName?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    const prevBody = document.body.style.backgroundColor;
    const prevHtml = document.documentElement.style.backgroundColor;
    document.body.style.backgroundColor = '#f1f5f9';
    document.documentElement.style.backgroundColor = '#f1f5f9';
    return () => {
      document.body.style.backgroundColor = prevBody;
      document.documentElement.style.backgroundColor = prevHtml;
    };
  }, []);

  return (
    <div className="flex min-h-dvh flex-1 flex-col w-full bg-slate-100">
      <header className="bg-slate-900 text-white shrink-0">
        <div className="max-w-lg mx-auto px-4 py-4 sm:py-5">
          <p className="text-fluid-xs text-slate-400 uppercase tracking-wider">Inspection Report</p>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{brandName}</h1>
          <p className="text-fluid-sm text-slate-300 mt-1 leading-snug">
            {customerName ? (
              <>
                <span className="text-white font-medium">{customerName}</span>님 현장 검수 완료본입니다.
              </>
            ) : (
              '청소 서비스 현장 검수 체크리스트 완료본입니다.'
            )}
          </p>
        </div>
      </header>
      <main className="flex-1 w-full max-w-lg mx-auto px-4 py-6 sm:py-8 pb-10 min-w-0 bg-slate-100">
        {children}
      </main>
    </div>
  );
}

function ReadOnlyChecklistBody({ checklist }: { checklist: InspectionChecklistDto }) {
  return (
    <div className="space-y-4">
      <InspectionHeaderBlock checklist={checklist} />
      <InspectionBasicSection checklist={checklist} readOnly onPatch={() => {}} />
      <div className="space-y-3">
        <p className="text-fluid-sm font-semibold text-slate-900">구역별 세부 검수</p>
        {checklist.areas.map((area) => (
          <InspectionAreaSection
            key={area.id}
            area={area}
            readOnly
            busy={false}
            photoMode="both"
            defaultOpen={false}
            onToggleItemNa={() => {}}
            onUpload={() => {}}
            onDeletePhoto={() => {}}
          />
        ))}
      </div>
      {checklist.leaderNotes?.trim() ? (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-fluid-xs font-semibold text-slate-600 mb-1">특이사항</p>
          <p className="text-fluid-sm text-slate-800 whitespace-pre-wrap">{checklist.leaderNotes.trim()}</p>
        </div>
      ) : null}
      <InspectionConsentSection
        checklist={checklist}
        readOnly
        onConsentChange={() => {}}
        onEmailChange={() => {}}
      />
      {checklist.signature?.secureUrl ? (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-fluid-xs font-semibold text-slate-600 mb-2">고객 서명</p>
          <img src={checklist.signature.secureUrl} alt="고객 서명" className="max-h-24 object-contain" />
        </div>
      ) : null}
      {checklist.completionPdf?.secureUrl ? (
        <a
          href={checklist.completionPdf.secureUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[48px] items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-fluid-sm font-semibold text-white hover:bg-slate-800 touch-manipulation"
        >
          PDF 다운로드
        </a>
      ) : null}
    </div>
  );
}

export function InspectionCustomerViewPage() {
  const { token = '' } = useParams<{ token: string }>();
  const [brandName, setBrandName] = useState('현장 검수');
  const [checklist, setChecklist] = useState<InspectionChecklistDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useDocumentTitle(brandName);

  useEffect(() => {
    if (!token) {
      setError('유효하지 않은 링크입니다.');
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchPublicInspection(token)
      .then((res) => {
        setBrandName(res.brandName);
        setChecklist(res.checklist);
        setError(null);
      })
      .catch((e) => {
        setChecklist(null);
        setError(e instanceof Error ? e.message : '불러오기 실패');
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <PageShell brandName={brandName}>
        <p className="text-fluid-sm text-slate-600 text-center py-12">불러오는 중…</p>
      </PageShell>
    );
  }

  if (error || !checklist) {
    return (
      <PageShell brandName={brandName}>
        <div className="rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <p className="text-fluid-sm text-rose-800">{error ?? '검수본을 찾을 수 없습니다.'}</p>
        </div>
      </PageShell>
    );
  }

  const customerName = checklist.inquiryHeader?.customerName;
  const completedLabel = checklist.completedAt
    ? formatDateCompactWithWeekday(checklist.completedAt)
    : null;

  return (
    <PageShell brandName={brandName} customerName={customerName}>
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xl shadow-slate-300/30 space-y-4">
        {completedLabel ? (
          <p className="text-fluid-xs text-slate-500 text-center tabular-nums">완료일 {completedLabel}</p>
        ) : null}
        <ReadOnlyChecklistBody checklist={checklist} />
      </div>
    </PageShell>
  );
}
