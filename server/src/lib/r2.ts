import { S3Client } from '@aws-sdk/client-s3';

function trim(v: string | undefined): string {
  return v?.trim() ?? '';
}

export function getR2Config(): {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
} | null {
  const accountId = trim(process.env.R2_ACCOUNT_ID);
  const accessKeyId = trim(process.env.R2_ACCESS_KEY_ID);
  const secretAccessKey = trim(process.env.R2_SECRET_ACCESS_KEY);
  const bucket = trim(process.env.R2_BUCKET);
  const publicBaseUrl = trim(process.env.R2_PUBLIC_BASE_URL).replace(/\/+$/, '');
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
    return null;
  }
  return { accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl };
}

export function isR2Configured(): boolean {
  return getR2Config() !== null;
}

let cachedClient: S3Client | null = null;

export function getR2Client(): S3Client {
  const cfg = getR2Config();
  if (!cfg) {
    throw new Error('R2_NOT_CONFIGURED');
  }
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: 'auto',
      endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
      forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }
  return cachedClient;
}
