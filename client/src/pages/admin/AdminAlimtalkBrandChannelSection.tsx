import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  fetchTenantBrandChannels,
  requestTenantBrandChannel,
  type TenantBrandChannelView,
} from '../../api/alimtalkBrandChannel';

const BTN_PRIMARY =
  'rounded-lg bg-slate-900 px-4 py-2 text-fluid-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50';
const STEPS = ['신청 접수', '채널 연결', '문구 심사', '우리 채널로 발송'] as const;

const PREP = [
  {
    title: '카카오비즈니스 가입',
    time: '5분',
    body: 'business.kakao.com 에서 대표님 카카오 계정으로 로그인하면 비즈니스 회원으로 바뀌어요.',
  },
  {
    title: '카카오톡 채널 만들기',
    time: '10분',
    body: '「+ 새 채널 만들기」→ 채널 이름(고객에게 보이는 이름, 브랜드명 그대로 추천), 프로필 사진(640×640), 검색용 아이디를 정해요. 이미 채널이 있으면 건너뛰세요.',
  },
  {
    title: '비즈니스 인증 신청',
    time: '심사 영업일 1~3일',
    body: '채널 관리 화면에서 사업자등록번호를 넣고 사업자등록증을 올려요. 신청하는 사람에 따라 필요한 것이 달라요.',
  },
  {
    title: '승인 후 채널 설정 3가지',
    time: '5분',
    body: '① 채널 공개 켜기 ② 검색 허용 켜기 ③ 프로필 설정 → 채널 정보에 고객센터 전화번호 넣기. 이 3가지가 없으면 알림톡을 연결할 수 없어요.',
  },
  {
    title: '청소비서에 신청',
    time: '',
    body: '신청하면 담당자가 채널을 연결하고 알림톡 문구 심사를 대신 넣어 드려요. 연결할 때 채널 관리자에게 인증 요청이 한 번 가요.',
  },
  {
    title: '알림톡 문구 심사',
    time: '영업일 1~3일',
    body: '카카오가 문구 3개를 심사해요. 심사 중에도 알림톡은 청소비서 채널로 정상 발송되고, 승인된 문구부터 우리 채널로 자동으로 바뀌어요.',
  },
];

function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

