/** 사업자번호 뒤 5자리 마스킹 */
export function maskCorpNum(raw: string | null | undefined): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length <= 5) return '*****';
  return `${digits.slice(0, digits.length - 5)}*****`;
}

/** 휴대폰은 끝 4자리만 */
export function maskPhone(raw: string | null | undefined): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `***${digits.slice(-4)}`;
}

export function normalizeCorpNum(raw: string | null | undefined): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length !== 10) return null;
  return digits;
}

export function redactSecrets(text: string, extra: readonly string[] = []): string {
  let out = text;
  const key = (process.env.BAROBILL_CERTKEY ?? '').trim();
  const secrets = [key, ...extra].filter((s) => s.length >= 4);
  for (const secret of secrets) {
    if (out.includes(secret)) out = out.split(secret).join('[hidden]');
  }
  return out;
}
