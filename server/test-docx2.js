import HTMLtoDOCX from 'html-to-docx';
import fs from 'fs';

async function run() {
  const html = '<h1>Test Document</h1><p>Page 1 content</p>';
  const file = await HTMLtoDOCX(html, null, {
    footer: true,
    pageNumber: true
  });
  
  fs.writeFileSync('test2.docx', file);
  console.log('test2.docx created');
}

run().catch(console.error);