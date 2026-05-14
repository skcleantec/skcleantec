import HTMLtoDOCX from 'html-to-docx';

async function run() {
  const htmlString = '<p>test</p>';
  const docId = '12345';
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

  try {
    const file = await HTMLtoDOCX(htmlString, headerHTML, {
      title: "Test Title",
      lang: 'ko-KR',
      font: 'Malgun Gothic',
      fontSize: 22,
      margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      creator: 'SK클린텍 전자계약',
      footer: true,
      pageNumber: true,
    });
    console.log("Success");
  } catch(e) {
    console.error("Failed:", e);
  }
}
run();