export function AdminAlimtalkBrandChannelSection() {
  const [view, setView] = useState<TenantBrandChannelView | null>(null);
  const [brandId, setBrandId] = useState('');
  const [searchId, setSearchId] = useState('');
  const [phone, setPhone] = useState('');
  const [biz, setBiz] = useState('DONE');
  const [publicReady, setPublicReady] = useState(false);
  const [feeAccepted, setFeeAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchTenantBrandChannels();
      setView(data);
      const open = data.brands.find((row) => !row.channel);
      setBrandId((prev) => prev || open?.operatingCompanyId || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : '채널 신청 정보를 불러오지 못했습니다.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const fee = view?.setupFeeKrw ?? 99000;
  const openBrands = view?.brands.filter((row) => !row.channel) ?? [];

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await requestTenantBrandChannel({
        operatingCompanyId: brandId,
        searchId,
        adminPhone: phone,
        bizVerify: biz,
        publicReady,
        feeAccepted,
      });
      setOpen(false);
      setNotice('신청했어요. 담당자가 연결을 시작해요.');
      setSearchId('');
      setPhone('');
      setPublicReady(false);
      setFeeAccepted(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '신청하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const linked = view?.brands.filter((row) => row.channel) ?? [];

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const modal = open ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-6"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="우리 카카오 채널로 알림톡 보내기"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-fluid-sm font-semibold text-gray-900">우리 카카오 채널로 알림톡 보내기</h2>
            <p className="mt-0.5 text-fluid-2xs text-gray-500">승인된 문구부터 우리 채널로 바뀌고, 나머지는 청소비서 채널로 보내요.</p>
          </div>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-fluid-sm text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            onClick={() => setOpen(false)}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-2.5">
              <p className="text-fluid-2xs text-gray-400">세팅비 · VAT 별도</p>
              <p className="text-fluid-xs font-semibold text-gray-900">브랜드당 1회 {won(fee)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2.5">
              <p className="text-fluid-2xs text-gray-400">걸리는 시간</p>
              <p className="text-fluid-xs font-semibold text-gray-900">보통 1주 · 빠르면 영업일 3일</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2.5">
              <p className="text-fluid-2xs text-gray-400">발송 요금</p>
              <p className="text-fluid-xs font-semibold text-gray-900">지금과 같아요</p>
            </div>
          </div>

          {linked.length > 0 ? (
            <div className="space-y-2">
              <p className="text-fluid-xs font-semibold text-gray-900">진행 상황</p>
              {linked.map((row) => (
                <div key={row.operatingCompanyId} className="rounded-lg border border-gray-100 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-fluid-xs font-semibold text-gray-900">
                      {row.name} · {row.channel?.searchId}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        row.channel?.badge.tone === 'emerald'
                          ? 'bg-emerald-50 text-emerald-700'
                          : row.channel?.badge.tone === 'amber'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {row.channel?.badge.label}
                    </span>
                  </div>
                  <ol className="mt-2 grid grid-cols-4 gap-1 text-center">
                    {STEPS.map((label, index) => {
                      const current = row.channel?.step ?? 0;
                      const tone =
                        index < current
                          ? 'bg-emerald-50 text-emerald-700'
                          : index === current
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-slate-50 text-gray-400';
                      return (
                        <li key={label} className={`rounded-md px-1 py-1 text-[11px] font-semibold ${tone}`}>
                          {label}
                        </li>
                      );
                    })}
                  </ol>
                  {row.channel?.note ? <p className="mt-1.5 text-fluid-2xs text-gray-500">{row.channel.note}</p> : null}
                </div>
              ))}
            </div>
          ) : null}

          <details className="group rounded-lg border border-gray-100" open={linked.length === 0}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5">
              <span className="text-fluid-xs font-semibold text-gray-900">신청 전에 준비할 것 · 6단계</span>
              <span className="text-fluid-2xs text-gray-400 group-open:hidden">펼치기</span>
              <span className="hidden text-fluid-2xs text-gray-400 group-open:inline">접기</span>
            </summary>
            <div className="space-y-2 border-t border-gray-100 px-3 py-3">
              <a
                href="https://business.kakao.com"
                target="_blank"
                rel="noreferrer"
                className="inline-block text-fluid-2xs font-medium text-sky-700 hover:underline"
              >
                카카오비즈니스 열기 ↗
              </a>
              <ol className="space-y-2">
                {PREP.map((step, index) => (
                  <li key={step.title} className="flex gap-2">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-fluid-2xs font-semibold text-white">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-fluid-xs font-medium text-gray-900">
                        {step.title}
                        {step.time ? (
                          <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-fluid-2xs font-semibold text-slate-600">
                            {step.time}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-fluid-2xs text-gray-500">{step.body}</p>
                      {index === 2 ? (
                        <div className="mt-1 space-y-1">
                          <p className="text-fluid-2xs text-gray-600">개인사업자 대표 = 카카오 인증서</p>
                          <p className="text-fluid-2xs text-gray-600">법인 대표 = 사업자등록증 파일 + 휴대폰 본인 인증</p>
                          <p className="text-fluid-2xs text-gray-600">직원이 신청 = 사업자등록증 파일 + 카카오 인증서</p>
                          <p className="text-fluid-2xs text-red-700">
                            가장 많이 반려되는 이유: 사업자등록증의 주민등록번호 뒷자리·개인 휴대폰·이메일을 가리지 않고 올린 경우예요. 꼭 가리고 올려 주세요.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </details>

          {openBrands.length > 0 ? (
            <div className="space-y-2">
              <p className="text-fluid-xs font-semibold text-gray-900">신청하기</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-fluid-2xs text-gray-500">
                  브랜드
                  <select
                    className="mt-1 w-full rounded-lg bg-slate-50 px-3 py-2 text-fluid-sm text-gray-900"
                    value={brandId}
                    onChange={(event) => setBrandId(event.target.value)}
                  >
                    {openBrands.map((row) => (
                      <option key={row.operatingCompanyId} value={row.operatingCompanyId}>
                        {row.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-fluid-2xs text-gray-500">
                  채널 검색용 아이디
                  <input
                    className="mt-1 w-full rounded-lg bg-slate-50 px-3 py-2 text-fluid-sm"
                    value={searchId}
                    onChange={(event) => setSearchId(event.target.value)}
                    placeholder="@ 없이 적어도 돼요"
                  />
                </label>
                <label className="block text-fluid-2xs text-gray-500">
                  채널 관리자 연락처
                  <input
                    className="mt-1 w-full rounded-lg bg-slate-50 px-3 py-2 text-fluid-sm"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="010-0000-0000"
                  />
                </label>
                <label className="block text-fluid-2xs text-gray-500">
                  비즈니스 인증
                  <select
                    className="mt-1 w-full rounded-lg bg-slate-50 px-3 py-2 text-fluid-sm"
                    value={biz}
                    onChange={(event) => setBiz(event.target.value)}
                  >
                    <option value="DONE">승인 완료</option>
                    <option value="IN_REVIEW">심사 중</option>
                    <option value="NONE">아직 안 함</option>
                  </select>
                </label>
              </div>
              {biz === 'NONE' ? (
                <p className="text-fluid-2xs text-amber-800">위 3단계 비즈니스 인증을 먼저 신청해 주세요.</p>
              ) : (
                <div className="space-y-1.5">
                  <label className="flex items-start gap-2 text-fluid-2xs text-gray-700">
                    <input type="checkbox" checked={publicReady} onChange={(event) => setPublicReady(event.target.checked)} />
                    채널 공개·검색 허용·고객센터 번호를 모두 설정했어요
                  </label>
                  <label className="flex items-start gap-2 text-fluid-2xs text-gray-700">
                    <input type="checkbox" checked={feeAccepted} onChange={(event) => setFeeAccepted(event.target.checked)} />
                    세팅비 {won(fee)}(VAT 별도)은 다음 이용료 청구서에 함께 청구돼요
                  </label>
                </div>
              )}
              {error ? <p className="text-fluid-2xs text-red-700">{error}</p> : null}
            </div>
          ) : (
            <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-fluid-2xs text-gray-600">모든 브랜드가 신청을 마쳤어요.</p>
          )}
        </div>

        {openBrands.length > 0 && biz !== 'NONE' ? (
          <div className="flex justify-end gap-2 border-t border-gray-100 px-4 py-3 sm:px-5">
            <button
              type="button"
              className="rounded-lg border border-gray-200 px-4 py-2 text-fluid-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setOpen(false)}
            >
              닫기
            </button>
            <button
              type="button"
              className={BTN_PRIMARY}
              disabled={busy || !publicReady || !feeAccepted || !brandId}
              onClick={() => void submit()}
            >
              신청하기
            </button>
          </div>
        ) : null}
      </div>
    </div>
  ) : null;

  return (
    <>
      <section className="relative overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 via-yellow-50 to-white p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FEE500] text-gray-900"
            aria-hidden
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
              <path d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.7 6.7L5.8 21l3.9-2.6c.7.1 1.5.2 2.3.2 5.5 0 10-3.6 10-8S17.5 3 12 3Z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-fluid-sm font-bold text-gray-900">우리 카카오 채널로 알림톡 보내기!!</p>
            <p className="mt-0.5 text-fluid-2xs text-gray-600">고객과의 소통과 자연스러운 마케팅 효과 급증</p>
            {linked.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {linked.map((row) => (
                  <span
                    key={row.operatingCompanyId}
                    className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100"
                  >
                    {row.name} · {row.channel?.badge.label}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg bg-slate-900 px-3.5 py-2 text-fluid-xs font-semibold text-white hover:bg-slate-800"
            onClick={() => setOpen(true)}
          >
            {openBrands.length > 0 ? '자세히 보고 신청하기' : '진행 상황 보기'}
          </button>
        </div>
      </section>

      {modal ? createPortal(modal, document.body) : null}

      {notice
        ? createPortal(
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">
              <div className="w-full max-w-sm rounded-2xl bg-white p-4 text-center shadow-lg">
                <p className="text-fluid-sm font-semibold text-gray-900">{notice}</p>
                <button type="button" className={`${BTN_PRIMARY} mt-3`} onClick={() => setNotice('')}>
                  확인
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
