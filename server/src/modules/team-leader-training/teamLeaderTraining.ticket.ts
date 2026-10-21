import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';

const PURPOSE = 'team_leader_training_pdf';
const TTL = '15m';

type TicketPayload = {
  purpose: typeof PURPOSE;
  tenantId: string;
  download: boolean;
};

/** 팀장 화면에서 휴대폰·업무 앱이 바로 열 수 있는 짧은 주소. 로그인 헤더 없이 15분만 유효. */
export function signTeamLeaderTrainingFileTicket(tenantId: string, download: boolean): string {
  const payload: TicketPayload = {
    purpose: PURPOSE,
    tenantId,
    download,
  };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: TTL });
}

export function verifyTeamLeaderTrainingFileTicket(
  raw: string,
): { tenantId: string; download: boolean } | null {
  const token = raw.trim();
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as TicketPayload;
    if (decoded.purpose !== PURPOSE) return null;
    const tenantId = typeof decoded.tenantId === 'string' ? decoded.tenantId.trim() : '';
    if (!tenantId) return null;
    return { tenantId, download: decoded.download === true };
  } catch {
    return null;
  }
}
