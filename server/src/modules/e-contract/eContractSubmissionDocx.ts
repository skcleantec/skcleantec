import HTMLtoDOCX from 'html-to-docx';
import JSZip from 'jszip';

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
  submissionId?: string;
}): Promise<Buffer> {
  const body = stripScripts(opts.bodyHtml ?? '');
  const titleEsc = escapeXmlText(opts.definitionTitle);
  const metaEsc = escapeXmlText(opts.metaLinePlain);
  const docId = opts.submissionId ? escapeXmlText(opts.submissionId.toUpperCase().slice(0, 13)) : '';

  const htmlString = `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8" /></head>
<body>
<h1>${titleEsc}</h1>
<p style="color:#555;font-size:11pt;margin-bottom:14pt;">${metaEsc}</p>
${body}
</body>
</html>`;

  const headerHTML = docId
    ? `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8" /></head>
<body>
<div style="text-align: right; font-size: 9pt; color: #666; width: 100%;">
  문서 확인 번호: ${docId}
</div>
</body>
</html>`
    : null;

  const file = await HTMLtoDOCX(htmlString, headerHTML, {
    title: opts.definitionTitle.slice(0, 250),
    lang: 'ko-KR',
    font: 'Malgun Gothic',
    fontSize: 22,
    margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
    creator: 'SK클린텍 전자계약',
    footer: true,
    pageNumber: true,
  });

  let buf: Buffer;
  if (Buffer.isBuffer(file)) buf = file;
  else if (file instanceof ArrayBuffer) buf = Buffer.from(file);
  else buf = Buffer.from(await (file as Blob).arrayBuffer());

  try {
    const zip = await JSZip.loadAsync(buf);
    const footerFiles = Object.keys(zip.files).filter(k => k.startsWith('word/footer') && k.endsWith('.xml'));
    
    for (const footerPath of footerFiles) {
      let footerXml = await zip.file(footerPath)!.async('string');
      
      const pageRegex = /<([a-zA-Z0-9]+:)?fldSimple [^>]*instr="PAGE"[^>]*>[\s\S]*?<\/\1fldSimple>/g;
      
      footerXml = footerXml.replace(pageRegex, (match) => {
        return `${match}
        <r>
          <rPr/>
          <t xml:space="preserve"> / </t>
        </r>
        <fldSimple xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" w:instr="NUMPAGES">
          <r>
            <rPr/>
          </r>
        </fldSimple>`;
      });
      
      zip.file(footerPath, footerXml);
    }
    
    return await zip.generateAsync({ type: 'nodebuffer' });
  } catch (err) {
    console.error('[eContractDocx] Failed to inject NUMPAGES into DOCX footer', err);
    return buf;
  }
}
