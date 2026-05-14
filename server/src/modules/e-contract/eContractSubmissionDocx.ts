import HTMLtoDOCX from 'html-to-docx';

function stripScripts(html: string): string {
  return (html ?? '').replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

function escapeXmlText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 체결 합본 HTML → Word(.docx) 바이너리.
 * 본문은 저장소에서 온 것으로 가정(관리자 전용 다운로드).
 */
export async function submissionMergedHtmlToDocxBuffer(opts: {
  definitionTitle: string;
  metaLinePlain: string;
  bodyHtml: string;
}): Promise<Buffer> {
  const body = stripScripts(opts.bodyHtml ?? '');
  const titleEsc = escapeXmlText(opts.definitionTitle);
  const metaEsc = escapeXmlText(opts.metaLinePlain);
  const htmlString = `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8" /></head>
<body>
<h1>${titleEsc}</h1>
<p style="color:#555;font-size:11pt;margin-bottom:14pt;">${metaEsc}</p>
${body}
</body>
</html>`;

  const file = await HTMLtoDOCX(htmlString, null, {
    title: opts.definitionTitle.slice(0, 250),
    lang: 'ko-KR',
    font: 'Malgun Gothic',
    fontSize: 22,
    margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
    creator: 'SK클린텍 전자계약',
  });

  if (Buffer.isBuffer(file)) return file;
  if (file instanceof ArrayBuffer) return Buffer.from(file);
  const ab = await (file as Blob).arrayBuffer();
  return Buffer.from(ab);
}
