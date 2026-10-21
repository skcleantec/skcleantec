import { Router } from 'express';
import {
  sendTeamLeaderTrainingPdf,
  sendTeamLeaderTrainingPdfError,
} from './teamLeaderTraining.pdfHttp.js';
import { verifyTeamLeaderTrainingFileTicket } from './teamLeaderTraining.ticket.js';

const router = Router();

/** GET /api/public/team-training-file/:token — 짧은 열기·저장 주소. 토큰에 업체가 들어 있다. */
router.get('/team-training-file/:token', async (req, res) => {
  const ticket = verifyTeamLeaderTrainingFileTicket(req.params.token ?? '');
  if (!ticket) {
    res.status(404).json({ error: '교육자료 링크가 만료되었습니다. 팀장 화면에서 다시 열어 주세요.' });
    return;
  }
  try {
    await sendTeamLeaderTrainingPdf(res, ticket.tenantId, ticket.download);
  } catch (e) {
    if (res.headersSent) return;
    sendTeamLeaderTrainingPdfError(res, e);
  }
});

export default router;
