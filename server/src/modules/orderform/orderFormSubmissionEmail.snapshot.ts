/** 고객 제출 스냅샷(v1) → 확인 메일 본문 행 */

export type OrderFormSubmissionSnapshotV1 = {
  version: 1;
  capturedAt: string;
  template?: { id: string; title: string; icon: string | null; version: number | null } | null;
  templateAnswers?: Array<{ fieldKey: string; label: string; value: unknown }>;
  fields: {
    customerName: string;
    address: string;
    addressDetail: string | null;
    customerPhone: string;
    customerPhone2: string;
    customerEmail?: string;
    areaPyeong: number | null;
    areaBasis: string;
    exclusiveAreaSqm?: number | null;
    propertyType: string;
    preferredDate: string;
    preferredTime: string;
    preferredTimeDetail: string | null;
    roomCount: number | null;
    bathroomCount: number | null;
    balconyCount: number | null;
    kitchenCount: number | null;
    buildingType: string | null;
    moveInDate: string | null;
    moveInDateUndecided?: boolean;
    specialNotes: string | null;
    professionalOptionLabels: string[];
  };
  issuedSummary: {
    totalAmount: number;
    depositAmount: number;
    balanceAmount: number;
    optionNote: string | null;
    /** 추가 시공 옵션 합계(원) — totalAmount 에 더한 값 */
    profOptionsExtraSum?: number;
    /** 서비스 견적 + 추가 시공 */
    grandTotalAmount?: number;
    /** 추가 옵션 안내 줄(라벨·단가·금액) */
    profOptionGuideLines?: string[];
  };
};

export type EmailDetailRow = { label: string; value: string };

/** 이메일·영수증 좌측 라벨 — 줄바꿈으로 값 열 폭 확보 */
export const PROFESSIONAL_OPTIONS_EMAIL_LABEL =
  '전문 시공 유료옵션\n(체크시 시공가능 팀장배정)';

const CUSTOMER_PROF_OPTION_CONTACT_MESSAGE = '상담사가 연락드리겠습니다.';

const TIME_SLOT_LABELS: Record<string, string> = {
  오전: '오전',
  오후: '오후',
  사이청소: '사이청소',
};

function isSnapshotV1(x: unknown): x is OrderFormSubmissionSnapshotV1 {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    o.version === 1 &&
    typeof o.fields === 'object' &&
    o.fields !== null &&
    typeof o.issuedSummary === 'object' &&
    o.issuedSummary !== null
  );
}

