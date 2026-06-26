/**
 * SK 현장팀장 교육자료 PDF 1회 등록
 * 사용: npx tsx scripts/upload-team-leader-training.ts [pdf경로]
 */
import '../src/env.js';
import fs from 'fs';
import path from 'path';
import { DEFAULT_TENANT_ID } from '../src/modules/tenants/tenant.constants.js';
import { uploadTeamLeaderTrainingPdf } from '../src/modules/team-leader-training/teamLeaderTraining.service.js';

const defaultPdf = path.join(
  process.env.USERPROFILE ?? '',
  'OneDrive',
  '문서',
  '카카오톡 받은 파일',
  'SK현장팀장 교육자료.pdf',
);

async function main() {
  const pdfPath = process.argv[2]?.trim() || defaultPdf;
  if (!fs.existsSync(pdfPath)) {
    console.error('PDF 파일을 찾을 수 없습니다:', pdfPath);
    process.exit(1);
  }
  const buffer = fs.readFileSync(pdfPath);
  const fileName = path.basename(pdfPath);
  const meta = await uploadTeamLeaderTrainingPdf({
    tenantId: DEFAULT_TENANT_ID,
    buffer,
    fileName,
  });
  console.log('업로드 완료:', meta);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
