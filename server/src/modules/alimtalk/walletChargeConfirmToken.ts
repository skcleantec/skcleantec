import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { getPublicAppBaseUrl } from '../../lib/publicAppBaseUrl.js';

const TOKEN_PURPOSE = 'wallet_charge_confirm';
const TOKEN_TTL = '7d';

export const WALLET_CHARGE_CONFIRM_PUBLIC_PATH = '/ops/wallet-charge-confirm';

export class WalletChargeConfirmTokenError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 410 = 400,
  ) {
    super(message);
    this.name = 'WalletChargeConfirmTokenError';
  }
}

export type WalletChargeConfirmTokenPayload = {
  purpose: typeof TOKEN_PURPOSE;
  tenantId: string;
  chargeRequestId: string;
};

function getSecret(): string {
  const secret = config.jwtSecret?.trim();
  if (!secret) {
    throw new WalletChargeConfirmTokenError('충전 확인 링크를 만들 수 없습니다. JWT_SECRET을 확인해 주세요.');
  }
  return secret;
}

export function signWalletChargeConfirmToken(input: {
  tenantId: string;
  chargeRequestId: string;
}): string {
  const payload: WalletChargeConfirmTokenPayload = {
    purpose: TOKEN_PURPOSE,
    tenantId: input.tenantId,
    chargeRequestId: input.chargeRequestId,
  };
  return jwt.sign(payload, getSecret(), { expiresIn: TOKEN_TTL });
}

export function verifyWalletChargeConfirmToken(raw: string): WalletChargeConfirmTokenPayload {
  const token = raw.trim();
  if (!token) {
    throw new WalletChargeConfirmTokenError('확인 링크가 올바르지 않습니다.');
  }
  try {
    const decoded = jwt.verify(token, getSecret()) as WalletChargeConfirmTokenPayload;
    if (
      decoded.purpose !== TOKEN_PURPOSE ||
      !decoded.tenantId?.trim() ||
      !decoded.chargeRequestId?.trim()
    ) {
      throw new WalletChargeConfirmTokenError('확인 링크가 올바르지 않습니다.');
    }
    return {
      purpose: TOKEN_PURPOSE,
      tenantId: decoded.tenantId,
      chargeRequestId: decoded.chargeRequestId,
    };
  } catch (e) {
    if (e instanceof WalletChargeConfirmTokenError) throw e;
    if (e instanceof jwt.TokenExpiredError) {
      throw new WalletChargeConfirmTokenError('확인 링크가 만료되었습니다. 충전 신청을 다시 받아 주세요.', 410);
    }
    throw new WalletChargeConfirmTokenError('확인 링크가 올바르지 않거나 만료되었습니다.');
  }
}

export function buildWalletChargeConfirmPageUrl(token: string): string {
  return `${getPublicAppBaseUrl()}${WALLET_CHARGE_CONFIRM_PUBLIC_PATH}?t=${encodeURIComponent(token)}`;
}
