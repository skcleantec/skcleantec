import type { PrismaClient } from '@prisma/client';
import { customerFormAddressFromInquiry } from '../../lib/orderFormPendingAddress.js';
import { ORDER_FORM_CLEANING_KIND_FIELD_KEY } from '../../lib/orderFormCleaningKind.js';
import { expandOrderFormCustomerText } from '../../lib/orderFormGuidePlaceholders.js';
import { mergeOrderFormFillRules, toPublicFillRules } from '../../lib/orderFormFillRules.js';
import { resolveOperatingCompanyCancellationPolicy } from '../../lib/operatingCompanyCancellationPolicyCore.js';
import { parseOperatingCompanyConfig } from '../operating-companies/operatingCompany.schema.js';
import { parseTenantConfig } from '../tenants/tenantConfig.schema.js';
import { isPlatformFullSuspend } from '../tenants/tenant.service.js';
import { PublicTenantAccessError } from '../tenants/publicTenantAccess.js';
import { ShortTtlCache } from '../../lib/shortTtlCache.js';
import { mapOrderFormTemplateToPublic } from '../orderform-templates/orderFormTemplate.service.js';
import {
  brandOverlayOnTenantFormConfig,
  normalizeGuidePreferredDateYmd,
  resolvedPublicFormConfig,
} from './orderFormPublicFormConfig.js';
import { companyTrustFromLoaded } from './publicOrderFormCompanyTrust.js';
import { serializeSubmissionEmailLogPublic } from './orderFormSubmissionEmail.service.js';

type PublicOrderFormLoaded = {
  tenant: {
    id: string;
    slug: string;
    status: unknown;
    suspendReason: unknown;
    billingAccessBlockedAt: Date | null;
  };
  payload: Record<string, unknown>;
};

const bundleCache = new ShortTtlCache<PublicOrderFormLoaded>(20_000, 80);

function dateToKstYmd(d: Date | null): string | null {
  if (!d || Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

function asDate(raw: unknown): Date | null {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) return raw;
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d;
}

function asRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function omitPreviewCleaningKind(token: string, answers: unknown): Record<string, unknown> | null {
  const rec = asRecord(answers);
  if (!rec || !token.startsWith('skct_designer_preview')) return rec;
  if (!(ORDER_FORM_CLEANING_KIND_FIELD_KEY in rec)) return rec;
  const next = { ...rec };
  delete next[ORDER_FORM_CLEANING_KIND_FIELD_KEY];
  return next;
}

type OcRow = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  config: unknown;
};

function brandingFromOc(oc: OcRow | null, tenantConfig: unknown) {
  if (!oc?.isActive) return null;
  const config = parseOperatingCompanyConfig(oc.config);
  const tenantName = parseTenantConfig(tenantConfig).branding?.displayName?.trim() || '';
  const ocDisplay = config.branding?.displayName?.trim() || '';
  return {
    operatingCompanyId: oc.id,
    slug: oc.slug,
    displayName: ocDisplay || tenantName || oc.name,
    publicSubtitle: config.orderForm?.publicSubtitle?.trim() || null,
  };
}

/**
 * 고객 발주서 공개 조회. 원격 DB 왕복이 한 번이면 첫 화면이 열린다.
 * 토큰으로 찾은 발주서의 tenant_id 로만 나머지 행을 읽는다.
 */
