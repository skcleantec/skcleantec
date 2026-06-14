import JSZip from 'jszip';
import { formatInspectionNaReason } from '../../lib/inquiryInspectionTemplate.js';
import type { inspectionChecklistInclude } from './inquiryInspection.include.js';
import type { Prisma } from '@prisma/client';

type ChecklistRow = Prisma.InquiryInspectionChecklistGetPayload<{
  include: typeof inspectionChecklistInclude;
}>;

function safeFileName(label: string, phase: string, index: number, ext: string): string {
  const base = label.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
  return `${base}_${phase}_${String(index + 1).padStart(2, '0')}${ext}`;
}

async function fetchImageBuffer(url: string): Promise<{ buffer: Buffer; ext: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`photo_fetch_failed:${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get('content-type') ?? '';
  const ext = ct.includes('png') ? '.png' : ct.includes('webp') ? '.webp' : '.jpg';
  return { buffer: buf, ext };
}

export async function buildInspectionPhotosZipBuffer(row: ChecklistRow): Promise<Buffer> {
  const zip = new JSZip();
  for (const area of row.areas) {
    const areaFolder = zip.folder(area.label.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40) || 'area');
    if (!areaFolder) continue;
    if (area.notApplicable) {
      areaFolder.file('_구역_해당사항없음.txt', formatInspectionNaReason(area.naReason));
      continue;
    }
    for (const item of area.items) {
      const itemFolder = areaFolder.folder(item.label.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40) || 'item');
      if (!itemFolder) continue;
      if (item.notApplicable) {
        itemFolder.file('_해당사항없음.txt', formatInspectionNaReason(item.naReason));
        continue;
      }
      let beforeIdx = 0;
      let afterIdx = 0;
      for (const photo of item.photos) {
        const { buffer, ext } = await fetchImageBuffer(photo.secureUrl);
        const idx = photo.phase === 'BEFORE' ? beforeIdx++ : afterIdx++;
        const name = safeFileName(item.label, photo.phase === 'BEFORE' ? '전' : '후', idx, ext);
        itemFolder.file(name, buffer);
      }
    }
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
