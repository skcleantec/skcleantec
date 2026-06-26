import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useOutletContext } from 'react-router-dom';
import type { CrewLayoutContext } from '../../components/layout/CrewLayout';
import { getCrewToken } from '../../stores/crewAuth';
import { patchCrewMemberAddress, patchCrewMemberDisplayNames, patchCrewMemberPhone } from '../../api/crew';
import { AuthSessionExpiredError } from '../../api/auth';
import { CrewBiLine, useCrewText } from '../../i18n/crew/crewI18n';
import { AddressSearch } from '../../components/forms/AddressSearch';
import { formatCrewHomeAddressLine } from '../../utils/crewHomeAddress';

export function CrewSettingsPage() {
  const outlet = useOutletContext<CrewLayoutContext | undefined>();
  const me = outlet?.me ?? null;
  const reloadMe = outlet?.reloadMe;

  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savingDisplayId, setSavingDisplayId] = useState<string | null>(null);

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

  const [introHelpOpen, setIntroHelpOpen] = useState(false);
  const t = useCrewText();

  useEffect(() => {
    if (!me) return;
    const next: Record<string, string> = {};
    for (const m of me.group.members) next[m.teamMemberId] = (m.nameTh ?? '').trim();
    setDraft(next);
  }, [me]);

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
      alert(t('crew.settings.saved'));
    } catch (e) {
      if (e instanceof AuthSessionExpiredError) {
        alert(`${t('crew.settings.saveFail')}\n세션이 만료되었습니다.`);
        return;
      }
      const msg = e instanceof Error ? e.message : t('crew.settings.saveFail');
      alert(`${t('crew.settings.saveFail')}\n${msg}`);
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
    setAddressModal({
      teamMemberId,
      memberName,
      address: homeAddress ?? '',
      addressDetail: homeAddressDetail ?? '',
    });
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
      alert(t('crew.settings.addressRequired'));
      return;
    }
    setAddressModalSaving(true);
    try {
      await patchCrewMemberAddress(
        token,
        addressModal.teamMemberId,
        road || null,
        detail || null,
      );
      await reloadMe?.();
      closeAddressModal();
      alert(t('crew.settings.saved'));
    } catch (e) {
      if (e instanceof AuthSessionExpiredError) {
        alert(`${t('crew.settings.saveFail')}\n세션이 만료되었습니다.`);
        return;
      }
      const msg = e instanceof Error ? e.message : t('crew.settings.saveFail');
      alert(`${t('crew.settings.saveFail')}\n${msg}`);
    } finally {
      setAddressModalSaving(false);
    }
  }, [me, addressModal, addressDraft, addressDetailDraft, reloadMe, t]);

  const clearAddressDraft = () => {
    setAddressDraft('');
    setAddressDetailDraft('');
  };

  const saveDisplayOne = useCallback(
    async (teamMemberId: string) => {
      const token = getCrewToken();
      if (!token || !me || me.crewViewerRole !== 'LEADER') return;
      const nameTh = (draft[teamMemberId] ?? '').trim() || null;
      setSavingDisplayId(teamMemberId);
      try {
        await patchCrewMemberDisplayNames(token, [{ teamMemberId, nameTh }]);
        await reloadMe?.();
        alert(t('crew.settings.saved'));
      } catch (e) {
        if (e instanceof AuthSessionExpiredError) {
          alert(`${t('crew.settings.saveFail')}\n세션이 만료되었습니다.`);
          return;
        }
        const msg = e instanceof Error ? e.message : t('crew.settings.saveFail');
        alert(`${t('crew.settings.saveFail')}\n${msg}`);
      } finally {
        setSavingDisplayId(null);
      }
    },
    [me, draft, reloadMe, t],
  );

  if (!outlet) {
    return (
      <p className="text-sm text-gray-600 bg-amber-50 border border-amber-200 rounded-lg p-4">
        화면 레이아웃을 불러오지 못했습니다.
      </p>
    );
  }

  if (!me) {
    return (
      <p className="text-sm text-gray-500">
        <CrewBiLine id="crew.common.loading" />
      </p>
    );
  }

  if (me.crewViewerRole !== 'LEADER') {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <p className="text-fluid-sm text-gray-700">
          <CrewBiLine id="crew.settings.leaderOnly" />
        </p>
        <Link
          to="/crew"
          className="inline-block text-sm text-indigo-700 underline hover:text-indigo-900"
        >
          ← {t('crew.settings.backHome')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2 min-w-0">
      <div className="bg-white border border-gray-200 rounded-lg px-2 py-1.5">
        <div className="flex items-start gap-1.5 min-w-0">
          <h1 className="text-xs font-semibold text-gray-900 leading-tight min-w-0 flex-1">
            <CrewBiLine id="crew.settings.title" koClassName="font-semibold" />
          </h1>
          <button
            type="button"
            aria-expanded={introHelpOpen}
            aria-label={t('crew.settings.helpToggleAria')}
            onClick={() => setIntroHelpOpen((v) => !v)}
            className="shrink-0 mt-0.5 w-6 h-6 rounded-full border border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100 flex items-center justify-center"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor" aria-hidden>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />
            </svg>
          </button>
        </div>
        {introHelpOpen ? (
          <div className="mt-1.5 p-2 rounded-md border border-gray-200 bg-gray-50 text-[0.58rem] text-gray-600 leading-snug">
            <CrewBiLine id="crew.settings.intro" />
          </div>
        ) : null}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <ul className="divide-y divide-gray-100">
          {me.group.members.map((m) => {
            const rowSaving = savingDisplayId === m.teamMemberId;
            return (
              <li key={m.teamMemberId} className="px-1.5 py-1.5 min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 min-w-0">
                  <span
                    className={`shrink-0 text-[0.7rem] font-medium truncate max-w-[4.25rem] sm:max-w-[5.5rem] ${
                      m.isActive ? 'text-gray-900' : 'text-gray-400 line-through'
                    }`}
                    title={m.name}
                  >
                    {m.name}
                  </span>
                  <input
                    type="text"
                    className="flex-1 min-w-[6rem] text-[0.65rem] py-0.5 px-1 border border-gray-300 rounded leading-tight min-h-0"
                    placeholder={t('crew.settings.placeholderTh')}
                    aria-label={t('crew.settings.colDisplayTh')}
                    value={draft[m.teamMemberId] ?? ''}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, [m.teamMemberId]: e.target.value }))
                    }
                    disabled={rowSaving}
                  />
                  <button
                    type="button"
                    disabled={rowSaving}
                    onClick={() => void saveDisplayOne(m.teamMemberId)}
                    className="shrink-0 text-[0.58rem] px-1.5 py-0.5 bg-gray-900 text-white rounded leading-none disabled:opacity-50"
                  >
                    {rowSaving ? '…' : t('crew.settings.save')}
                  </button>
                  <span
                    className="text-[0.58rem] text-gray-500 tabular-nums shrink-0 truncate max-w-[5.5rem] sm:max-w-[6.5rem]"
                    title={m.phone ?? ''}
                  >
                    {m.phone ?? '—'}
                  </span>
                  <button
                    type="button"
                    onClick={() => openPhoneModal(m.teamMemberId, m.name, m.phone)}
                    className="shrink-0 text-[0.55rem] px-1 py-0.5 border border-gray-300 rounded bg-white text-gray-700 leading-none"
                  >
                    {t('crew.settings.editPhone')}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 min-w-0 pl-0.5">
                  <span
                    className="text-[0.58rem] text-gray-500 shrink-0 min-w-0 flex-1 truncate max-w-full sm:max-w-[12rem]"
                    title={formatCrewHomeAddressLine(m.homeAddress, m.homeAddressDetail) ?? ''}
                  >
                    {formatCrewHomeAddressLine(m.homeAddress, m.homeAddressDetail) ?? '—'}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      openAddressModal(m.teamMemberId, m.name, m.homeAddress, m.homeAddressDetail)
                    }
                    className="shrink-0 text-[0.55rem] px-1 py-0.5 border border-emerald-300 rounded bg-emerald-50 text-emerald-900 leading-none"
                  >
                    {t('crew.settings.editAddress')}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

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
              className="w-full max-w-sm rounded-t-xl sm:rounded-xl bg-white shadow-lg border border-gray-200 p-3 sm:p-4"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <h2 className="text-xs font-semibold text-gray-900">
                <CrewBiLine id="crew.settings.phoneModalTitle" koClassName="font-semibold" />
                <span className="font-normal text-gray-600"> · {phoneModal.memberName}</span>
              </h2>
              <p className="text-[0.58rem] text-gray-500 mt-1">
                <CrewBiLine id="crew.settings.phoneModalHint" />
              </p>
              <label className="block text-[0.58rem] text-gray-600 mt-2 mb-0.5">
                <CrewBiLine id="crew.settings.phoneLabel" />
              </label>
              <input
                type="tel"
                autoComplete="tel"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm tabular-nums"
                value={phoneDraft}
                onChange={(e) => setPhoneDraft(e.target.value)}
                disabled={phoneModalSaving}
              />
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={phoneModalSaving}
                  onClick={closePhoneModal}
                  className="px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-800"
                >
                  {t('crew.settings.phoneModalCancel')}
                </button>
                <button
                  type="button"
                  disabled={phoneModalSaving}
                  onClick={() => void savePhoneModal()}
                  className="px-2 py-1 text-xs rounded bg-gray-900 text-white"
                >
                  {phoneModalSaving ? t('crew.settings.saving') : t('crew.settings.phoneModalSave')}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

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
              className="w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-t-xl sm:rounded-xl bg-white shadow-lg border border-gray-200 p-3 sm:p-4"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <h2 className="text-xs font-semibold text-gray-900">
                <CrewBiLine id="crew.settings.addressModalTitle" koClassName="font-semibold" />
                <span className="font-normal text-gray-600"> · {addressModal.memberName}</span>
              </h2>
              <p className="text-[0.58rem] text-gray-500 mt-1 leading-snug">
                <CrewBiLine id="crew.settings.addressModalHint" />
              </p>
              <div className="mt-3 space-y-2">
                <label className="block text-[0.58rem] text-gray-600">
                  <CrewBiLine id="crew.settings.addressLabel" />
                </label>
                <AddressSearch
                  value={addressDraft}
                  onChange={(next) => setAddressDraft(next)}
                  mobilePreferred
                  className="text-sm"
                />
                <label className="block text-[0.58rem] text-gray-600 mt-2">
                  <CrewBiLine id="crew.settings.addressDetailLabel" />
                </label>
                <input
                  type="text"
                  className="w-full px-2 py-2 border border-gray-300 rounded text-sm"
                  placeholder={t('crew.settings.addressDetailPlaceholder')}
                  value={addressDetailDraft}
                  onChange={(e) => setAddressDetailDraft(e.target.value)}
                  disabled={addressModalSaving}
                />
              </div>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={addressModalSaving}
                  onClick={clearAddressDraft}
                  className="px-2 py-1 text-xs border border-rose-200 rounded bg-rose-50 text-rose-900"
                >
                  {t('crew.settings.addressClear')}
                </button>
                <button
                  type="button"
                  disabled={addressModalSaving}
                  onClick={closeAddressModal}
                  className="px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-800"
                >
                  {t('crew.settings.phoneModalCancel')}
                </button>
                <button
                  type="button"
                  disabled={addressModalSaving}
                  onClick={() => void saveAddressModal()}
                  className="px-2 py-1 text-xs rounded bg-gray-900 text-white"
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
