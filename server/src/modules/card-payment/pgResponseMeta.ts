import type { Prisma } from '@prisma/client';

const URL_HINT = ['receipt', 'bill', 'slip', 'voucher', 'url'] as const;

export type PgCapture = {
  meta: Prisma.InputJsonValue;
  pgTid: string | null;
  pgReceiptUrl: string | null;
};

function dropKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[_\-\s]/g, '');
  if (k.includes('cardno') || k.includes('cardnum') || k === 'pan' || k.includes('cvc') || k.includes('cvv')) return true;
  if (k === 'exp' || k.includes('expire') || k.includes('expiry') || k.includes('yymm') || k.includes('validth')) return true;
  if (k.includes('birth')) return true;
  if (k.includes('password') || k.includes('passwd') || k === 'pwd' || k === 'pin') return true;
  if (k === 'cert' || k.includes('certno') || k.includes('certpw') || k.includes('certnum')) return true;
  return false;
}

function isTid(key: string): boolean {
  const k = key.toLowerCase().replace(/[_\-\s]/g, '');
  return k === 'tid' || k === 'pgtid';
}

function urlRank(key: string): number {
  const k = key.toLowerCase();
  if (k.includes('receipt')) return 0;
  if (k.includes('bill')) return 1;
  if (k.includes('slip')) return 2;
  if (k.includes('voucher')) return 3;
  return 4;
}

function scrub(value: string): string {
  return value.replace(/\d{13,19}/g, '****').slice(0, 500);
}

/** 승인 응답에서 카드번호·유효기간·생년월일·비밀번호를 빼고, 영수증 주소와 tid만 고른다. */
export function capturePgResponse(input: unknown): PgCapture {
  let pgTid: string | null = null;
  const found: { rank: number; url: string }[] = [];

  function walk(node: unknown): unknown {
    if (Array.isArray(node)) {
      return node.map((item) => walk(item)).filter((item) => item !== undefined);
    }
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        if (dropKey(key)) continue;
        if (isTid(key) && (typeof value === 'string' || typeof value === 'number')) {
          const tid = String(value).trim().slice(0, 40);
          if (tid && !pgTid) pgTid = tid;
        }
        if (typeof value === 'string') {
          const text = value.trim();
          const keyLower = key.toLowerCase();
          if (URL_HINT.some((hint) => keyLower.includes(hint)) && /^https?:\/\//i.test(text)) {
            found.push({ rank: urlRank(key), url: text.slice(0, 500) });
          }
        }
        const next = walk(value);
        if (next !== undefined) out[key] = next;
      }
      return out;
    }
    if (typeof node === 'string') return scrub(node);
    if (typeof node === 'number' || typeof node === 'boolean' || node === null) return node;
    return undefined;
  }

  const meta = walk(input);
  const stored = meta && typeof meta === 'object' ? meta : {};
  const receipt = found.reduce<{ rank: number; url: string } | null>(
    (picked, item) => (!picked || item.rank < picked.rank ? item : picked),
    null,
  );
  return {
    meta: stored as Prisma.InputJsonValue,
    pgTid,
    pgReceiptUrl: receipt?.url ?? null,
  };
}
