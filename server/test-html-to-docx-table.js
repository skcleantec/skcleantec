import HTMLtoDOCX from 'html-to-docx';

async function test(html) {
  try {
    await HTMLtoDOCX(html, null, { title: 'Test' });
    console.log("OK:", html);
  } catch(e) {
    console.log("FAILED:", html, e.message);
  }
}

async function run() {
  await test('<table><tr><td style="width: 50%;">Test</td></tr></table>');
  await test('<table><tr><td style="width: 80px;">Test</td></tr></table>');
  await test('<table><tr><td width="50%">Test</td></tr></table>');
  await test('<table><tr><td width="80">Test</td></tr></table>');
}
run();