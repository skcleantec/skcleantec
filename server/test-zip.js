import JSZip from 'jszip';
import fs from 'fs';

async function run() {
  const buf = fs.readFileSync('test2.docx');
  const zip = await JSZip.loadAsync(buf);
  let footerXml = await zip.file('word/footer1.xml').async('string');
  
  // Replace PAGE field with PAGE / NUMPAGES
  footerXml = footerXml.replace(
    '<fldSimple xmlns:ns2="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ns2:instr="PAGE">',
    `<fldSimple xmlns:ns2="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ns2:instr="PAGE">
      <r/>
    </fldSimple>
    <r xmlns="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><t xml:space="preserve"> / </t></r>
    <fldSimple xmlns:ns2="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ns2:instr="NUMPAGES">`
  );
  
  zip.file('word/footer1.xml', footerXml);
  const newBuf = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync('test2-mod.docx', newBuf);
  console.log('Modified test2.docx to test2-mod.docx');
}

run().catch(console.error);