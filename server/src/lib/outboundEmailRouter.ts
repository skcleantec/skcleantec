import type { MailSendInput } from './mailer.js';
import type { OutboundEmailPurpose } from './outboundEmailPurpose.js';
import {
  buildPlatformCustomerFromAddress,
  findEnabledPlatformSmtpProfileForPurpose,
  isPlatformCustomerMailConfigured,
  resolvePlatformSmtpProfileTransport,
} from '../modules/platform-smtp-profiles/platformSmtpProfile.service.js';
import { sendMailWithTransport, type ResolvedSmtpTransport } from './tenantSmtp.service.js';

export { isPlatformCustomerMailConfigured };

export type PlatformCustomerMailContext = {
  purpose: OutboundEmailPurpose;
  brandDisplayName: string;
};

export async function resolvePlatformCustomerMailTransport(
  ctx: PlatformCustomerMailContext,
): Promise<ResolvedSmtpTransport | null> {
  const row = await findEnabledPlatformSmtpProfileForPurpose(ctx.purpose);
  if (!row) return null;
  const from = buildPlatformCustomerFromAddress({
    profile: row,
    brandDisplayName: ctx.brandDisplayName,
  });
  return resolvePlatformSmtpProfileTransport(row, from);
}

export async function sendPlatformCustomerMail(
  ctx: PlatformCustomerMailContext,
  input: MailSendInput,
): Promise<boolean> {
  const transport = await resolvePlatformCustomerMailTransport(ctx);
  if (!transport) return false;
  await sendMailWithTransport(transport, input);
  return true;
}
