import * as XLSX from 'xlsx';
import { INQUIRY_EXCEL_IMPORT_MAX_ROWS } from '../../lib/inquiryExcelImportPolicy.js';
import { excelCellToString, normalizeExcelHeader } from './inquiryExcelImport.cellValue.js';

export type ParsedExcelSheet = {
  headers: string[];
  rows: Record<string, string>[];
  fileName?: string;
};

function cellToString(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(v).trim();
}

export function parseExcelBuffer(buffer: Buffer, fileName?: string): ParsedExcelSheet {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { headers: [], rows: [], fileName };
  }
  const sheet = wb.Sheets[sheetName]!;
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  if (!matrix.length) {
    return { headers: [], rows: [], fileName };
  }

  const headerRow = matrix[0] ?? [];
  const headers = headerRow.map((h, i) => {
    const s = normalizeExcelHeader(cellToString(h));
    return s || `열${i + 1}`;
  });

  const ref = sheet['!ref'];
  const range = ref ? XLSX.utils.decode_range(ref) : null;

  const rows: Record<string, string>[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const rowArr = matrix[r] ?? [];
    const hasAny = rowArr.some((c) => cellToString(c) !== '');
    if (!hasAny) continue;
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      const header = headers[c]!;
      let value: string;
      if (range && r <= range.e.r && c <= range.e.c) {
        const addr = XLSX.utils.encode_cell({ r, c });
        value = excelCellToString(sheet[addr], rowArr[c]);
      } else {
        value = cellToString(rowArr[c]);
      }
      obj[header] = value;
    }
    rows.push(obj);
    if (
      INQUIRY_EXCEL_IMPORT_MAX_ROWS > 0 &&
      rows.length > INQUIRY_EXCEL_IMPORT_MAX_ROWS
    ) {
      throw new Error(`엑셀 행 수가 ${INQUIRY_EXCEL_IMPORT_MAX_ROWS}건을 초과합니다.`);
    }
  }

  return { headers, rows, fileName };
}

export function extractExcelHeaders(buffer: Buffer): string[] {
  return parseExcelBuffer(buffer).headers;
}

/** 샘플 업로드 — 헤더 + 열별 예시 값(최대 2개, 자동 매핑 없음) */
export function extractExcelSampleInsights(
  buffer: Buffer,
  maxSamplesPerHeader = 2,
): { headers: string[]; headerSamples: Record<string, string[]> } {
  const sheet = parseExcelBuffer(buffer);
  const headerSamples: Record<string, string[]> = {};
  for (const header of sheet.headers) {
    const samples: string[] = [];
    for (const row of sheet.rows) {
      const value = (row[header] ?? '').trim();
      if (!value) continue;
      if (samples.includes(value)) continue;
      samples.push(value);
      if (samples.length >= maxSamplesPerHeader) break;
    }
    headerSamples[header] = samples;
  }
  return { headers: sheet.headers, headerSamples };
}
