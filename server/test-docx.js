import HTMLtoDOCX from 'html-to-docx';
import fs from 'fs';

async function run() {
  const html = '<h1>Test Document</h1><p>Page 1 content</p><div style="page-break-after:always"></div><p>Page 2 content</p>';
  const headerHTML = '<div style="text-align:right">문서 번호: DOC-12345</div>';
  const footerHTML = '<div style="text-align:center">Page <span class="page-number"></span> of <span class="total-pages"></span></div>';
  
  const file = await HTMLtoDOCX(html, headerHTML, {
    header: true,
    footer: true,
    pageNumber: true
  }, footerHTML);
  
  fs.writeFileSync('test.docx', file);
  console.log('test.docx created');
}

run().catch(console.error);
