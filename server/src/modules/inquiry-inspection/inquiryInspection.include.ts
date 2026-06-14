export const inspectionChecklistInclude = {
  teamLeader: { select: { id: true, name: true } },
  voidedBy: { select: { id: true, name: true } },
  areas: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      items: {
        orderBy: { sortOrder: 'asc' as const },
        include: {
          photos: {
            orderBy: { createdAt: 'asc' as const },
            include: { uploadedBy: { select: { id: true, name: true } } },
          },
        },
      },
    },
  },
} as const;
