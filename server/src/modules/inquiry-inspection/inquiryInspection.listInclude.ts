/** 목록·C/S용 경량 include — 진행률 계산에 필요한 최소 필드만 */
export const inspectionChecklistListInclude = {
  select: {
    id: true,
    status: true,
    completedAt: true,
    emailSentAt: true,
    completionPdfSecureUrl: true,
    areas: {
      select: {
        notApplicable: true,
        items: {
          select: {
            itemKey: true,
            notApplicable: true,
            naReason: true,
            photos: { select: { phase: true } },
          },
        },
      },
    },
  },
} as const;
