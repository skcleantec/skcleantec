import HTMLtoDOCX from 'html-to-docx';
import JSZip from 'jszip';
import fs from 'fs';

async function run() {
  const html = '<h1>Test</h1><div style="page-break-after:always"></div><p>Page 2</p>';
  const file = await HTMLtoDOCX(html, null, {
    footer: true,
    pageNumber: true
  });
  
  const zip = await JSZip.loadAsync(file);
  let footerXml = await zip.file('word/footer1.xml').async('string');
  
  // Use a regex to match the PAGE field
  const pageRegex = /<fldSimple [^>]*instr="PAGE"[^>]*>[\s\S]*?<\/fldSimple>/g;
  
  footerXml = footerXml.replace(pageRegex, (match) => {
    // Extract the namespace prefix used for instr (e.g. "ns2:")
    const nsMatch = match.match(/xmlns:([^=]+)="http:\/\/schemas\.openxmlformats\.org\/wordprocessingml\/2006\/main"/);
    const nsPrefix = nsMatch ? nsMatch[1] + ':' : '';
    
    return `${match}
    <r xmlns="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <t xml:space="preserve"> / </t>
    </r>
    <fldSimple xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ${nsPrefix}instr="NUMPAGES">
      <r xmlns="http://schemas.openxmlformats.org/wordprocessingml/2006/main" />
    </fldSimple>`;
  });
  
  console.log("Replaced:", footerXml.includes('NUMPAGES'));
  
  zip.file('word/footer1.xml', footerXml);
  const newBuf = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync('test-num-pages.docx', newBuf);
  console.log('Done');
}

run().catch(console.error);