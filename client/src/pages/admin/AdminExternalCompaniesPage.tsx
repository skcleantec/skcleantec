import { useState, useEffect, useCallback } from 'react';
import { PageTitleWithFavorite } from '../../components/layout/NavFavoritePageTitle';
import { getToken } from '../../stores/auth';
import {
  listExternalCompanies,
  createExternalCompany,
  updateExternalCompany,
  deactivateExternalCompany,
  linkExternalCompanyPartnerTenant,
  listExternalMigrationEligibleInquiries,
  migrateExternalCompanyToPartner,
  type ExternalCompanyListItem,
  type MigrationEligibleInquiry,
} from '../../api/externalCompanies';
import { listTenantPartnerships, type TenantPartnershipItem } from '../../api/tenantPartners';
import { ModalCloseButton } from '../../components/admin/ModalCloseButton';
import { LoginCredentialsCopySheet } from '../../components/admin/LoginCredentialsCopySheet';
import { getMe } from '../../api/auth';
import type { LoginCredentialsCopyInput } from '../../utils/userLoginCopyText';
import { resolveLoginCopyPassword } from '../../utils/userLoginCopyText';
import { isExternalCompanyUsageDisabled } from '../../utils/externalCompanyUsage';
import {
  isPendingOnboardingContactName,
  onboardingContactNameForForm,
} from '@shared/profileOnboarding';

const externalMobileCardShell =
  'rounded-xl border border-gray-200 bg-white text-left shadow-sm overflow-hidden touch-manipulation';

const modalPrimaryBtn =
  'w-full sm:w-auto px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 touch-manipulation';
const modalSecondaryBtn =
  'w-full sm:w-auto px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 touch-manipulation';
const modalDangerBtn =
  'w-full sm:w-auto px-4 py-2.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 touch-manipulation';
const modalFooterClass =
  'shrink-0 flex flex-col-reverse sm:flex-row sm:flex-wrap sm:items-center gap-2 border-t border-gray-100 bg-white px-5 py-3';

const emptyCreateForm = () => ({
  name: '',
  loginEmail: '',
  loginPassword: '',
});

function externalCompanyMobileLine(row: ExternalCompanyListItem): { line: string; title: string } {
  const login =
    row.partnerUsers.length === 0
      ? '—'
      : row.partnerUsers[0].email +
        (!isPendingOnboardingContactName(row.partnerUsers[0].name)
          ? ` (${onboardingContactNameForForm(row.partnerUsers[0].name)})`
          : '');
  const partner = row.linkedPartnerTenant
    ? `${row.linkedPartnerTenant.name}(${row.linkedPartnerTenant.slug})`
    : '—';
  const segments = [
    row.name,
    row.bizNumber?.trim() || '—',
    row.phone?.trim() || '—',
    login,
    partner,
  ];
  return {
    line: segments.join(' · '),
    title: segments.join(' · '),
  };
}

const externalMobileActionBtn =
  'shrink-0 rounded border px-2 py-1 text-[11px] font-medium leading-none touch-manipulation whitespace-nowrap';

