import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { getPublicAppBaseUrl } from '../../lib/publicAppBaseUrl.js';

const TOKEN_PURPOSE = 'billing_deposit_confirm';
const TOKEN_TTL = '7d';

export const DEPOSIT_CONFIRM_PUBLIC_PATH = '/ops/deposit-confirm';

export class DepositConfirmTokenError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 410 = 400,
  ) {
    super(message);
    this.name = 'DepositConfirmTokenError';
  }
}

export type DepositConfirmTokenPayload = {
  purpose: typeof TOKEN_PURPOSE;
  tenantId: string;
  invoiceId: string;
  test?: boolean;
};

function getSecret(): string {
  const secret = config.jwtSecret?.trim();
  if (!secret) {
    throw new DepositConfirmTokenError('입금 확인 링크를 만들 수 없습니다. JWT_SECRET을 확인해 주세요.');
  }
  return secret;
}

export function signDepositConfirmToken(input: {
  tenantId: string;
  invoiceId: string;
  test?: boolean;
}): string {
  const payload: DepositConfirmTokenPayload = {
    purpose: TOKEN_PURPOSE,
    tenantId: input.tenantId,
    invoiceId: input.invoiceId,
    ...(input.test ? { test: true } : {}),
  };
  return jwt.sign(payload, getSecret(), { expiresIn: TOKEN_TTL });
}

export function verifyDepositConfirmToken(raw: string): DepositConfirmTokenPayload {
  const token = raw.trim();
  if (!token) {
    throw new DepositConfirmTokenError('확인 링크가 올바르지 않습니다.');
  }
  try {
    const decoded = jwt.verify(token, getSecret()) as DepositConfirmTokenPayload;
    if (
      decoded.purpose !== TOKEN_PURPOSE ||
      !decoded.tenantId?.trim() ||
      !decoded.invoiceId?.trim()
    ) {
      throw new DepositConfirmTokenError('확인 링크가 올바르지 않습니다.');
    }
    return {
      purpose: TOKEN_PURPOSE,
      tenantId: decoded.tenantId,
      invoiceId: decoded.invoiceId,
      test: decoded.test === true,
    };
  } catch (e) {
    if (e instanceof DepositConfirmTokenError) throw e;
    if (e instanceof jwt.TokenExpiredError) {
      throw new DepositConfirmTokenError('확인 링크가 만료되었습니다. 업체에 입금 확인을 다시 요청해 주세요.', 410);
    }
    throw new DepositConfirmTokenError('확인 링크가 올바르지 않거나 만료되었습니다.');
  }
}

export function buildDepositConfirmPageUrl(token: string): string {
  return `${getPublicAppBaseUrl()}${DEPOSIT_CONFIRM_PUBLIC_PATH}?t=${encodeURIComponent(token)}`;
}