export async function loadPublicOrderFormByToken(
  db: PrismaClient,
  token: string,
  opts?: { brandSlug?: string | null; overrideTemplateId?: string | null },
): Promise<PublicOrderFormLoaded | null> {
  const brandSlug = opts?.brandSlug?.trim() || null;
  const overrideTemplateId = opts?.overrideTemplateId?.trim() || null;
  const cacheKey = `${token}|${brandSlug ?? ''}|${overrideTemplateId ?? ''}`;
  const cached = bundleCache.get(cacheKey);
  if (cached) return cached;

  const rows = await db.$queryRaw<Array<{ bundle: unknown }>>`
    WITH f AS (
      SELECT * FROM order_forms WHERE token = ${token} LIMIT 1
    )
    SELECT json_build_object(
      'form', (SELECT json_build_object(
        'id', id,
        'tenantId', tenant_id,
        'token', token,
        'operatingCompanyId', operating_company_id,
        'templateId', template_id,
        'customerName', customer_name,
        'customerPhone', customer_phone,
        'customerEmail', customer_email,
        'totalAmount', total_amount,
        'depositAmount', deposit_amount,
        'balanceAmount', balance_amount,
        'optionNote', option_note,
        'preferredDate', preferred_date,
        'preferredTime', preferred_time,
        'preferredTimeDetail', preferred_time_detail,
        'areaPyeong', area_pyeong,
        'areaBasis', area_basis,
        'extraWorkNotice', extra_work_notice,
        'customerSpecialNotes', customer_special_notes,
        'customerAnswers', customer_answers,
        'prefillAnswers', prefill_answers,
        'submittedAt', submitted_at,
        'customerSubmissionSnapshot', customer_submission_snapshot
      ) FROM f),
      'tenant', (SELECT json_build_object(
        'id', id,
        'slug', slug,
        'status', status,
        'suspendReason', suspend_reason,
        'billingAccessBlockedAt', billing_access_blocked_at
      ) FROM tenants WHERE id = (SELECT tenant_id FROM f)),
      'tenantConfig', (SELECT config FROM tenants WHERE id = (SELECT tenant_id FROM f)),
      'operatingCompany', (SELECT json_build_object(
        'id', id,
        'name', name,
        'slug', slug,
        'isActive', is_active,
        'config', config
      ) FROM operating_companies
        WHERE id = (SELECT operating_company_id FROM f)
          AND tenant_id = (SELECT tenant_id FROM f)),
      'brandBySlug', (SELECT json_build_object(
        'id', id,
        'name', name,
        'slug', slug,
        'isActive', is_active,
        'config', config
      ) FROM operating_companies
        WHERE tenant_id = (SELECT tenant_id FROM f)
          AND ${brandSlug}::text IS NOT NULL
          AND lower(slug) = lower(${brandSlug}::text)
        LIMIT 1),
      'orderFormConfig', (SELECT json_build_object(
        'formTitle', form_title,
        'priceLabel', price_label,
        'reviewEventText', review_event_text,
        'footerNotice1', footer_notice_1,
        'footerNotice2', footer_notice_2,
        'infoContent', info_content,
        'infoLinkText', info_link_text,
        'submitSuccessTitle', submit_success_title,
        'submitSuccessBody', submit_success_body,
        'timeSlotAckTitle', time_slot_ack_title,
        'timeSlotAckBody', time_slot_ack_body,
        'timeSlotAckConsentHint', time_slot_ack_consent_hint,
        'serviceDateAckTitle', service_date_ack_title,
        'serviceDateAckBody', service_date_ack_body,
        'serviceDateAckConsentHint', service_date_ack_consent_hint,
        'timeSlotLabelsJson', time_slot_labels_json,
        'issueFillRules', issue_fill_rules
      ) FROM order_form_config WHERE tenant_id = (SELECT tenant_id FROM f)),
      'brandLink', (SELECT json_build_object(
        'formTitle', form_title,
        'priceLabel', price_label,
        'reviewEventText', review_event_text,
        'footerNotice1', footer_notice_1,
        'footerNotice2', footer_notice_2
      ) FROM order_form_brand_customer_link_configs
        WHERE tenant_id = (SELECT tenant_id FROM f)
          AND operating_company_id = (SELECT operating_company_id FROM f)),
      'options', (SELECT coalesce(json_agg(json_build_object(
          'name', name,
          'extraAmount', extra_amount
        ) ORDER BY sort_order), '[]'::json)
        FROM estimate_options
        WHERE tenant_id = (SELECT tenant_id FROM f) AND is_active = true),
      'professionalOptions', (SELECT coalesce(json_agg(json_build_object(
          'id', p.id,
          'parentId', p.parent_id,
          'isGroup', p.is_group,
          'isActive', p.is_active,
          'label', p.label,
          'priceHint', p.price_hint,
          'priceAmount', p.price_amount,
          'emoji', p.emoji,
          'color', p.color,
          'sortOrder', p.sort_order
        ) ORDER BY p.parent_id ASC NULLS FIRST, p.sort_order ASC, p.created_at ASC), '[]'::json)
        FROM professional_specialty_options p
        WHERE p.tenant_id = (SELECT tenant_id FROM f)
          AND p.is_active = true
          AND (
            p.parent_id IS NULL
            OR EXISTS (
              SELECT 1 FROM professional_specialty_options parent
              WHERE parent.tenant_id = p.tenant_id
                AND parent.id = p.parent_id
                AND parent.is_active = true
            )
          )),
      'template', COALESCE(
        (SELECT json_build_object(
          'id', t.id,
          'title', t.title,
          'icon', t.icon,
          'description', t.description,
          'isDefault', t.is_default,
          'renderMode', t.render_mode,
          'customerWizardJson', t.customer_wizard_json,
          'fields', (SELECT coalesce(json_agg(json_build_object(
            'systemField', tf.system_field,
            'fillMode', tf.fill_mode,
            'fieldKey', tf.field_key,
            'label', tf.label,
            'helpText', tf.help_text,
            'inputType', tf.input_type,
            'options', tf.options,
            'placeholder', tf.placeholder,
            'optionStyle', tf.option_style,
            'optionLayout', tf.option_layout,
            'required', tf.required,
            'sortOrder', tf.sort_order
          ) ORDER BY tf.sort_order), '[]'::json)
            FROM order_form_template_fields tf
            WHERE tf.template_id = t.id AND tf.tenant_id = t.tenant_id)
        ) FROM order_form_templates t
          WHERE ${overrideTemplateId}::text IS NOT NULL
            AND t.id = ${overrideTemplateId}
            AND t.tenant_id = (SELECT tenant_id FROM f)),
        (SELECT json_build_object(
          'id', t.id,
          'title', t.title,
          'icon', t.icon,
          'description', t.description,
          'isDefault', t.is_default,
          'renderMode', t.render_mode,
          'customerWizardJson', t.customer_wizard_json,
          'fields', (SELECT coalesce(json_agg(json_build_object(
            'systemField', tf.system_field,
            'fillMode', tf.fill_mode,
            'fieldKey', tf.field_key,
            'label', tf.label,
            'helpText', tf.help_text,
            'inputType', tf.input_type,
            'options', tf.options,
            'placeholder', tf.placeholder,
            'optionStyle', tf.option_style,
            'optionLayout', tf.option_layout,
            'required', tf.required,
            'sortOrder', tf.sort_order
          ) ORDER BY tf.sort_order), '[]'::json)
            FROM order_form_template_fields tf
            WHERE tf.template_id = t.id AND tf.tenant_id = t.tenant_id)
        ) FROM order_form_templates t
          WHERE t.id = (SELECT template_id FROM f)
            AND t.tenant_id = (SELECT tenant_id FROM f))
      ),
      'pendingInquiry', (SELECT json_build_object(
        'customerName', customer_name,
        'customerPhone', customer_phone,
        'customerPhone2', customer_phone_2,
        'customerEmail', customer_email,
        'address', address,
        'addressDetail', address_detail,
        'areaPyeong', area_pyeong,
        'areaBasis', area_basis,
        'exclusiveAreaSqm', exclusive_area_sqm,
        'propertyType', property_type,
        'roomCount', room_count,
        'bathroomCount', bathroom_count,
        'balconyCount', balcony_count,
        'kitchenCount', kitchen_count,
        'preferredDate', preferred_date,
        'preferredTime', preferred_time,
        'preferredTimeDetail', preferred_time_detail,
        'buildingType', building_type,
        'moveInTiming', move_in_timing,
        'moveInDate', move_in_date,
        'moveInDateUndecided', move_in_date_undecided,
        'memo', memo
      ) FROM inquiries
        WHERE order_form_id = (SELECT id FROM f)
          AND tenant_id = (SELECT tenant_id FROM f)
          AND status IN ('PENDING', 'DEPOSIT_COMPLETED', 'ORDER_FORM_PENDING')
        ORDER BY created_at DESC
        LIMIT 1),
      'inquiryNumber', (SELECT inquiry_number FROM inquiries
        WHERE order_form_id = (SELECT id FROM f)
          AND tenant_id = (SELECT tenant_id FROM f)
        ORDER BY created_at DESC
        LIMIT 1),
      'emailLog', (SELECT json_build_object(
        'status', status,
        'toEmail', to_email,
        'lastError', last_error,
        'sentAt', sent_at
      ) FROM order_form_submission_email_logs
        WHERE tenant_id = (SELECT tenant_id FROM f)
          AND order_form_id = (SELECT id FROM f))
    ) AS bundle
  `;

  const bundle = asRecord(rows[0]?.bundle);
  const form = asRecord(bundle?.form);
  const tenant = asRecord(bundle?.tenant);
  if (!form || !tenant || typeof form.tenantId !== 'string' || typeof tenant.id !== 'string') {
    return null;
  }
  if (form.tenantId !== tenant.id) return null;

  const oc = asRecord(bundle?.operatingCompany) as OcRow | null;
  const brandBySlug = asRecord(bundle?.brandBySlug) as OcRow | null;
  const brandingOc = oc?.isActive ? oc : brandBySlug?.isActive ? brandBySlug : null;
  const tenantConfig = bundle?.tenantConfig ?? null;
  const publicBranding = brandingFromOc(brandingOc, tenantConfig);
  const trustOc = oc ?? (brandingOc && !form.operatingCompanyId ? brandingOc : null);
  const publicCompanyTrust = companyTrustFromLoaded({
    tenantConfig,
    operatingCompany: trustOc,
    displayNameFallback: publicBranding?.displayName ?? null,
  });

  const cfg = asRecord(bundle?.orderFormConfig);
  const brandLink = asRecord(bundle?.brandLink);
  const cfgRow = cfg
    ? brandLink
      ? brandOverlayOnTenantFormConfig(cfg as never, brandLink as never)
      : cfg
    : {
        formTitle: '',
        priceLabel: null,
        reviewEventText: null,
        footerNotice1: null,
        footerNotice2: null,
        infoContent: null,
        infoLinkText: null,
        submitSuccessTitle: null,
        submitSuccessBody: null,
        timeSlotAckTitle: null,
        timeSlotAckBody: null,
        timeSlotAckConsentHint: null,
        serviceDateAckTitle: null,
        serviceDateAckBody: null,
        serviceDateAckConsentHint: null,
        timeSlotLabelsJson: null,
      };
  const preferredDateYmd = normalizeGuidePreferredDateYmd(form.preferredDate);
  const policySource = oc ?? brandingOc;
  const guidePolicy = resolveOperatingCompanyCancellationPolicy(
    policySource ? parseOperatingCompanyConfig(policySource.config).cancellationPolicy : undefined,
  );
  const resolved = resolvedPublicFormConfig(cfgRow as never);
  const expandOpts = { preferredDateYmd };
  const formConfig = {
    ...resolved,
    guidePolicy,
    timeSlotAckBody: expandOrderFormCustomerText(resolved.timeSlotAckBody, guidePolicy, expandOpts),
    submitSuccessBody: expandOrderFormCustomerText(resolved.submitSuccessBody, guidePolicy, expandOpts),
  };

  const templateRaw = asRecord(bundle?.template);
  const template = templateRaw
    ? mapOrderFormTemplateToPublic({
        id: String(templateRaw.id),
        title: String(templateRaw.title ?? ''),
        icon: templateRaw.icon == null ? null : String(templateRaw.icon),
        description: templateRaw.description == null ? null : String(templateRaw.description),
        isDefault: templateRaw.isDefault === true,
        renderMode: templateRaw.renderMode === 'TEMPLATE' ? 'TEMPLATE' : 'STANDARD',
        customerWizardJson: templateRaw.customerWizardJson ?? null,
        fields: Array.isArray(templateRaw.fields) ? (templateRaw.fields as never) : [],
      })
    : null;

  const pendingRaw = asRecord(bundle?.pendingInquiry);
  const pendingInquiry = pendingRaw
    ? {
        customerName: String(pendingRaw.customerName ?? ''),
        customerPhone: String(pendingRaw.customerPhone ?? ''),
        customerPhone2: pendingRaw.customerPhone2 == null ? null : String(pendingRaw.customerPhone2),
        customerEmail: pendingRaw.customerEmail == null ? null : String(pendingRaw.customerEmail),
        address: customerFormAddressFromInquiry(String(pendingRaw.address ?? '')),
        addressDetail: pendingRaw.addressDetail == null ? null : String(pendingRaw.addressDetail),
        areaPyeong: pendingRaw.areaPyeong == null ? null : Number(pendingRaw.areaPyeong),
        areaBasis: pendingRaw.areaBasis == null ? null : String(pendingRaw.areaBasis),
        exclusiveAreaSqm: pendingRaw.exclusiveAreaSqm == null ? null : Number(pendingRaw.exclusiveAreaSqm),
        propertyType: pendingRaw.propertyType == null ? null : String(pendingRaw.propertyType),
        roomCount: pendingRaw.roomCount == null ? null : Number(pendingRaw.roomCount),
        bathroomCount: pendingRaw.bathroomCount == null ? null : Number(pendingRaw.bathroomCount),
        balconyCount: pendingRaw.balconyCount == null ? null : Number(pendingRaw.balconyCount),
        kitchenCount: pendingRaw.kitchenCount == null ? null : Number(pendingRaw.kitchenCount),
        preferredDate: dateToKstYmd(asDate(pendingRaw.preferredDate)),
        preferredTime: pendingRaw.preferredTime == null ? null : String(pendingRaw.preferredTime),
        preferredTimeDetail:
          pendingRaw.preferredTimeDetail == null ? null : String(pendingRaw.preferredTimeDetail),
        buildingType: pendingRaw.buildingType == null ? null : String(pendingRaw.buildingType),
        moveInTiming: pendingRaw.moveInTiming ?? null,
        moveInDate: dateToKstYmd(asDate(pendingRaw.moveInDate)),
        moveInDateUndecided: pendingRaw.moveInDateUndecided === true,
        memo: pendingRaw.memo == null ? null : String(pendingRaw.memo),
      }
    : null;

  const submittedAt = asDate(form.submittedAt);
  const emailLog = asRecord(bundle?.emailLog);
  const payload = submittedAt
    ? {
        id: form.id,
        token: form.token,
        customerName: form.customerName,
        customerEmail: form.customerEmail,
        submittedAt: submittedAt.toISOString(),
        inquiryNumber: bundle?.inquiryNumber == null ? null : String(bundle.inquiryNumber),
        customerSubmissionSnapshot: form.customerSubmissionSnapshot ?? null,
        formConfig,
        publicBranding,
        publicCompanyTrust,
        submissionEmail: serializeSubmissionEmailLogPublic(
          emailLog
            ? {
                status: emailLog.status as never,
                toEmail: String(emailLog.toEmail ?? ''),
                lastError: emailLog.lastError == null ? null : String(emailLog.lastError),
                sentAt: asDate(emailLog.sentAt),
              }
            : null,
        ),
      }
    : {
        id: form.id,
        token: form.token,
        publicBranding,
        publicCompanyTrust,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        totalAmount: form.totalAmount,
        depositAmount: form.depositAmount,
        balanceAmount: form.balanceAmount,
        optionNote: form.optionNote,
        preferredDate: form.preferredDate,
        extraWorkNotice: form.extraWorkNotice === true,
        preferredTime: form.preferredTime,
        preferredTimeDetail: form.preferredTimeDetail,
        areaPyeong: form.areaPyeong,
        areaBasis: form.areaBasis,
        options: Array.isArray(bundle?.options) ? bundle.options : [],
        professionalOptions: Array.isArray(bundle?.professionalOptions) ? bundle.professionalOptions : [],
        formConfig,
        fillRules: toPublicFillRules(mergeOrderFormFillRules(cfg?.issueFillRules)),
        template,
        customAnswers: omitPreviewCleaningKind(token, form.customerAnswers),
        prefillAnswers: omitPreviewCleaningKind(token, form.prefillAnswers),
        draftCustomerSpecialNotes: form.customerSpecialNotes ?? null,
        pendingInquiry,
      };

  const result = {
    tenant: {
      id: String(tenant.id),
      slug: String(tenant.slug ?? ''),
      status: tenant.status,
      suspendReason: tenant.suspendReason ?? null,
      billingAccessBlockedAt: asDate(tenant.billingAccessBlockedAt),
    },
    payload,
  };
  bundleCache.set(cacheKey, result);
  return result;
}

export function assertBundleTenantOpen(tenant: {
  status: unknown;
  suspendReason: unknown;
}): void {
  if (
    isPlatformFullSuspend({
      status: tenant.status as never,
      suspendReason: tenant.suspendReason as never,
      billingAccessBlockedAt: null,
    })
  ) {
    throw new PublicTenantAccessError('서비스가 중지된 업체입니다.', 'tenant_suspended');
  }
}
