import {
  QUOTATION_SEAL_DISPLAY_WIDTH_DEFAULT,
  QUOTATION_SEAL_DISPLAY_WIDTH_MAX,
  QUOTATION_SEAL_DISPLAY_WIDTH_MIN,
  QUOTATION_SEAL_SOURCE_PX,
} from '@shared/quotationSeal';
import { CompanyProfileSuccessModal } from './CompanyProfileSuccessModal';
import { useTenantCompanyProfileForm } from './useTenantCompanyProfileForm';

export function AdminTenantCompanyBusinessPage() {
  const form = useTenantCompanyProfileForm();

  if (form.loading) {
    return <div className="p-8 text-center text-gray-500 text-sm">불러오는 중…</div>;
  }

  return (
    <div className="min-w-0 w-full max-w-3xl space-y-6 pb-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">사업자 정보</h1>
        <p className="mt-1 text-sm text-gray-500">
          업체 기본 사업자 정보와 견적서 직인을 설정합니다. 영업 브랜드별 사업자 정보는「영업브랜드」에서
          관리합니다.
        </p>
      </div>

      {form.err ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
          {form.err}
        </p>
      ) : null}

      <section className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-gray-800">상호(회사명)</span>
            <input
              type="text"
              value={form.companyName}
              onChange={(e) => form.setCompanyName(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-800">대표자명</span>
            <input
              type="text"
              value={form.representativeName}
              onChange={(e) => form.setRepresentativeName(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="block sm:col-span-2 rounded-lg border border-gray-100 bg-gray-50/80 p-4 space-y-3">
            <div>
              <span className="text-sm font-medium text-gray-800">견적서 직인 (PNG)</span>
              <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                대표자명 옆에 표시됩니다. 권장 원본:{' '}
                <strong>
                  {QUOTATION_SEAL_SOURCE_PX}×{QUOTATION_SEAL_SOURCE_PX}px
                </strong>{' '}
                정사각 PNG (투명 배경). 화면·PDF 표시 너비 기본 {QUOTATION_SEAL_DISPLAY_WIDTH_DEFAULT}px.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block text-sm">
                <span className="text-gray-700">표시 너비 (px)</span>
                <input
                  type="number"
                  min={QUOTATION_SEAL_DISPLAY_WIDTH_MIN}
                  max={QUOTATION_SEAL_DISPLAY_WIDTH_MAX}
                  value={form.sealDisplayWidthPx}
                  onChange={(e) => form.setSealDisplayWidthPx(e.target.value)}
                  className="mt-1 w-24 rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <button
                type="button"
                disabled={form.sealBusy || !form.sealPreviewUrl}
                onClick={() => void form.handleSealWidthSave()}
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                표시 크기 저장
              </button>
              <button
                type="button"
                disabled={form.sealBusy}
                onClick={() => document.getElementById('tenant-company-seal-file')?.click()}
                className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {form.sealBusy ? '처리 중…' : form.sealPreviewUrl ? '직인 교체' : '직인 업로드'}
              </button>
              <input
                id="tenant-company-seal-file"
                type="file"
                accept="image/png"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void form.handleSealUpload(f);
                }}
              />
              {form.sealPreviewUrl ? (
                <button
                  type="button"
                  disabled={form.sealBusy}
                  onClick={() => void form.handleSealRemove()}
                  className="rounded-md border border-rose-200 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                >
                  직인 제거
                </button>
              ) : null}
            </div>
            {form.sealPreviewUrl ? (
              <div className="flex items-center gap-3 pt-1">
                <span className="text-xs text-gray-500">미리보기 (대표 옆)</span>
                <span className="text-sm text-gray-800 whitespace-nowrap">
                  대표 {form.representativeName.trim() || '○○○'}
                  <img
                    src={form.sealPreviewUrl}
                    alt=""
                    width={
                      Number(form.sealDisplayWidthPx) > 0
                        ? Number(form.sealDisplayWidthPx)
                        : QUOTATION_SEAL_DISPLAY_WIDTH_DEFAULT
                    }
                    className="inline-block align-middle ml-0.5 object-contain"
                    style={{
                      width:
                        Number(form.sealDisplayWidthPx) > 0
                          ? Number(form.sealDisplayWidthPx)
                          : QUOTATION_SEAL_DISPLAY_WIDTH_DEFAULT,
                      height: 'auto',
                      maxHeight:
                        Number(form.sealDisplayWidthPx) > 0
                          ? Number(form.sealDisplayWidthPx)
                          : QUOTATION_SEAL_DISPLAY_WIDTH_DEFAULT,
                      verticalAlign: 'middle',
                    }}
                  />
                </span>
              </div>
            ) : null}
          </div>
          <label className="block">
            <span className="text-sm font-medium text-gray-800">사업자등록번호</span>
            <input
              type="text"
              value={form.businessRegistrationNo}
              onChange={(e) => form.setBusinessRegistrationNo(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="000-00-00000"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-gray-800">사업장 주소</span>
            <input
              type="text"
              value={form.addressLine}
              onChange={(e) => form.setAddressLine(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-800">전화</span>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => form.setPhone(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-800">팩스</span>
            <input
              type="text"
              value={form.fax}
              onChange={(e) => form.setFax(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-gray-800">업체 대표 이메일</span>
            <input
              type="email"
              value={form.contactEmail}
              onChange={(e) => form.setContactEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="contact@company.com"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          <button
            type="button"
            disabled={form.busy}
            onClick={() => void form.handleSaveCompany()}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {form.busy ? '저장 중…' : '저장'}
          </button>
        </div>
      </section>

      <CompanyProfileSuccessModal message={form.successModal} onClose={() => form.setSuccessModal(null)} />
    </div>
  );
}
