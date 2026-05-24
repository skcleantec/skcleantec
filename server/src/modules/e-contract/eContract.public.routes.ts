import { Router, type Request } from 'express';
import { cloudinary, isCloudinaryConfigured } from '../../lib/cloudinary.js';
import {
  completeSubmissionByToken,
  getPublicSignSession,
  issuanceFolderForUpload,
  validateIssuanceWritable,
} from './eContract.public.service.js';
import {
  resolveSignerFormFields,
} from './eContractFieldDefinition.service.js';
import {
  signerFieldErrorMessage,
  validateDynamicSignerFields,
  validateSignerSubmissionBody,
} from './eContractSigner.input.js';

const router = Router();

function clientIp(req: Request): string | undefined {
  const xfRaw = req.headers['x-forwarded-for'];
  const xf = typeof xfRaw === 'string' ? xfRaw.split(',')[0]?.trim() : '';
  const raw = xf || req.socket?.remoteAddress || '';
  return raw || undefined;
}

router.get('/sign/:token', async (req, res) => {
  try {
    const sessionOrErr = await getPublicSignSession(req.params.token);
    if ('error' in sessionOrErr) {
      const code = sessionOrErr.error;
      const status =
        code === 'not_found' ? 404 : code === 'expired' ? 410 : code === 'tenant_suspended' ? 403 : 403;
      const msg =
        code === 'tenant_suspended'
          ? '서비스가 중지된 업체입니다.'
          : code === 'expired'
          ? '만료된 링크입니다.'
          : code === 'not_found'
            ? '링크를 찾을 수 없습니다.'
            : code === 'revoked'
              ? '취소된 링크입니다.'
              : '링크를 사용할 수 없습니다.';
      res.status(status).json({ error: msg });
      return;
    }
    const s = sessionOrErr;
    if (s.alreadySigned) {
      res.json({
        session: {
          ...s,
          challengeDigits: '******',
        },
      });
      return;
    }
    res.json({ session: s });
  } catch (e) {
    console.error('[e-contract public] GET sign', e);
    res.status(500).json({ error: '불러오지 못했습니다.' });
  }
});

router.post('/sign/:token/upload-sign', async (req, res) => {
  try {
    if (!isCloudinaryConfigured()) {
      res.status(503).json({ error: '이미지 저장소가 준비되지 않았습니다.' });
      return;
    }

    const issuance = await validateIssuanceWritable(req.params.token);
    const folder = await issuanceFolderForUpload(issuance.id);
    const ts = Math.round(Date.now() / 1000);
    const paramsToSign: Record<string, string | number> = { timestamp: ts, folder };

    const cfg = cloudinary.config();
    if (!cfg.api_secret) {
      res.status(503).json({ error: '저장 설정이 불완전합니다.' });
      return;
    }
    const signature = cloudinary.utils.api_sign_request(paramsToSign, cfg.api_secret);

    res.json({
      cloudName: cfg.cloud_name,
      apiKey: cfg.api_key,
      timestamp: ts,
      signature,
      folder,
    });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === 'not_found') {
      res.status(404).json({ error: '링크를 찾을 수 없습니다.' });
      return;
    }
    if (code === 'conflict') {
      res.status(409).json({ error: '이미 체결했습니다.' });
      return;
    }
    if (code === 'gone') {
      res.status(410).json({ error: '링크가 만료되었습니다.' });
      return;
    }
    if (code === 'forbidden') {
      res.status(403).json({ error: '링크를 사용할 수 없습니다.' });
      return;
    }
    console.error('[e-contract public] upload-sign', e);
    res.status(500).json({ error: '업로드 서명에 실패했습니다.' });
  }
});

router.post('/sign/:token/submit', async (req, res) => {
  try {
    const b = req.body ?? {};
    const ua = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined;

    const issuance = await validateIssuanceWritable(req.params.token);
    const audience = issuance.definition!.audience;
    const signFields = await resolveSignerFormFields(issuance.definition!.tenantId, audience);

    let signerEntered;
    let signerValuesByToken: Record<string, string> = {};
    try {
      if (signFields.length > 0) {
        const validated = validateDynamicSignerFields(b as Record<string, unknown>, signFields);
        signerEntered = validated.legacy;
        signerValuesByToken = validated.byToken;
      } else {
        signerEntered = validateSignerSubmissionBody(b as Record<string, unknown>);
      }
    } catch (ev: unknown) {
      res.status(400).json({ error: signerFieldErrorMessage(ev) });
      return;
    }

    const result = await completeSubmissionByToken(
      req.params.token,
      {
        signerEntered,
        signerValuesByToken,
        challengeEntered: typeof b.challengeEntered === 'string' ? b.challengeEntered : '',
        agree: b.agree === true,
        selfiePublicId: typeof b.selfiePublicId === 'string' ? b.selfiePublicId : '',
        selfieUrl: typeof b.selfieUrl === 'string' ? b.selfieUrl : '',
        signaturePublicId: typeof b.signaturePublicId === 'string' ? b.signaturePublicId : '',
        signatureUrl: typeof b.signatureUrl === 'string' ? b.signatureUrl : '',
        signerUserAgent: ua,
        signerIp: clientIp(req),
        payloadExtras:
          typeof b.payloadExtras === 'object' && b.payloadExtras !== null
            ? (b.payloadExtras as Record<string, unknown>)
            : undefined,
      },
      { ua, ip: clientIp(req) }
    );

    res.json({ ok: true, signedAt: result.signedAt });
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    const message = e instanceof Error ? e.message : '';
    if (code === 'bad_request') {
      const txt =
        message === 'challenge'
          ? '본인확인 번호가 맞지 않습니다.'
          : message === 'agree_required'
            ? '동의가 필요합니다.'
            : message === 'cloudinary_meta'
              ? '업로드된 파일 정보가 올바르지 않습니다.'
              : '입력값을 확인해 주세요.';
      res.status(400).json({ error: txt });
      return;
    }
    if (code === 'not_found') {
      res.status(404).json({ error: '링크를 찾을 수 없습니다.' });
      return;
    }
    if (code === 'conflict') {
      res.status(409).json({ error: '이미 체결했습니다.' });
      return;
    }
    if (code === 'gone') {
      res.status(410).json({ error: '링크가 만료되었습니다.' });
      return;
    }
    if (code === 'forbidden') {
      res.status(403).json({ error: '링크를 사용할 수 없습니다.' });
      return;
    }
    console.error('[e-contract public] submit', e);
    res.status(500).json({ error: '저장하지 못했습니다.' });
  }
});

export default router;
