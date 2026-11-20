import type { TelecrmResponseCardCustomer, TelecrmResponseQuoteItem } from '../../../api/telecrmResponseCards';

function wonToMan(won: number): number | null {
  if (!Number.isFinite(won) || won <= 0) return null;
  const man = Math.round((won / 10000) * 10) / 10;
  return man > 0 && man <= 9999 ? man : null;
}

function structureLabel(input: {
  isOneRoom?: boolean;
  roomCount?: string;
  bathroomCount?: string;
  balconyCount?: string;
  buildingType?: string;
  propertyType?: string;
}): string | undefined {
  const parts: string[] = [];
  const rooms = input.roomCount?.trim() ?? '';
  if (input.isOneRoom || rooms === '1') parts.push('원룸');
  else if (rooms === '2') parts.push('투룸');
  else if (rooms) parts.push(`방${rooms}`);
  const baths = input.bathroomCount?.trim();
  const balconies = input.balconyCount?.trim();
  if (baths) parts.push(`화장실${baths}`);
  if (balconies) parts.push(`베란다${balconies}`);
  if (input.buildingType?.trim()) parts.push(input.buildingType.trim());
  if (input.propertyType?.trim()) parts.push(input.propertyType.trim());
  const text = parts.join(' ').slice(0, 80);
  return text || undefined;
}

/** 가격 안내 칸에 있는 값만 코치에 넘긴다. */
export function buildCrmCoachQuote(input: {
  isOneRoom?: boolean;
  roomCount?: string;
  bathroomCount?: string;
  balconyCount?: string;
  buildingType?: string;
  propertyType?: string;
  cleaningType?: string;
  grandTotalWon: number | null;
  lines: { label: string; amountWon: number | null }[];
}): Pick<TelecrmResponseCardCustomer, 'structure' | 'cleaningType' | 'quoteTotalManWon' | 'quoteItems'> {
  const structure = structureLabel(input);
  const cleaningType = input.cleaningType?.trim().slice(0, 40) || undefined;
  const quoteTotalManWon = input.grandTotalWon != null ? wonToMan(input.grandTotalWon) ?? undefined : undefined;
  const quoteItems: TelecrmResponseQuoteItem[] = [];
  for (const line of input.lines) {
    const label = line.label.trim().slice(0, 40);
    const manWon = line.amountWon != null ? wonToMan(line.amountWon) : null;
    if (!label || manWon == null) continue;
    quoteItems.push({ label, manWon });
    if (quoteItems.length >= 8) break;
  }
  return {
    ...(structure ? { structure } : {}),
    ...(cleaningType ? { cleaningType } : {}),
    ...(quoteTotalManWon ? { quoteTotalManWon } : {}),
    ...(quoteItems.length ? { quoteItems } : {}),
  };
}
