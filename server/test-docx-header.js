import HTMLtoDOCX from 'html-to-docx';

async function run() {
  const htmlString = '<p>test</p>';
  const docId = '12345';
  const headerHTML = `<!DOCTYPE html><html><body>header</body></html>`;

  try {
    const file = await HTMLtoDOCX(htmlString, headerHTML, {
      title: "Test Title",
      footer: true,
      pageNumber: true,
    });
    console.log("Success");
  } catch(e) {
    console.error("Failed:", e);
  }
}
run();