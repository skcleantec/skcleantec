import { useState } from 'react';
import {
  QUOTATION_SEAL_DISPLAY_WIDTH_DEFAULT,
  QUOTATION_SEAL_DISPLAY_WIDTH_MAX,
  QUOTATION_SEAL_DISPLAY_WIDTH_MIN,
  QUOTATION_SEAL_SOURCE_PX,
  resolveQuotationSealDisplayWidth,
} from '@shared/quotationSeal';
import type { TenantCompanyRegistration } from '@shared/tenantCompanyProfile';
import { uploadTenantCompanySeal } from '../../api/tenantCompanyProfile';
import { getToken } from '../../stores/auth';

type Props = {
  value: TenantCompanyRegistration;
  onChange: (next: TenantCompanyRegistration) => void;
  idPrefix?: string;
};

export function OperatingCompanyRegistrationFields({ value, onChange, idPrefix = 'oc-reg' }: Props) {
  const token = getToken();
  const [sealBusy, setSealBusy] = useState(false);
  const [sealErr, setSealErr] = useState<string | null>(null);

  const sealPreviewUrl = value.sealSecureUrl?.trim() || null;
  const sealWidthStr = String(value.sealDisplayWidthPx ?? QUOTATION_SEAL_DISPLAY_WIDTH_DEFAULT);

  const set = (key: keyof TenantCompanyRegistration, raw: string) => {
    onChange({ ...value, [key]: raw });
  };

  const parseSealWidth = (): number | 'bad' | 'default' => {
    const raw = sealWidthStr.trim();
    if (!raw) return 'default';
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return 'bad';
    if (n < QUOTATION_SEAL_DISPLAY_WIDTH_MIN || n > QUOTATION_SEAL_DISPLAY_WIDTH_MAX) return 'bad';
    return n;
  };

  const handleSealUpload = async (file: File) => {
    if (!token) return;
    if (file.type !== 'image/png') {
      setSealErr('직인은 PNG 파일만 업로드할 수 있습니다.');
      return;
    }
    const sealW = parseSealWidth();
    if (sealW === 'bad') {
      setSealErr(
        `직인 표시 크기는 ${QUOTATION_SEAL_DISPLAY_WIDTH_MIN}~${QUOTATION_SEAL_DISPLAY_WIDTH_MAX} px만 가능합니다.`,
      );
      return;
    }
    setSealBusy(true);
    setSealErr(null);
    try {
      const up = await uploadTenantCompanySeal(file, token, file.name || `seal_${Date.now()}.png`);
      onChange({
        ...value,
        sealPublicId: up.publicId,
        sealSecureUrl: up.secureUrl,
        sealDisplayWidthPx:
          sealW === 'default' ? undefined : resolveQuotationSealDisplayWidth(sealW),
      });
    } catch (e) {
      setSealErr(e instanceof Error ? e.message : '직인 업로드 실패');
    } finally {
      setSealBusy(false);
    }
  };

  const handleSealRemove = () => {
    if (!window.confirm('이 브랜드의 직인 이미지를 제거할까요?')) return;
    onChange({
      ...value,
      sealPublicId: '',
      sealSecureUrl: '',
      sealDisplayWidthPx: undefined,
    });
  };

  const handleSealWidthChange = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      onChange({ ...value, sealDisplayWidthPx: undefined });
      return;
    }
    const n = parseInt(trimmed, 10);
    if (!Number.isFinite(n)) return;
    onChange({ ...value, sealDisplayWidthPx: resolveQuotationSealDisplayWidth(n) });
  };

  return (
    <fieldset className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/80 p-3">
      <legend className="px-1 text-sm font-semibold text-gray-800">사업자 정보 (견적서 공급자)</legend>
      <p className="text-xs text-gray-500 -mt-1">
        이 브랜드 전용 상호·사업자번호·직인입니다. 비워 두면 업체 기본 사업자 정보가 사용됩니다.
      </p>
      <label className="block text-sm">
        <span className="font-medium text-gray-800">상호</span>
        <input
          id={`${idPrefix}-companyName`}
          value={value.companyName ?? ''}
          onChange={(e) => set('companyName', e.target.value)}
          className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-gray-800">대표자명</span>
        <input
          value={value.representativeName ?? ''}
          onChange={(e) => set('representativeName', e.target.value)}
          className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
        />
      </label>
      <div className="rounded-lg border border-gray-100 bg-white p-3 space-y-3">
        <div>
          <span className="text-sm font-medium text-gray-800">견적서 직인 (PNG)</span>
          <p className="mt-1 text-xs text-gray-500 leading-relaxed">
            이 브랜드 견적서에만 표시됩니다. 권장 원본:{' '}
            <strong>
              {QUOTATION_SEAL_SOURCE_PX}×{QUOTATION_SEAL_SOURCE_PX}px
            </strong>{' '}
            정사각 PNG (투명 배경). 비워 두면 업체 기본 직인이 사용됩니다.
          </p>
        </div>
        {sealErr ? (
          <p className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded px-2 py-1">{sealErr}</p>
        ) : null}
        <div className="flex flex-wrap items-end gap-2">
          <label className="block text-sm">
            <span className="text-gray-700">표시 너비 (px)</span>
            <input
              type="number"
              min={QUOTATION_SEAL_DISPLAY_WIDTH_MIN}
              max={QUOTATION_SEAL_DISPLAY_WIDTH_MAX}
              value={sealWidthStr}
              onChange={(e) => handleSealWidthChange(e.target.value)}
              className="mt-1 w-24 border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            disabled={sealBusy}
            onClick={() => document.getElementById(`${idPrefix}-seal-file`)?.click()}
            className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {sealBusy ? '처리 중…' : sealPreviewUrl ? '직인 교체' : '직인 업로드'}
          </button>
          <input
            id={`${idPrefix}-seal-file`}
            type="file"
            accept="image/png"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void handleSealUpload(f);
            }}
          />
          {sealPreviewUrl ? (
            <button
              type="button"
              disabled={sealBusy}
              onClick={handleSealRemove}
              className="rounded-md border border-rose-200 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            >
              직인 제거
            </button>
          ) : null}
        </div>
        {sealPreviewUrl ? (
          <div className="flex items-center gap-3 pt-1">
            <span className="text-xs text-gray-500">미리보기 (대표 옆)</span>
            <span className="text-sm text-gray-800 whitespace-nowrap">
              대표 {value.representativeName?.trim() || '○○○'}
              <img
                src={sealPreviewUrl}
                alt=""
                width={resolveQuotationSealDisplayWidth(value.sealDisplayWidthPx)}
                className="inline-block align-middle ml-0.5 object-contain"
                style={{
                  width: resolveQuotationSealDisplayWidth(value.sealDisplayWidthPx),
                  height: 'auto',
                  maxHeight: resolveQuotationSealDisplayWidth(value.sealDisplayWidthPx),
                  verticalAlign: 'middle',
                }}
              />
            </span>
          </div>
        ) : null}
      </div>
      <label className="block text-sm">
        <span className="font-medium text-gray-800">사업자등록번호</span>
        <input
          value={value.businessRegistrationNo ?? ''}
          onChange={(e) => set('businessRegistrationNo', e.target.value)}
          className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-gray-800">주소</span>
        <input
          value={value.addressLine ?? ''}
          onChange={(e) => set('addressLine', e.target.value)}
          className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
        />
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="font-medium text-gray-800">전화</span>
          <input
            value={value.phone ?? ''}
            onChange={(e) => set('phone', e.target.value)}
            className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-800">팩스</span>
          <input
            value={value.fax ?? ''}
            onChange={(e) => set('fax', e.target.value)}
            className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="font-medium text-gray-800">이메일</span>
        <input
          type="email"
          value={value.contactEmail ?? ''}
          onChange={(e) => set('contactEmail', e.target.value)}
          className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
        />
      </label>
    </fieldset>
  );
}

