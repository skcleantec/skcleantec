import { useState, type ReactNode } from 'react';
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
}: {
  title: string;
  children: ReactNode;
  /** 스크롤 점프용 앵커 — `data-inq-edit-section` + id 부여 */
  sectionAnchor?: string;
  /** true면 summary로 접기·펼치기 (기본 defaultOpen) */
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const sectionNo = getInquiryEditSectionNumber(sectionAnchor);
  const displayTitle = sectionNo != null ? `${sectionNo}. ${title}` : title;
  const [open, setOpen] = useState(defaultOpen);

  if (!collapsible) {
    return (
      <section
        className={inqEditSectionShell}
        id={sectionAnchor ? `inq-edit-sec-${sectionAnchor}` : undefined}
        data-inq-edit-section={sectionAnchor ? '' : undefined}
      >
        <h3 className={inqEditSectionHeader}>{displayTitle}</h3>
        <div className={inqEditSectionBody}>{children}</div>
      </section>
    );
  }

  return (
    <section
      className={inqEditSectionShell}
      id={sectionAnchor ? `inq-edit-sec-${sectionAnchor}` : undefined}
      data-inq-edit-section={sectionAnchor ? '' : undefined}
    >
      <details
        open={open}
        onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
        className="group [&_summary::-webkit-details-marker]:hidden"
      >
        <summary className={`cursor-pointer list-none touch-manipulation ${inqEditSectionHeader}`}>
          <span className="flex items-center justify-between gap-2">
            <span>{displayTitle}</span>
            <span className="shrink-0 text-[10px] font-normal text-gray-400" aria-hidden>
              {open ? '접기 ▲' : '펼치기 ▼'}
            </span>
          </span>
        </summary>
        <div className={inqEditSectionBody}>{children}</div>
      </details>
    </section>
  );
}
