import { prisma } from '../../lib/prisma.js';
import { classifyAiQuote } from './telecrmAiQuoteClassify.js';
import { matchBaseRow } from './telecrmAiQuoteBase.js';
import { pickSentBaseCleaningWon } from './telecrmAiQuoteBaseLine.js';
import { listTelecrmAiQuoteBaseRows } from './telecrmAiQuoteBase.store.js';
import { invalidateTelecrmAiQuoteModel, predictTelecrmAiQuote } from './telecrmAiQuoteModel.service.js';
import { loadTelecrmPropertyChoiceResolver } from './telecrmPropertyChoices.service.js';

export type TelecrmSentQuoteStructure = {
  propertyType?: string | null;
  isOneRoom?: boolean;
  roomCount?: number | null;
  bathroomCount?: number | null;
  balconyCount?: number | null;
};

function propertyLabel(
  labelOf: (kind: 'property', raw: string | null | undefined) => string,
  raw: string | null | undefined,
): string | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const label = labelOf('property', text) || (/^opt[_-]?\d+$/i.test(text) ? '' : text);
  return label || null;
}

/** 견적보내기(SENT) 직후. 기본청소 금액을 못 찾으면 남기지 않는다. 이름·전화번호는 저장하지 않는다. */
export async function recordTelecrmAiQuoteCorrection(args: {
  tenantId: string;
  operatingCompanyId: string;
  quoteId: string;
  userId: string;
  payload: unknown;
  structure?: TelecrmSentQuoteStructure | null;
}): Promise<void> {
  const sentBaseAmountWon = pickSentBaseCleaningWon(args.payload);
  if (sentBaseAmountWon == null) return;
  const payloadPyeong =
    args.payload && typeof args.payload === 'object' ? Number((args.payload as { pyeong?: unknown }).pyeong) : NaN;
  const resolver = await loadTelecrmPropertyChoiceResolver(args.tenantId);
  const label = propertyLabel(resolver.labelOf, args.structure?.propertyType);
  const classified = classifyAiQuote({
    propertyTypeLabel: label,
    isOneRoom: args.structure?.isOneRoom,
    roomCount: args.structure?.roomCount,
    bathroomCount: args.structure?.bathroomCount,
    balconyCount: args.structure?.balconyCount,
    areaPyeong: Number.isFinite(payloadPyeong) ? payloadPyeong : null,
  });
  if (classified.pyeong < 1) return;

  const predicted = await predictTelecrmAiQuote(args.tenantId, {
    operatingCompanyId: args.operatingCompanyId,
    areaPyeong: classified.pyeong,
    propertyType: args.structure?.propertyType ?? null,
    isOneRoom: args.structure?.isOneRoom,
    roomCount: args.structure?.roomCount,
    bathroomCount: args.structure?.bathroomCount,
    balconyCount: args.structure?.balconyCount,
  });
  const baseRows = await listTelecrmAiQuoteBaseRows(args.tenantId);
  const hit = matchBaseRow(baseRows, classified);

  await prisma.telecrmAiQuoteCorrection.create({
    data: {
      tenantId: args.tenantId,
      operatingCompanyId: args.operatingCompanyId,
      quoteId: args.quoteId,
      userId: args.userId,
      typeGroup: classified.typeGroup,
      isOneRoomLike: classified.isOneRoomLike,
      rooms: classified.rooms,
      baths: classified.baths,
      balconies: classified.balconies,
      pyeong: classified.pyeong,
      aiAmountWon: predicted?.amountWon ?? 0,
      sentBaseAmountWon,
      baseRowId: hit?.id ?? null,
    },
  });
  invalidateTelecrmAiQuoteModel(args.tenantId);
}
