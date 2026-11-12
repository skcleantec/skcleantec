import { useCallback, useEffect, useState } from 'react';
import { fetchPublicCustomerBoardPosts } from '../../api/publicCustomerBoard';

const ASSET = '/brand/login';

const SLIDES = [
  { key: 'dashboard', title: '대시보드', desc: '접수·매출·미수금을 한눈에', src: `${ASSET}/dashboard.webp`, alt: '대시보드 화면' },
  { key: 'schedule', title: '스케줄', desc: '먼 일정까지 달력으로 배정', src: `${ASSET}/schedule.webp`, alt: '스케줄 화면' },
  { key: 'telecrm', title: '텔레CRM', desc: '전화 상담과 고객 기록을 함께', src: `${ASSET}/telecrm.webp`, alt: '텔레CRM 화면' },
] as const;

const SLIDE_MS = 5000;

const GRID_BG =
  'linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px)';
const GLOW_BG = 'radial-gradient(520px 320px at 78% 62%, rgba(47,107,255,.28), transparent 70%)';

function PanelBackdrop() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: GRID_BG, backgroundSize: '48px 48px' }} aria-hidden />
      <div className="pointer-events-none absolute inset-0" style={{ background: GLOW_BG }} aria-hidden />
    </>
  );
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/** PC 왼쪽 — 실제 화면 3장 자동 전환 + 팀장 앱 */
export function LoginShowcasePanel() {
  const [index, setIndex] = useState(0);
  const [cycle, setCycle] = useState(0);
  const reduced = usePrefersReducedMotion();

  const goTo = useCallback((i: number) => {
    setIndex(i);
    setCycle((c) => c + 1);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const t = window.setTimeout(() => goTo((index + 1) % SLIDES.length), SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [index, cycle, reduced, goTo]);

  return (
    <aside className="sticky top-0 hidden h-dvh overflow-hidden bg-[#111A2E] lg:flex lg:flex-col">
      <PanelBackdrop />
      <div className="relative px-12 pt-10">
        <img src={`${ASSET}/logo-white.png`} alt="청소비서" className="h-8 w-auto" />
      </div>

      <div className="relative px-12 pt-12 xl:pt-16">
        <p className="text-[13px] font-semibold text-[#8FB0FF]">입주·이사 청소 업체를 위한 업무 비서</p>
        <h2 className="mt-3 max-w-[480px] text-[30px] font-extrabold leading-[1.3] tracking-[-0.02em] text-white xl:text-[34px]">
          접수부터 일정, 결제까지
          <br />
          오늘 업무를 한 화면에서.
        </h2>
        <div className="mt-5 flex flex-wrap gap-2 text-[13px] text-[#C9D4EA]">
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5">
            현장 카드결제 <b className="font-semibold text-white">다음 날 입금</b>
          </span>
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5">
            세금계산서·현금영수증 <b className="font-semibold text-white">바로 발급</b>
          </span>
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5">
            고객이 직접 쓰는 <b className="font-semibold text-white">발주서</b>
          </span>
        </div>
      </div>

      <div className="relative mt-9 px-12">
        <div className="grid max-w-[520px] grid-cols-3 gap-4" role="tablist" aria-label="청소비서 화면 둘러보기">
          {SLIDES.map((s, i) => {
            const active = i === index;
            return (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => goTo(i)}
                className={`text-left transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${active ? 'opacity-100' : 'opacity-55 hover:opacity-80'}`}
              >
                <span className="block h-[3px] overflow-hidden rounded bg-white/15">
                  {active ? (
                    <span
                      key={cycle}
                      className="block h-full rounded bg-white"
                      style={
                        reduced
                          ? { width: '100%' }
                          : { width: 0, animation: `login-showcase-fill ${SLIDE_MS}ms linear forwards` }
                      }
                    />
                  ) : null}
                </span>
                <span className="mt-2.5 block text-[14px] font-semibold text-white">{s.title}</span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-[#8C9AB6]">{s.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative mt-9 flex min-h-0 flex-1 flex-col pl-12">
        <div className="relative ml-16 flex min-h-0 flex-1 flex-col overflow-hidden rounded-tl-[14px] border-l border-t border-white/15 bg-white shadow-[0_-24px_70px_rgba(0,0,0,.4)]">
          <div className="flex h-7 shrink-0 items-center gap-1.5 border-b border-[#E6ECF5] bg-[#F7F9FC] px-3" aria-hidden>
            <span className="h-2 w-2 rounded-full bg-[#D5DCE8]" />
            <span className="h-2 w-2 rounded-full bg-[#D5DCE8]" />
            <span className="h-2 w-2 rounded-full bg-[#D5DCE8]" />
            <span className="ml-3 rounded bg-white px-2 text-[10.5px] text-[#7C8AA5] ring-1 ring-[#E6ECF5]">cbiseo.com</span>
          </div>
          <div className="relative min-h-[240px] w-[1000px] flex-1">
            {SLIDES.map((s, i) => (
              <img
                key={s.key}
                src={s.src}
                alt={s.alt}
                decoding="async"
                className={`absolute inset-0 w-[1000px] max-w-none transition-opacity duration-500 ${i === index ? 'opacity-100' : 'opacity-0'}`}
              />
            ))}
          </div>
        </div>
        <figure className="absolute bottom-0 left-10 w-[170px]">
          <div className="overflow-hidden rounded-t-[22px] border-[5px] border-b-0 border-[#0A0F1C] bg-white shadow-[0_20px_50px_rgba(0,0,0,.5)]">
            <img src={`${ASSET}/team-app.webp`} alt="팀장 앱 오늘 일정 화면" className="block w-full" decoding="async" />
          </div>
        </figure>
      </div>
      <style>{'@keyframes login-showcase-fill{to{width:100%}}'}</style>
    </aside>
  );
}

/** 모바일 상단 남색 밴드 */
export function LoginMobileBand({ signupHref }: { signupHref: string }) {
  return (
    <section className="relative overflow-hidden bg-[#111A2E] lg:hidden">
      <PanelBackdrop />
      <div className="relative px-5 pb-11 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-3">
          <img src={`${ASSET}/logo-white.png`} alt="청소비서" className="h-7 w-auto" />
          <a href={signupHref} className="text-[13px] text-[#B7C3DA]">
            처음이신가요? <span className="font-semibold text-white">회원가입</span>
          </a>
        </div>
        <h2 className="mt-6 text-[22px] font-extrabold leading-[1.35] tracking-[-0.02em] text-white">
          접수부터 일정, 결제까지
          <br />
          오늘 업무를 한 화면에서.
        </h2>
        <div className="mt-4 flex flex-wrap gap-1.5 text-[12px] text-[#C9D4EA]">
          <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1">카드결제 다음 날 입금</span>
          <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1">세금계산서 바로 발급</span>
          <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1">고객 직접 발주서</span>
        </div>
      </div>
    </section>
  );
}

/** 로그인 카드 위 「새 소식」 — 공지사항 최신 1건 */
export function LoginNoticePill() {
  const [post, setPost] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPublicCustomerBoardPosts({ boardSlug: 'notice', limit: 1, offset: 0 })
      .then((r) => {
        const p = r.items[0];
        if (!cancelled && p?.id && p.title) setPost({ id: p.id, title: p.title });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!post) return null;

  return (
    <a
      href={`/help?category=notice&post=${encodeURIComponent(post.id)}`}
      className="mb-4 flex items-center gap-2.5 rounded-full border border-[#E6ECF5] bg-white py-1.5 pl-1.5 pr-3.5 text-[12.5px] text-[#4A5877] shadow-[0_1px_2px_rgba(11,18,32,.04)] transition-colors hover:border-[#D3DBE8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F6BFF]/30"
    >
      <span className="shrink-0 rounded-full bg-[#EEF3FF] px-2 py-0.5 text-[11.5px] font-bold text-[#2F6BFF]">새 소식</span>
      <span className="min-w-0 flex-1 truncate">{post.title}</span>
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden className="shrink-0">
        <path d="M7.5 4.5 13 10l-5.5 5.5" stroke="#7C8AA5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}
