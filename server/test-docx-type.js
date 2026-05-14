import HTMLtoDOCX from 'html-to-docx';

async function run() {
  const html = '<h1>Test</h1>';
  try {
    const file = await HTMLtoDOCX(html, null, {
      title: 'test',
      footer: true,
      pageNumber: true
    });
    
    console.log("Is Buffer:", Buffer.isBuffer(file));
    console.log("Is ArrayBuffer:", file instanceof ArrayBuffer);
    console.log("Constructor name:", file.constructor.name);
    
    let buf;
    if (Buffer.isBuffer(file)) buf = file;
    else if (file instanceof ArrayBuffer) buf = Buffer.from(file);
    else {
       console.log("Using Blob.arrayBuffer()");
       buf = Buffer.from(await file.arrayBuffer());
    }
    console.log("Success, buf size:", buf.length);
  } catch (err) {
    console.error("Error:", err);
  }
}

run();