export function AdminExternalCompaniesPage() {
  const token = getToken();
  const [items, setItems] = useState<ExternalCompanyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [listErr, setListErr] = useState<string | null>(null);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [form, setForm] = useState({
    name: '',
    loginEmail: '',
    loginPassword: '',
  });

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateErr(null);
    setForm(emptyCreateForm());
  };

  const [editing, setEditing] = useState<ExternalCompanyListItem | null>(null);
  const [editFields, setEditFields] = useState({
    name: '',
    bizNumber: '',
    phone: '',
    memo: '',
    usageDisabled: false,
  });
  const [editPartnerPassword, setEditPartnerPassword] = useState('');

  const [migrating, setMigrating] = useState<ExternalCompanyListItem | null>(null);
  const [partnerships, setPartnerships] = useState<TenantPartnershipItem[]>([]);
  const [linkPartnerTenantId, setLinkPartnerTenantId] = useState('');
  const [eligibleItems, setEligibleItems] = useState<MigrationEligibleInquiry[]>([]);
  const [migrationPreview, setMigrationPreview] = useState<{ count: number; feeTotal: number } | null>(null);
  const [migrationBusy, setMigrationBusy] = useState(false);
  const [migrationErr, setMigrationErr] = useState<string | null>(null);
  const [tenantSlug, setTenantSlug] = useState('');
  const [loginCopyOpen, setLoginCopyOpen] = useState(false);
  const [loginCopyCredentials, setLoginCopyCredentials] = useState<LoginCredentialsCopyInput | null>(null);

  useEffect(() => {
    if (!token) return;
    getMe(token)
      .then((u: { tenant?: { slug?: string } | null }) => {
        setTenantSlug(typeof u.tenant?.slug === 'string' ? u.tenant.slug : '');
      })
      .catch(() => setTenantSlug(''));
  }, [token]);

  const load = () => {
    if (!token) return;
    setListErr(null);
    listExternalCompanies(token)
      .then((r) => setItems(r.items))
      .catch((e) => setListErr(e instanceof Error ? e.message : '불러오기 실패'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- token
  }, [token]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setCreateErr(null);
    try {
      const copyEmail = form.loginEmail.trim().toLowerCase();
      const copyPassword = form.loginPassword;
      await createExternalCompany(token, {
        name: form.name.trim(),
        login: {
          email: copyEmail,
          password: copyPassword,
        },
      });
      closeCreateModal();
      load();
      if (tenantSlug.trim()) {
        setLoginCopyCredentials({
          tenantSlug: tenantSlug.trim().toLowerCase(),
          email: copyEmail,
          password: copyPassword,
          accountLabel: '타업체',
        });
        setLoginCopyOpen(true);
      }
    } catch (e) {
      setCreateErr(e instanceof Error ? e.message : '등록 실패');
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (row: ExternalCompanyListItem) => {
    setEditing(row);
    setEditPartnerPassword('');
    setEditFields({
      name: row.name,
      bizNumber: row.bizNumber ?? '',
      phone: row.phone ?? '',
      memo: row.memo ?? '',
      usageDisabled: isExternalCompanyUsageDisabled(row.usageDisabledAt),
    });
  };

  const openEditLoginCopySheet = () => {
    if (!editing) return;
    const partner = editing.partnerUsers[0];
    if (!partner?.email?.trim()) {
      alert('로그인 계정이 없습니다.');
      return;
    }
    if (!tenantSlug.trim()) {
      alert('업체 코드를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    setLoginCopyCredentials({
      tenantSlug: tenantSlug.trim().toLowerCase(),
      email: partner.email.trim().toLowerCase(),
      password: resolveLoginCopyPassword(editPartnerPassword),
      accountLabel: '타업체',
    });
    setLoginCopyOpen(true);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editing) return;
    setSubmitting(true);
    try {
      await updateExternalCompany(token, editing.id, {
        name: editFields.name.trim(),
        bizNumber: editFields.bizNumber.trim() || null,
        phone: editFields.phone.trim() || null,
        memo: editFields.memo.trim() || null,
        usageDisabled: editFields.usageDisabled,
      });
      setEditing(null);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '수정 실패');
    } finally {
      setSubmitting(false);
    }
  };

  const openMigration = useCallback(
    async (row: ExternalCompanyListItem) => {
      if (!token) return;
      setMigrating(row);
      setMigrationErr(null);
      setMigrationPreview(null);
      setEligibleItems([]);
      setLinkPartnerTenantId(row.linkedPartnerTenant?.id ?? '');
      try {
        const [pRes, eRes] = await Promise.all([
          listTenantPartnerships(token),
          row.linkedPartnerTenant
            ? listExternalMigrationEligibleInquiries(token, row.id)
            : Promise.resolve({ items: [] as MigrationEligibleInquiry[] }),
        ]);
        setPartnerships(pRes.items.filter((p) => p.status === 'ACTIVE'));
        setEligibleItems(eRes.items);
      } catch (e) {
        setMigrationErr(e instanceof Error ? e.message : '불러오기 실패');
      }
    },
    [token],
  );

  const closeMigration = () => {
    setMigrating(null);
    setMigrationErr(null);
    setMigrationPreview(null);
    setEligibleItems([]);
    setLinkPartnerTenantId('');
  };

  const handleLinkPartner = async () => {
    if (!token || !migrating || !linkPartnerTenantId.trim()) {
      alert('연결할 파트너 업체를 선택해 주세요.');
      return;
    }
    setMigrationBusy(true);
    setMigrationErr(null);
    try {
      const linked = await linkExternalCompanyPartnerTenant(token, migrating.id, linkPartnerTenantId.trim());
      load();
      setMigrating((prev) =>
        prev
          ? {
              ...prev,
              linkedPartnerTenant: linked.linkedPartnerTenant,
              promotedAt: linked.promotedAt,
            }
          : prev,
      );
      const eRes = await listExternalMigrationEligibleInquiries(token, migrating.id);
      setEligibleItems(eRes.items);
    } catch (e) {
      setMigrationErr(e instanceof Error ? e.message : '파트너 연결 실패');
    } finally {
      setMigrationBusy(false);
    }
  };

  const handleMigrationDryRun = async () => {
    if (!token || !migrating) return;
    setMigrationBusy(true);
    setMigrationErr(null);
    try {
      const result = await migrateExternalCompanyToPartner(token, migrating.id, {
        allEligible: true,
        dryRun: true,
      });
      setMigrationPreview({ count: result.count, feeTotal: result.feeTotal });
      setEligibleItems(result.items);
    } catch (e) {
      setMigrationErr(e instanceof Error ? e.message : '미리보기 실패');
    } finally {
      setMigrationBusy(false);
    }
  };

  const handleMigrationExecute = async () => {
    if (!token || !migrating) return;
    if (eligibleItems.length === 0) {
      alert('이관할 접수가 없습니다.');
      return;
    }
    if (
      !window.confirm(
        `"${migrating.name}" 타업체 DB ${eligibleItems.length}건을 파트너 연계로 이관할까요?\n타업체 정산(수수료)은 그대로 유지됩니다.`,
      )
    ) {
      return;
    }
    setMigrationBusy(true);
    setMigrationErr(null);
    try {
      const result = await migrateExternalCompanyToPartner(token, migrating.id, {
        allEligible: true,
        dryRun: false,
      });
      if (result.errors.length > 0) {
        alert(
          `완료 ${result.migrated.length}건 · 실패 ${result.errors.length}건\n${result.errors
            .slice(0, 3)
            .map((e) => e.error)
            .join('\n')}`,
        );
      } else {
        alert(`${result.migrated.length}건을 파트너 DB로 이관했습니다.`);
      }
      closeMigration();
      load();
    } catch (e) {
      setMigrationErr(e instanceof Error ? e.message : '이관 실패');
    } finally {
      setMigrationBusy(false);
    }
  };

  /** 업체·소속 로그인 계정 비활성 처리(목록에서 제거됨) */
  const handleDelete = async (row: ExternalCompanyListItem) => {
    if (!token) return;
    if (
      !window.confirm(
        `"${row.name}" 타업체를 삭제할까요?\n업체와 소속 로그인 계정이 비활성화되며, 이후 해당 계정으로 로그인할 수 없습니다.`
      )
    ) {
      return;
    }
    setSubmitting(true);
    try {
      await deactivateExternalCompany(token, row.id);
      setEditing((prev) => (prev?.id === row.id ? null : prev));
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 min-w-0 w-full max-w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <PageTitleWithFavorite label="타업체">
          <h1 className="text-xl font-semibold text-gray-800">타업체</h1>
        </PageTitleWithFavorite>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreateErr(null);
            setShowCreateModal(true);
          }}
          className="w-full sm:w-auto shrink-0 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 touch-manipulation"
        >
          타업체 등록
        </button>
      </div>

      {listErr && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2">{listErr}</div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-base font-medium text-gray-800">등록된 타업체</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">불러오는 중…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">등록된 타업체가 없습니다.</div>
        ) : (
          <>
            <div className="flex flex-col gap-2 p-2 lg:hidden">
              {items.map((row) => {
                const { title } = externalCompanyMobileLine(row);
                return (
                  <div key={row.id} className={externalMobileCardShell}>
                    <div className="px-2.5 py-2">
                      <p
                        className="min-w-0 truncate text-fluid-2xs text-gray-600 leading-snug"
                        title={title}
                      >
                        <span className="font-semibold text-gray-900">{row.name}</span>
                        {isExternalCompanyUsageDisabled(row.usageDisabledAt) ? (
                          <span className="ml-1 inline-flex align-middle rounded bg-amber-50 border border-amber-200 px-1 py-px text-[10px] font-medium text-amber-900">
                            사용안함
                          </span>
                        ) : null}
                        <span className="text-gray-400"> · </span>
                        <span className="tabular-nums">{row.bizNumber?.trim() || '—'}</span>
                        <span className="text-gray-400"> · </span>
                        <span className="tabular-nums">{row.phone?.trim() || '—'}</span>
                        <span className="text-gray-400"> · </span>
                        <span className="tabular-nums">
                          {row.partnerUsers[0]?.email ?? '—'}
                        </span>
                        <span className="text-gray-400"> · </span>
                        <span>
                          {row.linkedPartnerTenant
                            ? row.linkedPartnerTenant.name
                            : '—'}
                        </span>
                      </p>
                      <div className="mt-1.5 flex flex-nowrap items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <button
                          type="button"
                          onClick={() => void openMigration(row)}
                          className={`${externalMobileActionBtn} border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100`}
                        >
                          DB이관
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className={`${externalMobileActionBtn} border-gray-200 bg-white text-blue-700 hover:bg-gray-50`}
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(row)}
                          disabled={submitting}
                          className={`${externalMobileActionBtn} border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-50`}
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              className="hidden lg:block w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain -mx-4 px-4 sm:mx-0 sm:px-0"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <table className="min-w-full text-sm table-fixed w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    <th className="px-4 py-2 font-medium text-center">업체명</th>
                    <th className="px-4 py-2 font-medium text-center">사업자번호</th>
                    <th className="px-4 py-2 font-medium text-center">연락처</th>
                    <th className="px-4 py-2 font-medium text-center">로그인 계정</th>
                    <th className="px-4 py-2 font-medium text-center">파트너 연결</th>
                    <th className="px-4 py-2 font-medium text-center w-52">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-t border-gray-100">
                      <td className="px-4 py-2 font-medium text-gray-900 text-center">
                        <span className="truncate inline-block max-w-full" title={row.name}>
                          {row.name}
                        </span>
                        {isExternalCompanyUsageDisabled(row.usageDisabledAt) ? (
                          <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                            사용 안 함
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2 text-gray-600 text-center">{row.bizNumber ?? '—'}</td>
                      <td className="px-4 py-2 text-gray-600 text-center">{row.phone ?? '—'}</td>
                      <td className="px-4 py-2 text-gray-600 text-center">
                        {row.partnerUsers.length === 0 ? (
                          '—'
                        ) : (
                          <ul className="space-y-0.5">
                            {row.partnerUsers.map((u) => (
                              <li key={u.id} className="tabular-nums truncate" title={`${u.email} (${u.name})`}>
                                {u.email} <span className="text-gray-400">({u.name})</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-600 text-xs text-center">
                        {row.linkedPartnerTenant ? (
                          <span>
                            {row.linkedPartnerTenant.name}
                            <span className="block text-gray-400">({row.linkedPartnerTenant.slug})</span>
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => void openMigration(row)}
                          className="text-indigo-700 hover:underline text-xs mr-2 font-medium"
                        >
                          DB 이관
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="text-blue-600 hover:underline text-xs mr-2"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(row)}
                          className="text-red-600 hover:underline text-xs font-medium"
                          disabled={submitting}
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {showCreateModal && (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="external-create-title"
        >
          <div className="relative bg-white rounded-lg shadow-lg max-w-lg w-full max-h-[min(90dvh,720px)] flex flex-col mx-auto sm:mx-0">
            <ModalCloseButton onClick={() => !submitting && closeCreateModal()} disabled={submitting} />
            <div className="px-5 pt-4 pb-3 border-b border-gray-100 shrink-0">
              <h3 id="external-create-title" className="text-lg font-semibold text-gray-800 pr-10">
                타업체 등록
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                업체명·로그인 계정만 등록합니다. 사업자 정보·담당자 정보는 타업체가 첫 로그인 시 입력합니다.
              </p>
            </div>
            <form onSubmit={handleCreate} className="flex flex-col flex-1 min-h-0 text-sm">
              <div className="px-5 py-4 overflow-y-auto space-y-3 flex-1 min-h-0">
                {createErr && (
                  <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2">
                    {createErr}
                  </div>
                )}
                <div>
                  <label className="block text-gray-600 mb-1">업체명 *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base sm:text-sm"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-gray-600 mb-1">아이디 *</label>
                    <input
                      value={form.loginEmail}
                      onChange={(e) => setForm((p) => ({ ...p, loginEmail: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base sm:text-sm"
                      required
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1">비밀번호 *</label>
                    <input
                      type="password"
                      value={form.loginPassword}
                      onChange={(e) => setForm((p) => ({ ...p, loginPassword: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base sm:text-sm"
                      required
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              </div>
              <div className={modalFooterClass}>
                <button type="submit" disabled={submitting} className={modalPrimaryBtn}>
                  {submitting ? '등록 중…' : '등록'}
                </button>
                <button
                  type="button"
                  onClick={() => !submitting && closeCreateModal()}
                  disabled={submitting}
                  className={modalSecondaryBtn}
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="external-edit-title"
        >
          <div className="relative bg-white rounded-lg shadow-lg max-w-lg w-full max-h-[min(90dvh,720px)] flex flex-col mx-auto sm:mx-0">
            <div className="absolute right-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-col items-end gap-1.5 sm:flex-row sm:items-center">
              {editing.partnerUsers[0] ? (
                <button
                  type="button"
                  onClick={openEditLoginCopySheet}
                  className="shrink-0 rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 text-fluid-2xs font-medium text-slate-800 hover:bg-slate-100 active:bg-slate-200 touch-manipulation"
                  title="업체 코드·아이디·비밀번호 로그인 안내 복사"
                >
                  로그인 안내 복사
                </button>
              ) : null}
              <ModalCloseButton
                onClick={() => setEditing(null)}
                className="!static shrink-0 shadow-none"
              />
            </div>
            <div className="px-5 pt-4 pb-3 border-b border-gray-100 shrink-0">
              <h3 id="external-edit-title" className="text-lg font-semibold text-gray-800 pr-4 sm:pr-32">
                타업체 정보 수정
              </h3>
            </div>
            <form onSubmit={handleEditSave} className="flex flex-col flex-1 min-h-0 text-sm min-w-0">
              <div className="px-5 py-4 overflow-y-auto space-y-3 flex-1 min-h-0 min-w-0">
              <div>
                <label className="block text-sm text-gray-600 mb-1">업체명</label>
                <input
                  value={editFields.name}
                  onChange={(e) => setEditFields((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">사업자등록번호</label>
                <input
                  value={editFields.bizNumber}
                  onChange={(e) => setEditFields((p) => ({ ...p, bizNumber: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">대표 연락처</label>
                <input
                  value={editFields.phone}
                  onChange={(e) => setEditFields((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
              {editing.partnerUsers[0] ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                  <p className="text-sm font-medium text-gray-800">담당자</p>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    타업체 로그인 계정(온보딩)에서 입력한 정보입니다. 수정은 타업체 본인만 가능합니다.
                  </p>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">담당자 이름</label>
                    <input
                      value={
                        isPendingOnboardingContactName(editing.partnerUsers[0].name)
                          ? ''
                          : onboardingContactNameForForm(editing.partnerUsers[0].name)
                      }
                      readOnly
                      placeholder="미입력"
                      className="w-full px-3 py-2 border border-gray-200 rounded text-sm bg-white text-gray-700 placeholder:text-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">담당자 연락처</label>
                    <input
                      value={editing.partnerUsers[0].phone?.trim() ?? ''}
                      readOnly
                      placeholder="미입력"
                      className="w-full px-3 py-2 border border-gray-200 rounded text-sm bg-white text-gray-700 placeholder:text-gray-400"
                    />
                  </div>
                </div>
              ) : null}
              <div>
                <label className="block text-sm text-gray-600 mb-1">사업자등록증</label>
                {editing.businessRegistrationImageUrl ? (
                  <a
                    href={editing.businessRegistrationImageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg border border-gray-200 bg-gray-50 p-2 hover:bg-gray-100/80"
                  >
                    <img
                      src={editing.businessRegistrationImageUrl}
                      alt="사업자등록증"
                      className="mx-auto max-h-48 w-full object-contain rounded"
                    />
                    <p className="mt-2 text-center text-xs text-blue-600">새 창에서 크게 보기</p>
                  </a>
                ) : (
                  <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-center text-xs text-gray-500">
                    등록된 사업자등록증 이미지 없음
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">메모</label>
                <textarea
                  value={editFields.memo}
                  onChange={(e) => setEditFields((p) => ({ ...p, memo: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
              {editing.partnerUsers[0] ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                  <p className="text-sm font-medium text-gray-800">로그인 계정</p>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">아이디</label>
                    <input
                      value={editing.partnerUsers[0].email}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-200 rounded text-sm bg-white text-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      새 비밀번호 (선택 · 로그인 안내 복사용)
                    </label>
                    <input
                      type="password"
                      value={editPartnerPassword}
                      onChange={(e) => setEditPartnerPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      placeholder="입력 시 복사 텍스트에 포함"
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              ) : null}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                <p className="text-sm font-medium text-gray-800">신규 사용</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  「사용 안 함」은 새 배정·DB마켓 노출·캘린더 추가에서만 제외합니다. 기존 배정·정산·로그인은
                  유지됩니다. 완전 삭제는 아래 「삭제」를 사용하세요.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <label className="inline-flex flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm touch-manipulation">
                    <input
                      type="radio"
                      name="external-usage"
                      checked={!editFields.usageDisabled}
                      onChange={() => setEditFields((p) => ({ ...p, usageDisabled: false }))}
                    />
                    사용 중
                  </label>
                  <label className="inline-flex flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm touch-manipulation">
                    <input
                      type="radio"
                      name="external-usage"
                      checked={editFields.usageDisabled}
                      onChange={() => setEditFields((p) => ({ ...p, usageDisabled: true }))}
                    />
                    사용 안 함
                  </label>
                </div>
              </div>
              </div>
              <div className={modalFooterClass}>
                <button type="submit" disabled={submitting} className={modalPrimaryBtn}>
                  저장
                </button>
                <button type="button" onClick={() => setEditing(null)} className={modalSecondaryBtn}>
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => editing && void handleDelete(editing)}
                  disabled={submitting}
                  className={`${modalDangerBtn} sm:ml-auto`}
                >
                  삭제
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {migrating ? (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="external-migrate-title"
        >
          <div className="relative bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[min(90dvh,720px)] flex flex-col">
            <ModalCloseButton onClick={() => !migrationBusy && closeMigration()} disabled={migrationBusy} />
            <div className="px-5 pt-4 pb-3 border-b border-gray-100 shrink-0">
              <h3 id="external-migrate-title" className="text-lg font-semibold text-gray-800 pr-10">
                DB 파트너 이관 — {migrating.name}
              </h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                접수를 파트너 mirror로 옮깁니다. 타업체 정산·지급 이력은 그대로 유지됩니다.
              </p>
            </div>
            <div className="px-5 py-4 overflow-y-auto space-y-4 text-sm flex-1 min-h-0">
              {migrationErr ? (
                <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2">
                  {migrationErr}
                </div>
              ) : null}

              <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 space-y-2">
                <p className="text-xs font-semibold text-indigo-900">1. 정식 파트너 업체 연결</p>
                {migrating.linkedPartnerTenant ? (
                  <p className="text-xs text-gray-700">
                    연결됨: <strong>{migrating.linkedPartnerTenant.name}</strong> (
                    {migrating.linkedPartnerTenant.slug})
                  </p>
                ) : (
                  <>
                    <select
                      value={linkPartnerTenantId}
                      onChange={(e) => setLinkPartnerTenantId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded bg-white text-sm"
                    >
                      <option value="">ACTIVE 파트너 선택</option>
                      {partnerships.map((p) => (
                        <option key={p.id} value={p.partner.id}>
                          {p.partner.name} ({p.partner.slug})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={migrationBusy || !linkPartnerTenantId.trim()}
                      onClick={() => void handleLinkPartner()}
                      className="w-full sm:w-auto px-3 py-2.5 rounded-lg bg-indigo-600 text-white text-xs font-medium disabled:opacity-50 touch-manipulation"
                    >
                      파트너 연결 저장
                    </button>
                  </>
                )}
              </div>

              {migrating.linkedPartnerTenant || linkPartnerTenantId ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-800">2. 이관 대상 ({eligibleItems.length}건)</p>
                  {migrationPreview ? (
                    <p className="text-xs text-gray-600 tabular-nums">
                      미리보기: {migrationPreview.count}건 · 수수료 합{' '}
                      {migrationPreview.feeTotal.toLocaleString('ko-KR')}원 (정산 변화 없음)
                    </p>
                  ) : null}
                  {eligibleItems.length === 0 ? (
                    <p className="text-xs text-gray-500">이관 가능한 접수가 없습니다.</p>
                  ) : (
                    <ul className="max-h-40 overflow-y-auto border border-gray-200 rounded divide-y text-xs">
                      {eligibleItems.slice(0, 20).map((it) => (
                        <li key={it.id} className="px-2 py-1.5 flex justify-between gap-2">
                          <span className="truncate">
                            {it.inquiryNumber ?? '—'} · {it.customerName}
                          </span>
                          <span className="shrink-0 tabular-nums text-gray-500">
                            {(it.externalTransferFee ?? 0).toLocaleString('ko-KR')}원
                          </span>
                        </li>
                      ))}
                      {eligibleItems.length > 20 ? (
                        <li className="px-2 py-1 text-gray-400">외 {eligibleItems.length - 20}건…</li>
                      ) : null}
                    </ul>
                  )}
                  <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      disabled={migrationBusy || !migrating.linkedPartnerTenant}
                      onClick={() => void handleMigrationDryRun()}
                      className="w-full sm:w-auto px-3 py-2.5 rounded-lg border border-gray-300 text-xs touch-manipulation"
                    >
                      미리보기
                    </button>
                    <button
                      type="button"
                      disabled={migrationBusy || eligibleItems.length === 0 || !migrating.linkedPartnerTenant}
                      onClick={() => void handleMigrationExecute()}
                      className="w-full sm:w-auto px-3 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-medium disabled:opacity-50 touch-manipulation"
                    >
                      {migrationBusy ? '처리 중…' : '전량 이관 실행'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      <LoginCredentialsCopySheet
        open={loginCopyOpen}
        onClose={() => setLoginCopyOpen(false)}
        credentials={loginCopyCredentials}
      />
    </div>
  );
}
