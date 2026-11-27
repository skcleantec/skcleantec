import { sanitizeEContractHtml, eContractBodyLooksLikeHtml } from '../../utils/sanitizeEContractHtml';

/** 배포 계약 본문 — HTML(신규) 또는 플레인 텍스트(레거시) 표시 */
export function EContractBodyDisplay({
  body,
  className = '',
  maxHeightClass = '',
}: {
  body: string;
  className?: string;
  maxHeightClass?: string;
}) {
  const scroll = maxHeightClass ? `${maxHeightClass} overflow-y-auto rounded bg-gray-50 p-3` : '';

  if (!eContractBodyLooksLikeHtml(body)) {
    return (
      <div className={`whitespace-pre-wrap text-fluid-2xs text-gray-800 ${scroll} ${className}`}>
        {(body ?? '').trim() || '(비어 있음)'}
      </div>
    );
  }

  // 화면 표시용 — crossorigin 이 붙어 있으면 저장소가 허용 응답을 주지 않을 때 서명·도장이 깨져 보인다
  const safe = sanitizeEContractHtml(body).replace(/(<img\b[^>]*?)\s+crossorigin(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi, '$1');
  return (
    <div
      className={`e-contract-body-html text-fluid-xs text-gray-900 [&_.ql-align-center]:text-center [&_.ql-align-right]:text-right [&_.ql-align-justify]:text-justify [&_a]:text-blue-700 [&_a:hover]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-3 [&_blockquote]:text-gray-700 [&_h1]:text-fluid-lg [&_h1]:font-bold [&_h2]:text-fluid-md [&_h2]:font-semibold [&_h3]:text-fluid-sm [&_h3]:font-semibold [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-300 [&_td]:px-2 [&_td]:py-1.5 [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-100 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-center [&_th]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_img]:h-auto [&_img]:max-w-full [&_.e-contract-signer-signature-img]:max-h-[84px] [&_.e-contract-signer-signature-img]:w-auto [&_.e-contract-signer-signature-img]:max-w-[min(170px,36vw)] [&_.e-contract-signer-signature-img]:object-contain [&_.e-contract-issuer-signature-img]:max-w-[min(120px,30vw)] [&_.e-contract-seal-img]:max-w-[min(96px,24vw)] ${scroll} ${className}`}
      // DOMPurify(sanitizeEContractHtml) 정제 후 본문 전용 — 안전한 HTML만 주입
      dangerouslySetInnerHTML={{ __html: safe || '(비어 있음)' }}
    />
  );
}
