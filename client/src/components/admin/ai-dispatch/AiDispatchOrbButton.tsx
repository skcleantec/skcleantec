function Spark({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute block ${className}`}
      style={{
        clipPath: 'polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%)',
      }}
    />
  );
}

const letter =
  'bg-gradient-to-br from-sky-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent';

/** 날짜 카드 오른쪽. 카드 높이와 같은 원. 테두리 빛만 돈다. */
export function AiDispatchOrbButton({
  onClick,
  disabled,
  busy,
}: {
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={busy ? '실행 중' : '팀장배정'}
      className="group relative my-1 mr-1 block aspect-square h-[calc(100%-0.5rem)] shrink-0 self-center overflow-hidden rounded-full hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      style={{ containerType: 'size' }}
    >
      <span aria-hidden className="ai-orb-spin pointer-events-none absolute inset-[-20%] rounded-full" />
      <span className="absolute inset-[11%] flex flex-col items-center justify-center rounded-full bg-white group-hover:bg-slate-50">
        <span className={`relative font-semibold leading-none tracking-tight ${letter}`} style={{ fontSize: '30cqmin' }}>
          Ai
          <Spark className="-right-[0.05em] -top-[0.28em] size-[0.28em] bg-cyan-300" />
          <Spark className="-right-[0.22em] top-[0.22em] size-[0.16em] bg-sky-300" />
        </span>
        <span className={`mt-[0.35em] whitespace-nowrap font-semibold leading-none ${letter}`} style={{ fontSize: '11cqmin' }}>
          팀장배정
        </span>
      </span>
    </button>
  );
}