function formatYmdWithWeekday(ymd: string): string {
  const t = ymd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const d = new Date(`${t}T12:00:00+09:00`);
  if (Number.isNaN(d.getTime())) return t;
  return d.toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    weekday: 'short',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatWon(n: number): string {
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

function dashIfEmpty(v: string | null | undefined): string {
  const t = v?.trim() ?? '';
  return t || '—';
}

function renderAnswerValue(v: unknown): string {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map((x) => String(x)).join(', ');
  if (typeof v === 'boolean') return v ? '예' : '아니오';
  return String(v).trim();
}

function areaSupplyText(f: OrderFormSubmissionSnapshotV1['fields']): string {
  if (f.areaBasis === '공급' && f.areaPyeong != null && Number.isFinite(f.areaPyeong)) {
    return `${f.areaPyeong}평`;
  }
  if (
    f.areaBasis !== '공급' &&
    f.areaBasis !== '전용' &&
    f.areaPyeong != null &&
    Number.isFinite(f.areaPyeong)
  ) {
    return `${f.areaPyeong}평 (레거시)`;
  }
  return '—';
}

function areaExclusiveText(f: OrderFormSubmissionSnapshotV1['fields']): string {
  if (f.areaBasis === '전용' && f.areaPyeong != null && Number.isFinite(f.areaPyeong)) {
    return `${f.areaPyeong}평`;
  }
  if (
    f.areaBasis === '전용' &&
    f.exclusiveAreaSqm != null &&
    Number.isFinite(f.exclusiveAreaSqm)
  ) {
    return `${Number(f.exclusiveAreaSqm).toLocaleString('ko-KR')}㎡ (과거 제출)`;
  }
  if (f.areaBasis === '전용') return '입력 없음';
  return '—';
}

function moveInText(f: OrderFormSubmissionSnapshotV1['fields']): string {
  if (f.moveInDateUndecided) return '미정';
  if (f.moveInDate?.trim()) return formatYmdWithWeekday(f.moveInDate);
  return '—';
}

/** 마케터 추가사항(optionNote) · 확정된 추가 시공 단가 안내 */
export function buildIssuedSummaryOptionGuideText(
  optionNote: string | null | undefined,
  professionalOptionLabels: string[],
  profOptionGuideLines?: string[],
  profOptionsExtraSum?: number,
): string {
  if (profOptionGuideLines && profOptionGuideLines.length > 0) {
    const body = profOptionGuideLines.map((l) => `· ${l}`).join('\n');
    const sum = profOptionsExtraSum ?? 0;
    if (sum > 0) {
      return `${body}\n추가 시공 합계 ${formatWon(sum)}`;
    }
    return body;
  }
  const note = optionNote?.trim() ?? '';
  if (note) return note;
  if ((professionalOptionLabels ?? []).length > 0) return CUSTOMER_PROF_OPTION_CONTACT_MESSAGE;
  return '—';
}

export function buildEmailDetailSections(
  snapshot: unknown,
  inquiryNumber: string | null,
): { title: string; rows: EmailDetailRow[] }[] {
  if (!isSnapshotV1(snapshot)) return [];

  const f = snapshot.fields;
  const issued = snapshot.issuedSummary;
  const sections: { title: string; rows: EmailDetailRow[] }[] = [];

  if (snapshot.template?.title) {
    const tplTitle = `${snapshot.template.icon ? `${snapshot.template.icon} ` : ''}${snapshot.template.title}`.trim();
    sections.push({ title: '발주서 양식', rows: [{ label: '양식명', value: tplTitle }] });
  }

  const tplAnswers = (snapshot.templateAnswers ?? []).filter(
    (a) => a && renderAnswerValue(a.value).trim() !== '',
  );
  if (tplAnswers.length > 0) {
    sections.push({
      title: '추가 정보',
      rows: tplAnswers.map((a) => ({ label: a.label, value: renderAnswerValue(a.value) })),
    });
  }

  const profLabels = f.professionalOptionLabels ?? [];
  const profValue =
    profLabels.length > 0 ? profLabels.map((t) => `· ${t}`).join('\n') : '선택 없음';

  sections.push({
    title: '입력 내용',
    rows: [
      ...(inquiryNumber ? [{ label: '접수번호', value: inquiryNumber }] : []),
      { label: '성함', value: f.customerName },
      { label: '연락처', value: f.customerPhone },
      { label: '보조 연락처', value: dashIfEmpty(f.customerPhone2) },
      { label: '이메일', value: dashIfEmpty(f.customerEmail) },
      { label: '주소', value: f.address },
      { label: '상세주소', value: dashIfEmpty(f.addressDetail) },
      { label: '건축물 유형', value: f.propertyType },
      { label: '공급면적 (분양평수)', value: areaSupplyText(f) },
      { label: '전용면적 (실제 내 집 공간)', value: areaExclusiveText(f) },
      { label: '방', value: f.roomCount != null ? String(f.roomCount) : '—' },
      { label: '발코니', value: f.balconyCount != null ? String(f.balconyCount) : '—' },
      { label: '화장실', value: f.bathroomCount != null ? String(f.bathroomCount) : '—' },
      { label: '주방', value: f.kitchenCount != null ? String(f.kitchenCount) : '—' },
      { label: '건축 형태', value: dashIfEmpty(f.buildingType) },
      { label: '입주일', value: moveInText(f) },
      { label: '청소 희망일', value: formatYmdWithWeekday(f.preferredDate) },
      { label: '시간대', value: TIME_SLOT_LABELS[f.preferredTime] ?? f.preferredTime },
      { label: '구체적 시각', value: dashIfEmpty(f.preferredTimeDetail) },
      { label: '특이사항', value: dashIfEmpty(f.specialNotes) },
      { label: PROFESSIONAL_OPTIONS_EMAIL_LABEL, value: profValue },
    ],
  });

  sections.push({
    title: '금액 안내',
    rows: [
      { label: '기본 서비스 견적', value: formatWon(issued.totalAmount) },
      ...(issued.profOptionsExtraSum != null && issued.profOptionsExtraSum > 0
        ? [{ label: '추가 시공 합계', value: formatWon(issued.profOptionsExtraSum) }]
        : []),
      ...(issued.grandTotalAmount != null &&
      issued.profOptionsExtraSum != null &&
      issued.profOptionsExtraSum > 0
        ? [{ label: '총 예상 금액', value: formatWon(issued.grandTotalAmount) }]
        : []),
      { label: '예약금', value: formatWon(issued.depositAmount) },
      { label: '잔금', value: formatWon(issued.balanceAmount) },
      {
        label: '추가 옵션 안내',
        value: buildIssuedSummaryOptionGuideText(
          issued.optionNote,
          profLabels,
          issued.profOptionGuideLines,
          issued.profOptionsExtraSum,
        ),
      },
    ],
  });

  return sections;
}
