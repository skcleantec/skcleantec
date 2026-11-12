import { useEffect, useState } from 'react';
import { fetchPublicCustomerBoardPosts } from '../../api/publicCustomerBoard';

const ASSET = '/brand/login';

const GRID_BG =
  'linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px)';
const GLOW_BG = 'radial-gradient(560px 300px at 70% 40%, rgba(47,107,255,.28), transparent 70%)';

function PanelBackdrop() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: GRID_BG, backgroundSize: '48px 48px' }} aria-hidden />
      <div className="pointer-events-none absolute inset-0" style={{ background: GLOW_BG }} aria-hidden />
    </>
  );
}

/** 로그인 상단 남색 밴드 (PC·모바일 공통) */
export function LoginMobileBand({ signupHref }: { signupHref: string }) {
  return (
    <section className="relative shrink-0 overflow-hidden bg-[#111A2E]">
      <PanelBackdrop />
      <div className="relative mx-auto w-full max-w-[452px] px-5 pb-11 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-4 sm:pb-14 sm:pt-8">
        <div className="flex items-center justify-between gap-3">
          <img src={`${ASSET}/logo-white.png`} alt="청소비서" className="h-7 w-auto" />
          <a href={signupHref} className="text-[13px] text-[#B7C3DA]">
            처음이신가요? <span className="font-semibold text-white">회원가입</span>
          </a>
        </div>
        <h2 className="mt-6 text-[22px] font-extrabold sm:mt-8 sm:text-[26px] leading-[1.35] tracking-[-0.02em] text-white">
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
