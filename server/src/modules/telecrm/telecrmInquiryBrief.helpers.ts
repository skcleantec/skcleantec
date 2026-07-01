type TemplateField = { fieldKey: string; label: string };
type OrderFormSlice = {
  submittedAt: Date | null;
  totalAmount: number;
  depositAmount: number;
  balanceAmount: number;
  customerSpecialNotes: string | null;
  optionNote: string | null;
  customerAnswers: unknown;
  template: { id: string; title: string; icon: string | null; fields: TemplateField[] } | null;
} | null;

function renderAnswerValue(v: unknown): string {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map((x) => String(x)).join(', ');
  if (typeof v === 'boolean') return v ? '예' : '아니오';
  return String(v);
}

export function formatTelecrmOrderFormBrief(orderForm: OrderFormSlice) {
  if (!orderForm) return null;
  const labelByKey = new Map((orderForm.template?.fields ?? []).map((f) => [f.fieldKey, f.label]));
  const answersRaw =
    orderForm.customerAnswers && typeof orderForm.customerAnswers === 'object'
      ? (orderForm.customerAnswers as Record<string, unknown>)
      : {};
  const customAnswers = Object.entries(answersRaw)
    .filter(([, v]) => renderAnswerValue(v).trim() !== '')
    .map(([k, v]) => ({
      key: k,
      label: labelByKey.get(k) ?? k,
      value: renderAnswerValue(v),
    }));

  return {
    submittedAt: orderForm.submittedAt?.toISOString() ?? null,
    totalAmount: orderForm.totalAmount,
    depositAmount: orderForm.depositAmount,
    balanceAmount: orderForm.balanceAmount,
    customerSpecialNotes: orderForm.customerSpecialNotes?.trim() || null,
    optionNote: orderForm.optionNote?.trim() || null,
    customAnswers,
  };
}

export const telecrmInquiryBriefSelect = {
  id: true,
  status: true,
  createdAt: true,
  customerName: true,
  nickname: true,
  customerPhone: true,
  customerPhone2: true,
  memo: true,
  specialNotes: true,
  claimMemo: true,
  address: true,
  areaPyeong: true,
  preferredDate: true,
  preferredTime: true,
  orderForm: {
    select: {
      submittedAt: true,
      totalAmount: true,
      depositAmount: true,
      balanceAmount: true,
      customerSpecialNotes: true,
      optionNote: true,
      customerAnswers: true,
      template: {
        select: {
          id: true,
          title: true,
          icon: true,
          fields: {
            where: { systemField: null },
            orderBy: { sortOrder: 'asc' as const },
            select: { fieldKey: true, label: true },
          },
        },
      },
    },
  },
} as const;

export function serializeTelecrmInquiryBrief(row: {
  id: string;
  status: string;
  createdAt: Date;
  customerName: string;
  nickname: string | null;
  customerPhone: string;
  memo: string | null;
  specialNotes: string | null;
  claimMemo: string | null;
  address: string;
  areaPyeong: number | null;
  preferredDate: Date | null;
  preferredTime: string | null;
  orderForm: Parameters<typeof formatTelecrmOrderFormBrief>[0];
}) {
  return {
    id: row.id,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    customerName: row.customerName,
    nickname: row.nickname,
    customerPhone: row.customerPhone,
    memo: row.memo,
    specialNotes: row.specialNotes,
    claimMemo: row.claimMemo,
    address: row.address,
    areaPyeong: row.areaPyeong,
    preferredDate: row.preferredDate?.toISOString() ?? null,
    preferredTime: row.preferredTime,
    orderFormTemplate: row.orderForm?.template
      ? {
          id: row.orderForm.template.id,
          title: row.orderForm.template.title,
          icon: row.orderForm.template.icon,
          fields: row.orderForm.template.fields,
        }
      : null,
    orderForm: formatTelecrmOrderFormBrief(row.orderForm),
  };
}
