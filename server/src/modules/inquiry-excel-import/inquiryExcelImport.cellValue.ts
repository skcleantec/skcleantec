import type * as XLSX from 'xlsx';

/** BOM·앞뒤 공백·연속 공백 정리 — 헤더·매핑 키 일치용 */
export function normalizeExcelHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/\s+/g, ' ');
}

const PHONE_LIKE_HEADER =
  /^(고객)?연락처(\d)?$|휴대(폰|전화)?|전화(번호)?|cell|mobile|phone/i;

export function isPhoneLikeExcelHeader(header: string): boolean {
  return PHONE_LIKE_HEADER.test(normalizeExcelHeader(header));
}

/** 숫자 셀·표시 서식(w)까지 반영해 문자열로 변환 */
export function excelCellToString(cell: XLSX.CellObject | undefined, fallback: unknown): string {
  if (cell?.t === 'b') return cell.v ? 'TRUE' : 'FALSE';

  const formatted = cell?.w != null ? String(cell.w).trim() : '';
  if (formatted) {
    const t = cell?.t as string | undefined;
    if (t === 's' || t === 'str' || t === 'inlineStr') return formatted;
    if (t === 'n') {
      if (/^[\d\s+\-().]+$/.test(formatted)) return formatted.replace(/\s/g, '');
      return formatted;
    }
  }

  if (cell?.t === 'n' && typeof cell.v === 'number' && Number.isFinite(cell.v)) {
    const n = cell.v;
    if (Math.abs(n) >= 1e8 && Math.abs(n) < 1e12) {
      return String(Math.trunc(n));
    }
    if (Number.isInteger(n)) return String(n);
    return String(n);
  }

  if (cell?.v == null) return fallbackToString(fallback);
  if (cell.v instanceof Date) return formatDateYmd(cell.v);
  return String(cell.v).trim();
}

function fallbackToString(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return formatDateYmd(v);
  return String(v).trim();
}

function formatDateYmd(v: Date): string {
  const y = v.getFullYear();
  const m = String(v.getMonth() + 1).padStart(2, '0');
  const d = String(v.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 엑셀 연락처 — 숫자·하이픈·텍스트 혼합 */
export function normalizePhoneFromExcel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return trimmed;

  if (digits.length === 10 && digits.startsWith('10')) return `0${digits}`;
  if (digits.length === 11 && digits.startsWith('010')) return digits;
  if (digits.length === 12 && digits.startsWith('8210')) return `0${digits.slice(2)}`;
  if (digits.length >= 9 && digits.length <= 15) return digits;

  return trimmed;
}

/** 연락처 매핑 오류 시 — 파일에 있는 유사 열 안내 */
export function phoneColumnMappingHint(
  excelRow: Record<string, string>,
  mappedHeader: string | undefined,
): string {
  const candidates = Object.entries(excelRow)
    .filter(([k, v]) => isPhoneLikeExcelHeader(k) && v.trim())
    .map(([k]) => k);

  if (candidates.length === 0) return '';
  if (mappedHeader && candidates.some((c) => normalizeExcelHeader(c) === normalizeExcelHeader(mappedHeader))) {
    return '';
  }

  return ` 파일의 연락처 열: ${candidates.join(', ')} — 매칭 서식에서 SK 「연락처」를 해당 열에 연결하세요.`;
}
