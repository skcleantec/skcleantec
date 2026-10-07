import { timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';

const LOGIN_ID = process.env.PG_PARTNER_LOGIN_ID?.trim() || 'admin';
const PASSWORD = process.env.PG_PARTNER_PASSWORD || '1234';

function partnerSecret(): string {
  return `${config.jwtSecret}:pg-partner`;
}

function sameText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function verifyPgPartnerLogin(loginId: string, password: string): boolean {
  return sameText(loginId.trim(), LOGIN_ID) && sameText(password, PASSWORD);
}

export function signPgPartnerToken(): string {
  return jwt.sign({ kind: 'pg-partner' }, partnerSecret(), { expiresIn: '12h' });
}

export function requirePgPartner(req: Request, res: Response): boolean {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return false;
  }
  try {
    const payload = jwt.verify(token, partnerSecret()) as { kind?: string };
    if (payload.kind !== 'pg-partner') {
      res.status(401).json({ error: '로그인이 필요합니다.' });
      return false;
    }
    return true;
  } catch {
    res.status(401).json({ error: '로그인이 만료되었습니다. 다시 로그인해 주세요.' });
    return false;
  }
}
