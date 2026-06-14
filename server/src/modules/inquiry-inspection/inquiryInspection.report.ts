import fs from 'node:fs';
import {
  INSPECTION_BASIC_QUESTIONS,
  INSPECTION_HEADER_INTRO,
} from '../../lib/inquiryInspectionTemplate.js';
import { INSPECTION_FINAL_CONFIRM_NOTICE } from '../../lib/inquiryInspectionConsent.js';
import type { inspectionChecklistInclude } from './inquiryInspection.include.js';
import type { Prisma } from '@prisma/client';
import { parseBasicAnswers } from './inquiryInspection.validation.js';

type ChecklistRow = Prisma.InquiryInspectionChecklistGetPayload<{
  include: typeof inspectionChecklistInclude;
}>;

function yn(v: boolean | null): string {
  if (v === true) return '예';
  if (v === false) return '아니오';
  return '—';
}

export function buildInspectionReportPlainText(
  row: ChecklistRow,
  inquiry: {
    customerName: string;
    inquiryNumber: string | null;
    preferredDate: Date | null;
    address: string;
  },
): string {
  const basic = parseBasicAnswers(row.basicAnswersJson);
  const lines: string[] = [
    '청소 서비스 현장 검수 체크리스트',
    '',
    INSPECTION_HEADER_INTRO,
    '',
    `고객명: ${inquiry.customerName}`,
    inquiry.inquiryNumber ? `접수번호: ${inquiry.inquiryNumber}` : '',
    `서비스일: ${inquiry.preferredDate?.toISOString().slice(0, 10) ?? '—'}`,
    `주소: ${inquiry.address}`,
    `담당 팀장: ${row.teamLeader.name}`,
    '',
    '— 기본사항 —',
  ].filter(Boolean);

  for (const q of INSPECTION_BASIC_QUESTIONS) {
    const slot = basic[q.id];
    lines.push(`${q.text}`);
    lines.push(`  팀장: ${yn(slot.leader)} / 고객: ${yn(slot.customer)}`);
  }

  lines.push('', '— 구역별 검수 —');
  for (const area of row.areas) {
    if (area.notApplicable) {
      lines.push(`[${area.label}] 해당사항 없음 — ${area.naReason ?? ''}`);
      continue;
    }
    const before = area.photos.filter((p) => p.phase === 'BEFORE').length;
    const after = area.photos.filter((p) => p.phase === 'AFTER').length;
    lines.push(`[${area.label}] 청소 전 ${before}장 / 청소 후 ${after}장`);
  }

  if (row.leaderNotes?.trim()) {
    lines.push('', '— 특이사항 —', row.leaderNotes.trim());
  }

  lines.push('', '— 고객 이메일 —', row.customerEmail ?? '—');
  lines.push('', INSPECTION_FINAL_CONFIRM_NOTICE);
  if (row.completedAt) {
    lines.push('', `완료 일시: ${row.completedAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
  }
  return lines.join('\n');
}

export function buildInspectionReportHtml(
  row: ChecklistRow,
  inquiry: {
    customerName: string;
    inquiryNumber: string | null;
    preferredDate: Date | null;
    address: string;
  },
): string {
  const basic = parseBasicAnswers(row.basicAnswersJson);
  const basicRows = INSPECTION_BASIC_QUESTIONS.map(
    (q) => `<tr><td>${escapeHtml(q.text)}</td><td>${yn(basic[q.id].leader)}</td><td>${yn(basic[q.id].customer)}</td></tr>`,
  ).join('');

  const areaRows = row.areas
    .map((area) => {
      if (area.notApplicable) {
        return `<tr><td>${escapeHtml(area.label)}</td><td colspan="2">해당사항 없음 — ${escapeHtml(area.naReason ?? '')}</td></tr>`;
      }
      const before = area.photos.filter((p) => p.phase === 'BEFORE').length;
      const after = area.photos.filter((p) => p.phase === 'AFTER').length;
      return `<tr><td>${escapeHtml(area.label)}</td><td>전 ${before}장</td><td>후 ${after}장</td></tr>`;
    })
    .join('');

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"/>
<style>
body{font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;color:#111;line-height:1.5;padding:24px;}
h1{font-size:20px;margin:0 0 8px;}
.meta{margin:12px 0 20px;color:#333;}
table{border-collapse:collapse;width:100%;margin:12px 0;font-size:13px;}
th,td{border:1px solid #ddd;padding:8px;text-align:left;vertical-align:top;}
th{background:#f5f5f5;}
.note{background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:8px;font-size:12px;color:#334155;}
</style></head><body>
<h1>청소 서비스 현장 검수 체크리스트</h1>
<p class="meta">${escapeHtml(INSPECTION_HEADER_INTRO)}</p>
<table class="meta">
<tr><th>고객명</th><td>${escapeHtml(inquiry.customerName)}</td></tr>
${inquiry.inquiryNumber ? `<tr><th>접수번호</th><td>${escapeHtml(inquiry.inquiryNumber)}</td></tr>` : ''}
<tr><th>서비스일</th><td>${escapeHtml(inquiry.preferredDate?.toISOString().slice(0, 10) ?? '—')}</td></tr>
<tr><th>주소</th><td>${escapeHtml(inquiry.address)}</td></tr>
<tr><th>담당 팀장</th><td>${escapeHtml(row.teamLeader.name)}</td></tr>
<tr><th>완료 일시</th><td>${row.completedAt ? escapeHtml(row.completedAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })) : '—'}</td></tr>
</table>
<h2>기본사항</h2>
<table><thead><tr><th>확인 내용</th><th>팀장</th><th>고객</th></tr></thead><tbody>${basicRows}</tbody></table>
<h2>구역별 검수</h2>
<table><thead><tr><th>구역</th><th>청소 전</th><th>청소 후</th></tr></thead><tbody>${areaRows}</tbody></table>
${row.leaderNotes?.trim() ? `<h2>특이사항</h2><p>${escapeHtml(row.leaderNotes.trim())}</p>` : ''}
<p class="note">${escapeHtml(INSPECTION_FINAL_CONFIRM_NOTICE)}</p>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function resolvePdfKoreanFontPath(): string | null {
  const envPath = (process.env.INSPECTION_PDF_FONT_PATH ?? '').trim();
  const candidates = [
    envPath,
    '/usr/share/fonts/truetype/nanum/NanumGothic.ttf',
    'C:\\Windows\\Fonts\\malgun.ttf',
  ].filter(Boolean) as string[];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return null;
}
