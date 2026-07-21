/** 접수 수정 6번 — 배정 관련 안내를 chip 한 줄로 압축 */
export type InquiryEditAssignmentHint = {
  id: string;
  label: string;
  detail?: string;
  tone: 'amber' | 'violet' | 'teal' | 'indigo';
};

const TONE_CLASS: Record<InquiryEditAssignmentHint['tone'], string> = {
  amber: 'border-amber-200 bg-amber-50 text-amber-950',
  violet: 'border-violet-200 bg-violet-50 text-violet-950',
  teal: 'border-teal-200 bg-teal-50 text-teal-950',
  indigo: 'border-indigo-200 bg-indigo-50 text-indigo-950',
};

export function buildInquiryEditAssignmentHints(input: {
  teamLeaderBlocked: boolean;
  teamLeaderBlockedMessage?: string;
  pinnedServiceZoneId: string | null;
  pinnedServiceZoneName?: string | null;
  nearbyAssignmentViaPin: boolean;
  activeServiceZoneId: string | null;
  activeServiceZoneName?: string | null;
  strictAssignment: boolean;
}): InquiryEditAssignmentHint[] {
  const hints: InquiryEditAssignmentHint[] = [];

  if (input.teamLeaderBlocked && input.teamLeaderBlockedMessage) {
    hints.push({
      id: 'zone-block',
      label: '권역 배정 제한',
      detail: input.teamLeaderBlockedMessage,
      tone: 'amber',
    });
  }

  if (input.pinnedServiceZoneId && !input.activeServiceZoneId && !input.teamLeaderBlocked) {
    const zone = input.pinnedServiceZoneName ?? '지정 권역';
    hints.push({
      id: 'pin-zone',
      label: input.nearbyAssignmentViaPin ? `근접·수동: ${zone}` : `캘린더: ${zone}`,
      detail: input.nearbyAssignmentViaPin
        ? `주소 권역과 달리 「${zone}」 캘린더로 지정되어 해당 권역 팀장만 선택할 수 있습니다.`
        : `「${zone}」 권역 팀장만 배정할 수 있습니다.`,
      tone: 'violet',
    });
  }

  if (input.activeServiceZoneId && input.activeServiceZoneName) {
    hints.push({
      id: 'active-zone',
      label: `권역: ${input.activeServiceZoneName}`,
      detail: `${input.activeServiceZoneName} 캘린더 — 이 권역 담당 팀장만 배정할 수 있습니다.`,
      tone: 'teal',
    });
  }

  if (input.strictAssignment) {
    hints.push({
      id: 'strict',
      label: '엄격 배정',
      detail: '이 접수 영업 브랜드에 소속된 팀장만 선택할 수 있습니다.',
      tone: 'indigo',
    });
  }

  return hints;
}

export function InquiryEditStatusAssignmentHints({ hints }: { hints: InquiryEditAssignmentHint[] }) {
  if (hints.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {hints.map((h) => (
        <span
          key={h.id}
          title={h.detail}
          className={`inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-fluid-2xs font-medium leading-snug ${TONE_CLASS[h.tone]}`}
        >
          <span className="truncate">{h.label}</span>
        </span>
      ))}
    </div>
  );
}
