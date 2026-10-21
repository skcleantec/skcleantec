import type { Response } from 'express';
import {
  fetchTeamLeaderTrainingPdf,
  TEAM_LEADER_TRAINING_PDF_FILENAME,
} from './teamLeaderTraining.service.js';

function contentDisposition(download: boolean): string {
  const encoded = encodeURIComponent(TEAM_LEADER_TRAINING_PDF_FILENAME)
    .replace(/['()]/g, escape)
    .replace(/\*/g, '%2A');
  const kind = download ? 'attachment' : 'inline';
  return `${kind}; filename*=UTF-8''${encoded}`;
}

export async function sendTeamLeaderTrainingPdf(
  res: Response,
  tenantId: string,
  download: boolean,
): Promise<void> {
  const { buffer, updatedAt } = await fetchTeamLeaderTrainingPdf({ tenantId });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', contentDisposition(download));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (updatedAt) res.setHeader('X-Training-Updated-At', updatedAt);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(buffer);
}

export function sendTeamLeaderTrainingPdfError(res: Response, error: unknown): void {
  const err = error as { code?: string; message?: string };
  if (err.code === 'not_found') {
    res.status(404).json({ error: err.message ?? '등록된 교육자료가 없습니다.' });
    return;
  }
  if (err.code === 'upstream') {
    res.status(502).json({ error: err.message ?? '교육자료 파일을 불러올 수 없습니다.' });
    return;
  }
  console.error('[team-leader-training] pdf proxy failed', error);
  res.status(500).json({ error: '교육자료를 불러올 수 없습니다.' });
}
