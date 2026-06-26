import type { EContractAudience } from '@prisma/client';
import { resolveSubmissionChallengeDigits } from './eContract.challenge.js';
import { EC_CHALLENGE_DIGITS_TOKEN } from './eContractField.tokens.js';
import { buildExpansionValueMap } from './eContractFieldDefinition.service.js';
import { expandIssuerPlaceholders } from './eContractIssuer.expand.js';
import { getIssuerSnapshot } from './eContractIssuer.profile.service.js';
import {
  buildPartyAppendixHtml,
  dedupeTrailingPartyAppendices,
} from './eContractPartyAppendix.js';
import { expandEcTokenValues, expandSignerPlaceholders, type SignerFilledFields } from './eContractSigner.expand.js';

const UNEXPANDED_SIGNER_RE = /\[\[EC_SIGNER_|\[\[EC_SIGNATURE\]\]/;
const UNEXPANDED_ISSUER_RE = /\[\[EC_ISSUER_/;

function signerFieldsFromPayload(payload: unknown, signatureUrl: string | null): SignerFilledFields | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const p = payload as Record<string, unknown>;
  const entered = p.signerEntered;
  if (!entered || typeof entered !== 'object' || Array.isArray(entered)) return null;
  const e = entered as Record<string, unknown>;
  return {
    name: typeof e.name === 'string' ? e.name : '',
    residentRegistrationNumber:
      typeof e.residentRegistrationNumber === 'string' ? e.residentRegistrationNumber : '',
    addressLine: typeof e.addressLine === 'string' ? e.addressLine : '',
    phone: typeof e.phone === 'string' ? e.phone : '',
    freeTextNotes: typeof e.freeTextNotes === 'string' ? e.freeTextNotes : '',
    signatureSecureUrl: signatureUrl?.trim() || '',
  };
}

function signerValuesFromPayload(payload: unknown): Record<string, string> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  const raw = (payload as Record<string, unknown>).signerValuesByToken;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string' && v.trim()) out[k] = v.trim();
  }
  return out;
}

/** 체결본 HTML — 미치환 토큰·빈 을 정보를 payload·서명 URL로 보강 */
export async function hydrateSubmissionDisplayHtml(input: {
  tenantId: string;
  audience: EContractAudience;
  bodyHtml: string;
  signedAt: Date;
  signatureUrl: string | null;
  payload: unknown;
  mergeFields?: unknown;
  inviteToken?: string | null;
}): Promise<string> {
  let html = (input.bodyHtml ?? '').trim();
  if (!html) return html;

  const needsSigner =
    UNEXPANDED_SIGNER_RE.test(html) || html.includes('[[EC_SIGNATURE]]');
  const needsChallenge = html.includes(EC_CHALLENGE_DIGITS_TOKEN);
  const needsIssuer = UNEXPANDED_ISSUER_RE.test(html);

  const challengeDigits =
    typeof input.inviteToken === 'string' && input.inviteToken.trim()
      ? resolveSubmissionChallengeDigits(input.payload, input.inviteToken.trim())
      : null;

  if (needsSigner || needsChallenge) {
    const legacy = signerFieldsFromPayload(input.payload, input.signatureUrl);
    const byToken = signerValuesFromPayload(input.payload);
    const signerValues: Record<string, string> = legacy
      ? {
          '[[EC_SIGNER_NAME]]': legacy.name,
          '[[EC_SIGNER_RRN]]': legacy.residentRegistrationNumber,
          '[[EC_SIGNER_ADDRESS]]': legacy.addressLine,
          '[[EC_SIGNER_PHONE]]': legacy.phone,
          '[[EC_SIGNER_FREETEXT]]': (legacy.freeTextNotes ?? '').trim(),
          ...byToken,
        }
      : byToken;

    const valueMap = await buildExpansionValueMap({
      tenantId: input.tenantId,
      audience: input.audience,
      bodyText: html,
      mergeFields: input.mergeFields,
      signerValues,
      signedAt: input.signedAt,
      signatureUrl: input.signatureUrl,
      challengeDigits,
    });
    html = expandEcTokenValues(html, valueMap);
  } else if (input.signatureUrl?.trim()) {
    const signer = signerFieldsFromPayload(input.payload, input.signatureUrl);
    if (signer) {
      html = expandSignerPlaceholders(html, signer);
    }
  }

  if (needsIssuer || UNEXPANDED_ISSUER_RE.test(html)) {
    const snap = await getIssuerSnapshot(input.tenantId);
    html = expandIssuerPlaceholders(html, snap);
  }

  return html;
}

export async function buildAdminSubmissionBodyHtml(input: {
  tenantId: string;
  audience: EContractAudience;
  submissionId: string;
  signedAt: Date;
  signatureUrl: string | null;
  payload: unknown;
  mergeFields?: unknown;
  mergedContractHtml: string | null | undefined;
  versionFallback: string;
  inviteToken?: string | null;
}): Promise<{ bodyHtml: string; mergedUsed: boolean }> {
  const merged =
    typeof input.mergedContractHtml === 'string' && input.mergedContractHtml.trim() !== ''
      ? input.mergedContractHtml.trim()
      : '';
  const versionFallback = (input.versionFallback ?? '').trim();

  let bodyHtml = merged || versionFallback;
  const mergedUsed = Boolean(merged);

  if (merged) {
    bodyHtml = dedupeTrailingPartyAppendices(bodyHtml);
  } else if (bodyHtml && !bodyHtml.includes('ec-party-appendix')) {
    const issuerSnap = await getIssuerSnapshot(input.tenantId);
    const appendixHtml = buildPartyAppendixHtml(issuerSnap, {
      submissionId: input.submissionId,
      signedAtIso: input.signedAt.toISOString(),
    });
    const withAppendix = `${bodyHtml}\n\n${appendixHtml}`;
    const signer = signerFieldsFromPayload(input.payload, input.signatureUrl);
    bodyHtml = signer ? expandSignerPlaceholders(withAppendix, signer) : withAppendix;
  }

  bodyHtml = await hydrateSubmissionDisplayHtml({
    tenantId: input.tenantId,
    audience: input.audience,
    bodyHtml,
    signedAt: input.signedAt,
    signatureUrl: input.signatureUrl,
    payload: input.payload,
    mergeFields: input.mergeFields,
    inviteToken: input.inviteToken,
  });

  return { bodyHtml, mergedUsed };
}
