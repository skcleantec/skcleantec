import { useEffect, useRef, useState, type ReactNode } from 'react';
import { getInquiryEditSectionNumber } from '../../../constants/inquiryEditSectionOrder';
import {
  inqEditSectionBody,
  inqEditSectionHeader,
  inqEditSectionShell,
} from './inquiryEditFormClasses';

export function AdminScheduleDetailSection({
  title,
  children,
  sectionAnchor,
  collapsible = false,
  defaultOpen = true,
  resetKey,
}: {
  title: string;
  children: ReactNode;
  /** 스크롤 점프용 앵커 — `data-inq-edit-section` + id 부여 */
  sectionAnchor?: string;
  /** true면 summary로 접기·펼치기 (기본 defaultOpen) */
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** 바뀌면 사용자 토글을 초기화하고 defaultOpen으로 맞춤 (접수 전환 등) */
  resetKey?: string | number | null;
}) {
  const sectionNo = getInquiryEditSectionNumber(sectionAnchor);
  /** 번호 상자 + 제목 (UI 규칙 v2). 번호 없는 칸은 제목만 */
  const titleNode = (
    <span className="flex min-w-0 items-center gap-2">
      {sectionNo != null ? (
        <span className="inline-flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-md bg-slate-900 px-1 text-fluid-2xs font-bold tabular-nums text-white" aria-hidden>
          {sectionNo}
        </span>
      ) : null}
      <span className="min-w-0 truncate">
        {sectionNo != null ? <span className="sr-only">{sectionNo}. </span> : null}
        {title}
      </span>
    </span>
  );
  const [open, setOpen] = useState(defaultOpen);
  const userToggledRef = useRef(false);

  useEffect(() => {
    userToggledRef.current = false;
    setOpen(defaultOpen);
  }, [resetKey]);

  useEffect(() => {
    if (userToggledRef.current) return;
    setOpen(defaultOpen);
  }, [defaultOpen]);

  if (!collapsible) {
    return (
      <section
        className={inqEditSectionShell}
        id={sectionAnchor ? `inq-edit-sec-${sectionAnchor}` : undefined}
        data-inq-edit-section={sectionAnchor ? '' : undefined}
        data-inq-edit-title={sectionAnchor ? title : undefined}
      >
        <h3 className={inqEditSectionHeader}>{titleNode}</h3>
        <div className={inqEditSectionBody}>{children}</div>
      </section>
    );
  }

  return (
    <section
      className={inqEditSectionShell}
      id={sectionAnchor ? `inq-edit-sec-${sectionAnchor}` : undefined}
      data-inq-edit-section={sectionAnchor ? '' : undefined}
      data-inq-edit-title={sectionAnchor ? title : undefined}
    >
      <details
        open={open}
        onToggle={(e) => {
          userToggledRef.current = true;
          setOpen((e.target as HTMLDetailsElement).open);
        }}
        className="group [&_summary::-webkit-details-marker]:hidden"
      >
        <summary className={`cursor-pointer list-none touch-manipulation ${inqEditSectionHeader}`}>
          <span className="flex w-full min-w-0 items-center justify-between gap-2">
            {titleNode}
            <span className="shrink-0 text-fluid-2xs font-medium text-slate-500" aria-hidden>
              {open ? '접기 ▴' : '펼치기 ▾'}
            </span>
          </span>
        </summary>
        {open ? <div className={inqEditSectionBody}>{children}</div> : null}
      </details>
    </section>
  );
}
