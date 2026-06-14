import '../env.js';
import nodemailer from 'nodemailer';

export type MailSendInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
};

export function isSmtpConfigured(): boolean {
  const host = (process.env.SMTP_HOST ?? '').trim();
  const from = (process.env.SMTP_FROM ?? process.env.SMTP_USER ?? '').trim();
  return Boolean(host && from);
}

function createTransport() {
  const host = (process.env.SMTP_HOST ?? '').trim();
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = (process.env.SMTP_USER ?? '').trim();
  const pass = (process.env.SMTP_PASS ?? '').trim();
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
}

export async function sendMail(input: MailSendInput): Promise<void> {
  if (!isSmtpConfigured()) {
    throw new Error('SMTP_NOT_CONFIGURED');
  }
  const from = (process.env.SMTP_FROM ?? process.env.SMTP_USER ?? '').trim();
  const transport = createTransport();
  await transport.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    attachments: input.attachments,
  });
}