function pickRegistrationFields(
  source?: Partial<TenantCompanyRegistration>,
): TenantCompanyRegistration {
  const base: TenantCompanyRegistration = {
    companyName: source?.companyName ?? '',
    representativeName: source?.representativeName ?? '',
    businessRegistrationNo: source?.businessRegistrationNo ?? '',
    addressLine: source?.addressLine ?? '',
    phone: source?.phone ?? '',
    fax: source?.fax ?? '',
    contactEmail: source?.contactEmail ?? '',
  };
  const sealUrl = source?.sealSecureUrl?.trim();
  if (sealUrl && source?.sealPublicId?.trim()) {
    base.sealPublicId = source.sealPublicId.trim();
    base.sealSecureUrl = sealUrl;
    if (typeof source.sealDisplayWidthPx === 'number' && Number.isFinite(source.sealDisplayWidthPx)) {
      base.sealDisplayWidthPx = source.sealDisplayWidthPx;
    }
  }
  return base;
}

const COMPANY_REG_TEXT_KEYS = [
  'companyName',
  'representativeName',
  'businessRegistrationNo',
  'addressLine',
  'phone',
  'fax',
  'contactEmail',
] as const satisfies readonly (keyof TenantCompanyRegistration)[];

export function companyRegistrationFromForm(
  value: TenantCompanyRegistration,
): Partial<TenantCompanyRegistration> | undefined {
  const out: Partial<TenantCompanyRegistration> = {};
  for (const key of COMPANY_REG_TEXT_KEYS) {
    const raw = value[key];
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (trimmed) out[key] = trimmed;
  }
  const pid = typeof value.sealPublicId === 'string' ? value.sealPublicId.trim() : '';
  const surl = typeof value.sealSecureUrl === 'string' ? value.sealSecureUrl.trim() : '';
  if (pid && surl) {
    out.sealPublicId = pid;
    out.sealSecureUrl = surl;
    if (typeof value.sealDisplayWidthPx === 'number' && Number.isFinite(value.sealDisplayWidthPx)) {
      out.sealDisplayWidthPx = resolveQuotationSealDisplayWidth(value.sealDisplayWidthPx);
    }
  } else if (value.sealPublicId === '' && value.sealSecureUrl === '') {
    out.sealPublicId = '';
    out.sealSecureUrl = '';
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function emptyCompanyRegistrationForm(
  source?: Partial<TenantCompanyRegistration>,
): TenantCompanyRegistration {
  return pickRegistrationFields(source);
}
