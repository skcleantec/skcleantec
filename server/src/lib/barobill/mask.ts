/** 사업자번호는 123-45-***** */
export function maskCorpNum(raw: string | null | undefined): string {
  const head = String(raw ?? '').replace(/\D/g, '').slice(0, 5);
  if (head.length < 5) return '***-**-*****';
  return `${head.slice(0, 3)}-${head.slice(3, 5)}-*****`;
}

/** 휴대폰은 010-****-1234 */
export function maskPhone(raw: string | null | undefined): string {
  const tail = String(raw ?? '').replace(/\D/g, '').slice(-4);
  if (tail.length < 4) return '010-****-****';
  return `010-****-${tail}`;
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
