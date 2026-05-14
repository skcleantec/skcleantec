import HTMLtoDOCX from 'html-to-docx';
import fs from 'fs';

async function run() {
  const html = '<h1>Test Document</h1><p>Page 1 content</p>';
  const footerHTML = '<div style="text-align: center;"><span class="page-number"></span> / <span class="total-pages"></span></div>';
  const file = await HTMLtoDOCX(html, null, {
    footer: true
  }, footerHTML);
  
  fs.writeFileSync('test3.docx', file);
  console.log('test3.docx created');
}

run().catch(console.error);