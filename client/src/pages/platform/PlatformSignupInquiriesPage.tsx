import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchPlatformSignupInquirySettings,
  listPlatformSignupInquiries,
  updatePlatformSignupInquirySettings,
  updatePlatformSignupInquiryStatus,
  usePlatformTokenOrThrow,
  type PlatformSignupInquiryRow,
  type PlatformSignupInquiryStatus,
} from '../../api/platformSignupInquiry';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, CARD_SECTION, INPUT_BASE } from '../../utils/platformUi';

function formatKo(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

const STATUS_LABEL: Record<PlatformSignupInquiryStatus, string> = {
  PENDING: '대기',
  CONTACTED: '연락완료',
  APPROVED: '승인',
  REJECTED: '반려',
  CONVERTED: '전환완료',
  CLOSED: '종료',
};

export function PlatformSignupInquiriesPage() {
  const [tab, setTab] = useState<'board' | 'settings'>('board');
  const [items, setItems] = useState<PlatformSignupInquiryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'PENDING' | 'ALL'>('PENDING');

  const [notifyEmailsText, setNotifyEmailsText] = useState('');
  const [replyToEmail, setReplyToEmail] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = usePlatformTokenOrThrow();
      const data = await listPlatformSignupInquiries(token, {
        status: filter === 'PENDING' ? 'PENDING' : undefined,
        limit: 50,
        offset: 0,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : '조회 실패');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const loadSettings = useCallback(async () => {
    try {
      const token = usePlatformTokenOrThrow();
      const s = await fetchPlatformSignupInquirySettings(token);
      setNotifyEmailsText(s.notifyEmails.join('\n'));
      setReplyToEmail(s.replyToEmail ?? '');
      setIsActive(s.isActive);
    } catch (e) {
      setError(e instanceof Error ? e.message : '설정 불러오기 실패');
    }
  }, []);

  useEffect(() => {
    if (tab === 'board') void loadBoard();
    else void loadSettings();
  }, [tab, loadBoard, loadSettings]);

  const saveSettings = async () => {
    setSettingsSaving(true);
    setSettingsMessage('');
    setError('');
    try {
      const token = usePlatformTokenOrThrow();
      const notifyEmails = notifyEmailsText
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      await updatePlatformSignupInquirySettings(token, {
        notifyEmails,
        replyToEmail: replyToEmail.trim() || null,
        isActive,
      });
      setSettingsMessage('저장했습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSettingsSaving(false);
    }
  };

  const setStatus = async (row: PlatformSignupInquiryRow, status: PlatformSignupInquiryStatus) => {
    let adminNote: string | undefined;
    let convertedTenantId: string | undefined;
    if (status === 'REJECTED') {
      const note = window.prompt('반려 사유 (선택)');
      if (note === null) return;
      adminNote = note || undefined;
    } else if (status === 'CONVERTED') {
      convertedTenantId = window.prompt('연결할 업체 ID (UUID, 선택)')?.trim() || undefined;
    } else if (status === 'APPROVED' || status === 'CONTACTED') {
      const note = window.prompt('메모 (선택)');
      if (note === null && status === 'APPROVED') return;
      adminNote = note || undefined;
    }
    setBusyId(row.id);
    try {
      const token = usePlatformTokenOrThrow();
      await updatePlatformSignupInquiryStatus(token, row.id, {
        status,
        adminNote,
        convertedTenantId,
      });
      await loadBoard();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '처리 실패');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 min-w-0">
      <div className="border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-center gap-2 text-fluid-sm text-slate-500">
          <Link to="/platform/tenants" className="hover:text-slate-800">
            업체 관리
          </Link>
          <span>/</span>
          <span className="text-slate-900">가입승인 게시판</span>
        </div>
        <h1 className="mt-2 text-fluid-lg font-semibold text-slate-900">도입 상담 · 가입승인</h1>
        <p className="mt-1 text-fluid-xs text-slate-500">
          마케팅 랜딩 도입 상담 접수를 검토합니다. 셀프 가입(/signup)과 유료 전환 신청과는 별도입니다.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={tab === 'board' ? BTN_PRIMARY : BTN_SECONDARY}
          onClick={() => setTab('board')}
        >
          접수 목록
        </button>
        <button
          type="button"
          className={tab === 'settings' ? BTN_PRIMARY : BTN_SECONDARY}
          onClick={() => setTab('settings')}
        >
          알림 설정
        </button>
      </div>

      {error ? <p className="text-fluid-sm text-red-600">{error}</p> : null}

      {tab === 'settings' ? (
        <section className={CARD_SECTION}>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">접수 알림 이메일</h2>
          <p className="text-sm text-gray-600 mb-4">
            랜딩 페이지 도입 상담 폼 접수 시 아래 주소로 모두 발송됩니다. (한 줄에 하나, 또는 쉼표·세미콜론 구분)
          </p>
          <label className="block text-sm mb-4">
            <span className="mb-1 block font-medium text-gray-700">수신 이메일</span>
            <textarea
              className={`${INPUT_BASE} min-h-[120px]`}
              value={notifyEmailsText}
              onChange={(e) => setNotifyEmailsText(e.target.value)}
              placeholder="admin@example.com&#10;ops@example.com"
            />
          </label>
          <label className="block text-sm mb-4">
            <span className="mb-1 block font-medium text-gray-700">회신 주소 (선택)</span>
            <input
              className={INPUT_BASE}
              value={replyToEmail}
              onChange={(e) => setReplyToEmail(e.target.value)}
              placeholder="reply@cbiseo.com"
            />
          </label>
          <label className="flex items-center gap-2 text-sm mb-4">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <span>알림 발송 사용</span>
          </label>
          {settingsMessage ? (
            <p className="text-sm text-emerald-700 mb-3">{settingsMessage}</p>
          ) : null}
          <button type="button" className={BTN_PRIMARY} disabled={settingsSaving} onClick={() => void saveSettings()}>
            {settingsSaving ? '저장 중…' : '저장'}
          </button>
        </section>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              className={filter === 'PENDING' ? BTN_PRIMARY : BTN_SECONDARY}
              onClick={() => setFilter('PENDING')}
            >
              대기 중
            </button>
            <button
              type="button"
              className={filter === 'ALL' ? BTN_PRIMARY : BTN_SECONDARY}
              onClick={() => setFilter('ALL')}
            >
              전체
            </button>
            <button type="button" className={BTN_SECONDARY} onClick={() => void loadBoard()}>
              새로고침
            </button>
            <span className="text-fluid-xs text-slate-500 ml-auto">총 {total.toLocaleString('ko-KR')}건</span>
          </div>

          {loading ? <p className="text-fluid-sm text-slate-500">불러오는 중…</p> : null}

          {!loading && items.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-fluid-sm text-slate-500">
              {filter === 'PENDING' ? '대기 중인 접수가 없습니다.' : '접수 내역이 없습니다.'}
            </p>
          ) : null}

          <ul className="space-y-3">
            {items.map((row) => (
              <li key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-fluid-sm font-semibold text-slate-900">
                      {row.companyName}{' '}
                      <span className="font-normal text-slate-600">· {row.contactName}</span>
                    </p>
                    <p className="text-fluid-xs text-slate-600">
                      {row.contactPhone}
                      {row.contactEmail ? ` · ${row.contactEmail}` : ''}
                      {row.teamLeaderRange ? ` · 팀장 ${row.teamLeaderRange}` : ''}
                    </p>
                    <p className="text-fluid-2xs text-slate-600 whitespace-pre-wrap">{row.message}</p>
                    <p className="text-fluid-2xs text-slate-500">
                      접수 {formatKo(row.createdAt)} · {STATUS_LABEL[row.status]}
                      {row.reviewedAt ? ` · 처리 ${formatKo(row.reviewedAt)}` : ''}
                    </p>
                    {row.adminNote ? (
                      <p className="text-fluid-2xs text-slate-600">메모: {row.adminNote}</p>
                    ) : null}
                    {row.convertedTenantSlug ? (
                      <p className="text-fluid-2xs text-slate-600">
                        연결 업체: {row.convertedTenantName} ({row.convertedTenantSlug})
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {row.status === 'PENDING' || row.status === 'CONTACTED' ? (
                      <>
                        {row.status === 'PENDING' ? (
                          <button
                            type="button"
                            className={BTN_SECONDARY}
                            disabled={busyId === row.id}
                            onClick={() => void setStatus(row, 'CONTACTED')}
                          >
                            연락완료
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className={BTN_PRIMARY}
                          disabled={busyId === row.id}
                          onClick={() => void setStatus(row, 'APPROVED')}
                        >
                          승인
                        </button>
                        <button
                          type="button"
                          className={BTN_DANGER}
                          disabled={busyId === row.id}
                          onClick={() => void setStatus(row, 'REJECTED')}
                        >
                          반려
                        </button>
                        <button
                          type="button"
                          className={BTN_SECONDARY}
                          disabled={busyId === row.id}
                          onClick={() => void setStatus(row, 'CONVERTED')}
                        >
                          전환완료
                        </button>
                      </>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-fluid-2xs text-slate-700">
                        {STATUS_LABEL[row.status]}
                      </span>
                    )}
                    {row.convertedTenantId ? (
                      <Link to={`/platform/tenants/${row.convertedTenantId}`} className={BTN_SECONDARY}>
                        업체 상세
                      </Link>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
