import { PrismaClient } from '@prisma/client';
import { submissionMergedHtmlToDocxBuffer } from './src/modules/e-contract/eContractSubmissionDocx.js';
import { getSubmissionDetailForAdmin } from './src/modules/e-contract/eContract.service.js';

const prisma = new PrismaClient();

async function run() {
  try {
    const sub = await prisma.eContractSubmission.findFirst({
      orderBy: { signedAt: 'desc' }
    });
    if (!sub) {
      console.log("No submissions found.");
      return;
    }
    
    const detail = await getSubmissionDetailForAdmin(sub.id);
    
    const buf = await submissionMergedHtmlToDocxBuffer({
      definitionTitle: detail.definitionTitle,
      metaLinePlain: `${detail.teamLeader.name} (${detail.teamLeader.email}) · ${new Date(detail.signedAt).toLocaleString('ko-KR')}`,
      bodyHtml: detail.bodyHtml,
      submissionId: detail.id,
    });
    
    console.log("Success! Buffer size:", buf.length);
  } catch (err) {
    console.error("FAILED WITH ERROR:");
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}
run();