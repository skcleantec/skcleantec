import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import type { CrewLayoutContext } from '../../components/layout/CrewLayout';
import { getCrewToken } from '../../stores/crewAuth';
import { patchCrewMemberAddress, patchCrewMemberDisplayNames, patchCrewMemberPhone } from '../../api/crew';
import { AuthSessionExpiredError } from '../../api/auth';
import { CrewBiLine, useCrewText } from '../../i18n/crew/crewI18n';
import { AddressSearch } from '../../components/forms/AddressSearch';
import { crewUiLanguageShowsAltMemberName } from '@shared/crewGroupSettings';
import { formatCrewHomeAddressLine } from '../../utils/crewHomeAddress';
import { toast } from '../../components/ui/Toast';
import { CREW_CARD, CREW_BTN_PRIMARY, CREW_SHELL } from './crewUi';
import { setToken } from '../../stores/auth';
import { DEV_PREVIEW_ADMIN_TOKEN_BACKUP_KEY } from '../../constants/devPreviewAuth';

export function CrewSettingsPage() {
  const outlet = useOutletContext<CrewLayoutContext | undefined>();
  const me = outlet?.me ?? null;
  const reloadMe = outlet?.reloadMe;
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [batchSaving, setBatchSaving] = useState(false);

  const [phoneModal, setPhoneModal] = useState<{
    teamMemberId: string;
    memberName: string;
    phone: string;
  } | null>(null);
  const [phoneDraft, setPhoneDraft] = useState('');
  const [phoneModalSaving, setPhoneModalSaving] = useState(false);

  const [addressModal, setAddressModal] = useState<{
    teamMemberId: string;
    memberName: string;
    address: string;
    addressDetail: string;
  } | null>(null);
  const [addressDraft, setAddressDraft] = useState('');
  const [addressDetailDraft, setAddressDetailDraft] = useState('');
  const [addressModalSaving, setAddressModalSaving] = useState(false);

  const t = useCrewText();
  const showAltDisplayName = crewUiLanguageShowsAltMemberName(me?.group.crewUiLanguage);

  useEffect(() => {
    if (!me || !showAltDisplayName) return;
    const next: Record<string, string> = {};
    for (const m of me.group.members) next[m.teamMemberId] = (m.nameTh ?? '').trim();
    setDraft(next);
    setDirtyIds(new Set());
  }, [me, showAltDisplayName]);

  const openPhoneModal = (teamMemberId: string, memberName: string, phone: string | null) => {
    setPhoneModal({ teamMemberId, memberName, phone: phone ?? '' });
    setPhoneDraft(phone ?? '');
  };

  const closePhoneModal = () => {
    setPhoneModal(null);
    setPhoneDraft('');
  };

  const savePhoneModal = useCallback(async () => {
    const token = getCrewToken();
    if (!token || !me || me.crewViewerRole !== 'LEADER' || !phoneModal) return;
    const phone = phoneDraft.trim() || null;
    setPhoneModalSaving(true);
    try {
      await patchCrewMemberPhone(token, phoneModal.teamMemberId, phone);
      await reloadMe?.();
      closePhoneModal();
      toast.success(t('crew.settings.saved'));
    } catch (e) {
      if (e instanceof AuthSessionExpiredError) {
        toast.error({ title: t('crew.settings.saveFail'), body: t('crew.roster.sessionExpired') });
        return;
      }
      toast.error({ title: t('crew.settings.saveFail'), body: e instanceof Error ? e.message : '' });
    } finally {
      setPhoneModalSaving(false);
    }
  }, [me, phoneModal, phoneDraft, reloadMe, t]);

  const openAddressModal = (
    teamMemberId: string,
    memberName: string,
    homeAddress: string | null,
    homeAddressDetail: string | null,
  ) => {
    setAddressModal({ teamMemberId, memberName, address: homeAddress ?? '', addressDetail: homeAddressDetail ?? '' });
    setAddressDraft(homeAddress ?? '');
    setAddressDetailDraft(homeAddressDetail ?? '');
  };

  const closeAddressModal = () => {
    setAddressModal(null);
    setAddressDraft('');
    setAddressDetailDraft('');
  };

  const saveAddressModal = useCallback(async () => {
    const token = getCrewToken();
    if (!token || !me || me.crewViewerRole !== 'LEADER' || !addressModal) return;
    const road = addressDraft.trim();
    const detail = addressDetailDraft.trim();
    if ((road && !detail) || (!road && detail)) {
      toast.error(t('crew.settings.addressRequired'));
      return;
    }
    setAddressModalSaving(true);
    try {
      await patchCrewMemberAddress(token, addressModal.teamMemberId, road || null, detail || null);
      await reloadMe?.();
      closeAddressModal();
      toast.success(t('crew.settings.saved'));
    } catch (e) {
      if (e instanceof AuthSessionExpiredError) {
        toast.error({ title: t('crew.settings.saveFail'), body: t('crew.roster.sessionExpired') });
        return;
      }
      toast.error({ title: t('crew.settings.saveFail'), body: e instanceof Error ? e.message : '' });
    } finally {
      setAddressModalSaving(false);
    }
  }, [me, addressModal, addressDraft, addressDetailDraft, reloadMe, t]);

  const clearAddressDraft = () => {
    setAddressDraft('');
    setAddressDetailDraft('');
  };

  const batchSave = useCallback(async () => {
    const token = getCrewToken();
    if (!token || !me || me.crewViewerRole !== 'LEADER' || dirtyIds.size === 0) return;
    const patches = [...dirtyIds].map((id) => ({
      teamMemberId: id,
      nameTh: (draft[id] ?? '').trim() || null,
    }));
    setBatchSaving(true);
    try {
      await patchCrewMemberDisplayNames(token, patches);
      await reloadMe?.();
      setDirtyIds(new Set());
      toast.success(t('crew.settings.saved'));
    } catch (e) {
      if (e instanceof AuthSessionExpiredError) {
        toast.error({ title: t('crew.settings.saveFail'), body: t('crew.roster.sessionExpired') });
        return;
      }
      toast.error({ title: t('crew.settings.saveFail'), body: e instanceof Error ? e.message : '' });
    } finally {
      setBatchSaving(false);
    }
  }, [me, draft, dirtyIds, reloadMe, t]);

  const goAdmin = () => {
    try {
      const backup = sessionStorage.getItem(DEV_PREVIEW_ADMIN_TOKEN_BACKUP_KEY);
      if (backup) {
        setToken(backup);
        sessionStorage.removeItem(DEV_PREVIEW_ADMIN_TOKEN_BACKUP_KEY);
        outlet?.setHasAdminBackup?.(false);
      }
    } catch {
      /* ignore */
    }
    navigate('/admin');
  };

  if (!outlet) {
    return (
      <p className="text-[13px] text-slate-600 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <CrewBiLine id="crew.common.outletMissing" />
      </p>
    );
  }

  if (!me) {
    return (
      <p className="text-[13px] text-slate-500 py-6 text-center">
        <CrewBiLine id="crew.common.loading" />
      </p>
    );
  }

  if (me.crewViewerRole !== 'LEADER') {
    return (
      <div className={`${CREW_CARD} p-4 space-y-3`}>
        <p className="text-[13px] text-slate-700">
          <CrewBiLine id="crew.settings.leaderOnly" />
        </p>
        <Link to="/crew" className="inline-block text-[13px] text-[#1D4ED8] underline">
          ← {t('crew.settings.backHome')}
        </Link>
      </div>
    );
  }

  const allMembers = me.group.members;
  const filteredMembers = allMembers.filter(
    (m) =>
      search === '' ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.nameTh ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-3 min-w-0 pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
      {/* ─── Search ─── */}
      <div className={CREW_CARD}>
        <input
          type="search"
          placeholder={t('crew.settings.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full min-h-11 px-4 text-[14px] bg-transparent border-0 outline-none placeholder:text-slate-400 rounded-2xl"
        />
      </div>

      {/* ─── Accordion rows ─── */}
      <div className={`${CREW_CARD} overflow-hidden`}>
        <ul className="divide-y divide-slate-100">
          {filteredMembers.map((m) => {
            const isExpanded = expandedId === m.teamMemberId;
            const isDirty = dirtyIds.has(m.teamMemberId);
            const thDisplay = (draft[m.teamMemberId] ?? '').trim() || (m.nameTh ?? '').trim();
            const phoneDisplay = m.phone ? m.phone.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1-$2-$3') : '—';
            const addrDisplay = formatCrewHomeAddressLine(m.homeAddress, m.homeAddressDetail);

            return (
              <li key={m.teamMemberId}>
                {/* Collapsed row */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : m.teamMemberId)}
                  className="w-full text-left min-h-11 px-4 py-3 flex items-center gap-2 min-w-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                      <span
                        className={`text-[13px] font-medium truncate ${
                          m.isActive ? 'text-[#0F172A]' : 'text-slate-400 line-through'
                        }`}
                      >
                        {m.name}
                      </span>
                      {thDisplay ? (
                        <span className="text-[12px] text-slate-500 truncate">{thDisplay}</span>
                      ) : null}
                      {isDirty ? (
                        <span className="shrink-0 rounded-lg bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                          {t('crew.settings.dirty')}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[12px] text-slate-400 mt-0.5 truncate">{phoneDisplay}</div>
                  </div>
                  <svg
                    className={`shrink-0 h-4 w-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {/* Expanded content */}
                {isExpanded ? (
                  <div className="px-4 pb-4 pt-0 space-y-3 bg-slate-50/60 border-t border-slate-100">
                    {showAltDisplayName ? (
                      <div>
                        <label className="block text-[12px] text-slate-600 mb-1">
                          <CrewBiLine id="crew.settings.colDisplayTh" />
                        </label>
                        <input
                          type="text"
                          className="w-full min-h-11 px-3 py-2 border border-slate-200 rounded-xl text-[14px] bg-white"
                          placeholder={t('crew.settings.placeholderTh')}
                          value={draft[m.teamMemberId] ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDraft((prev) => ({ ...prev, [m.teamMemberId]: val }));
                            setDirtyIds((prev) => {
                              const next = new Set(prev);
                              next.add(m.teamMemberId);
                              return next;
                            });
                          }}
                        />
                      </div>
                    ) : null}

                    {/* Phone */}
                    <div>
                      <label className="block text-[12px] text-slate-600 mb-1">
                        <CrewBiLine id="crew.settings.phoneLabel" />
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="flex-1 text-[14px] text-slate-700 tabular-nums">
                          {m.phone ?? '—'}
                        </span>
                        <button
                          type="button"
                          onClick={() => openPhoneModal(m.teamMemberId, m.name, m.phone)}
                          className="shrink-0 min-h-11 px-3 rounded-xl border border-slate-200 bg-white text-[12px] text-slate-700"
                        >
                          <CrewBiLine id="crew.settings.editPhone" />
                        </button>
                      </div>
                    </div>

                    {/* Address */}
                    <div>
                      <label className="block text-[12px] text-slate-600 mb-1">
                        <CrewBiLine id="crew.settings.editAddress" />
                      </label>
                      <div className="flex items-start gap-2">
                        <span className="flex-1 text-[13px] text-slate-600 leading-snug min-w-0 break-words">
                          {addrDisplay ?? '—'}
                        </span>
                        <button
                          type="button"
                          onClick={() => openAddressModal(m.teamMemberId, m.name, m.homeAddress, m.homeAddressDetail)}
                          className="shrink-0 min-h-11 px-3 rounded-xl border border-slate-200 bg-white text-[12px] text-slate-700"
                        >
                          <CrewBiLine id="crew.settings.editAddress" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Admin backup link */}
      {outlet.hasAdminBackup ? (
        <div className={`${CREW_CARD} px-4 py-3`}>
          <button
            type="button"
            onClick={goAdmin}
            className="text-[13px] text-[#1D4ED8] underline"
          >
            <CrewBiLine id="crew.layout.goAdmin" />
          </button>
        </div>
      ) : null}

      {/* ─── Sticky batch save ─── */}
      {showAltDisplayName && dirtyIds.size > 0 ? (
        <div
          className="fixed inset-x-0 z-20 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom,0px)]"
          style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className={`${CREW_SHELL} px-3 py-2`}>
            <button
              type="button"
              disabled={batchSaving}
              onClick={() => void batchSave()}
              className={CREW_BTN_PRIMARY}
            >
              {batchSaving
                ? t('crew.settings.saving')
                : t('crew.settings.batchSave')}
            </button>
          </div>
        </div>
      ) : null}

      {/* ─── Phone modal ─── */}
      {phoneModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !phoneModalSaving) closePhoneModal();
            }}
          >
            <div
              className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl bg-white shadow-lg border border-slate-200 p-4 sm:p-5"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <h2 className="text-[15px] font-semibold text-[#0F172A]">
                <CrewBiLine id="crew.settings.phoneModalTitle" />
                <span className="font-normal text-slate-500"> · {phoneModal.memberName}</span>
              </h2>
              <p className="text-[12px] text-slate-500 mt-1">
                <CrewBiLine id="crew.settings.phoneModalHint" />
              </p>
              <label className="block text-[12px] text-slate-600 mt-3 mb-1">
                <CrewBiLine id="crew.settings.phoneLabel" />
              </label>
              <input
                type="tel"
                autoComplete="tel"
                className="w-full min-h-11 px-3 py-2 border border-slate-200 rounded-xl text-[14px] tabular-nums"
                value={phoneDraft}
                onChange={(e) => setPhoneDraft(e.target.value)}
                disabled={phoneModalSaving}
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={phoneModalSaving}
                  onClick={closePhoneModal}
                  className="min-h-11 px-4 text-[13px] border border-slate-200 rounded-xl bg-white text-slate-700"
                >
                  {t('crew.settings.phoneModalCancel')}
                </button>
                <button
                  type="button"
                  disabled={phoneModalSaving}
                  onClick={() => void savePhoneModal()}
                  className="min-h-11 px-4 text-[13px] rounded-xl bg-[#0F172A] text-white font-semibold"
                >
                  {phoneModalSaving ? t('crew.settings.saving') : t('crew.settings.phoneModalSave')}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ─── Address modal ─── */}
      {addressModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !addressModalSaving) closeAddressModal();
            }}
          >
            <div
              className="w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-lg border border-slate-200 p-4 sm:p-5"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <h2 className="text-[15px] font-semibold text-[#0F172A]">
                <CrewBiLine id="crew.settings.addressModalTitle" />
                <span className="font-normal text-slate-500"> · {addressModal.memberName}</span>
              </h2>
              <p className="text-[12px] text-slate-500 mt-1 leading-snug">
                <CrewBiLine id="crew.settings.addressModalHint" />
              </p>
              <div className="mt-3 space-y-2">
                <label className="block text-[12px] text-slate-600">
                  <CrewBiLine id="crew.settings.addressLabel" />
                </label>
                <AddressSearch
                  value={addressDraft}
                  onChange={(next) => setAddressDraft(next)}
                  mobilePreferred
                  className="text-[14px]"
                />
                <label className="block text-[12px] text-slate-600 mt-2">
                  <CrewBiLine id="crew.settings.addressDetailLabel" />
                </label>
                <input
                  type="text"
                  className="w-full min-h-11 px-3 py-2 border border-slate-200 rounded-xl text-[14px]"
                  placeholder={t('crew.settings.addressDetailPlaceholder')}
                  value={addressDetailDraft}
                  onChange={(e) => setAddressDetailDraft(e.target.value)}
                  disabled={addressModalSaving}
                />
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={addressModalSaving}
                  onClick={clearAddressDraft}
                  className="min-h-11 px-3 text-[13px] border border-rose-200 rounded-xl bg-rose-50 text-rose-900"
                >
                  {t('crew.settings.addressClear')}
                </button>
                <button
                  type="button"
                  disabled={addressModalSaving}
                  onClick={closeAddressModal}
                  className="min-h-11 px-3 text-[13px] border border-slate-200 rounded-xl bg-white text-slate-700"
                >
                  {t('crew.settings.phoneModalCancel')}
                </button>
                <button
                  type="button"
                  disabled={addressModalSaving}
                  onClick={() => void saveAddressModal()}
                  className="min-h-11 px-4 text-[13px] rounded-xl bg-[#0F172A] text-white font-semibold"
                >
                  {addressModalSaving ? t('crew.settings.saving') : t('crew.settings.phoneModalSave')}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
