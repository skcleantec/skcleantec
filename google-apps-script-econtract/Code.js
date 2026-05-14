// @ts-nocheck
/*************************************************
 * JJ3PL 전자계약 Web App — Code.gs (R5: footer stamp + bullet-safe sign insert)
 * - 계약서 PDF 1개만 첨부
 * - 가이드는 링크만 본문에 안내
 * - 보관폴더 URL은 메일에 미포함
 * - 메일 제목/본문은 MailTemplate.gs에서 불러옴
 * - 계약서 NO. [코드] → 각 페이지 하단 오른쪽 표시
 * - (갑) 서명 마커가 문단/리스트/표 셀 어디 있어도 바로 뒤에 정확히 삽입
 *************************************************/

const CONFIG = {
  TEMPLATE_ID: '1aB4u0rSxOkoqXqDZiA5GHt3raP0mRXouSIR7DbYlvLQ',
  ROOT_FOLDER_ID: '1UzEY_UH18nA6GDgeCJSIQor9s_kye37c',
  LOG_SHEET_ID: '1tbmtdNIIOI163v0Y7XTm2854L9y2QOPhe-v3ld9wPoc',

  COMPANY: {
    name: '제이제이',
    address: '경기 김포시 통진읍 월하로 352-18',
    rep: '이 정 민',
    phone: '010-9059-6282'
  },

  DOC_CODE: 'JJ3PL-WMS',
  SELFIE_SUBFOLDER: 'selfie',
  PREVIEW_SUBFOLDER: 'Previews',

  SIGNATURE_MAX_WIDTH_PT: 140,
  SIGNATURE_MAX_HEIGHT_PT: 28,

  GUIDE_FILE_ID: '1Mqs7jQEMX5gESmwloJQMKGZo4uwiA2wQiHw5goOMFdo'
};

/* ================== Web App ================== */
function doGet() {
  const t = HtmlService.createTemplateFromFile('WebApp');
  t.company = CONFIG.COMPANY;
  return t.evaluate()
    .setTitle('제이제이 3PL 물류 전자계약')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* 상단: 계약서 내용 보기(템플릿 PDF 미리보기 생성) */
function showContract() {
  const root = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
  const previews = getOrCreateFolder(root, CONFIG.PREVIEW_SUBFOLDER);
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
  const base = `${today}-${CONFIG.DOC_CODE}-STATIC`;

  const copy = DriveApp.getFileById(CONFIG.TEMPLATE_ID).makeCopy(`${base}.doc`, previews);
  const doc  = DocumentApp.openById(copy.getId());
  const body = doc.getBody();

  body.replaceText('\\[\\[SIGN_갑\\]\\]', '(전자서명은 제출 시 삽입됩니다)');
  body.replaceText('\\[\\[SIGN_을\\]\\]', '');

  doc.saveAndClose();

  const pdfBlob = DriveApp.getFileById(copy.getId()).getAs('application/pdf');
  const pdfFile = previews.createFile(pdfBlob).setName(`${base}.pdf`);
  return { ok: true, pdfUrl: pdfFile.getUrl() };
}

/* ================== 제출 처리 ================== */
function handleSubmit(payload) {
  validateForSubmit(payload);

  const root = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
  const submissionsRoot = getOrCreateFolder(root, 'Submissions');
  const companyFolder = getOrCreateFolder(submissionsRoot, sanitizeName(payload.company_name));
  const selfieFolder  = getOrCreateFolder(companyFolder, CONFIG.SELFIE_SUBFOLDER);

  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
  const basePrefix = `${today}-${CONFIG.DOC_CODE}-${sanitizeName(payload.company_name)}-${sanitizeName(payload.contact_name)}`;
  const seq = String(getNextSequence(companyFolder, basePrefix)).padStart(3,'0');
  const baseName = `${basePrefix}-${seq}`;

  const signBlob = dataUrlToPngBlob(payload.signature_png, `${baseName}_sign.png`);
  const signFile = companyFolder.createFile(signBlob);

  let selfieFile = null;
  if (payload.selfie_image){
    const selfieBlob = dataUrlToPngBlob(payload.selfie_image, `${baseName}_selfie.png`);
    selfieFile = selfieFolder.createFile(selfieBlob);
  }

  const jsonBlob = Utilities.newBlob(JSON.stringify(payload), 'application/json', `${baseName}.json`);
  const jsonFile = companyFolder.createFile(jsonBlob);

  const copy = DriveApp.getFileById(CONFIG.TEMPLATE_ID).makeCopy(`${baseName}.doc`, companyFolder);
  const doc  = DocumentApp.openById(copy.getId());
  const body = doc.getBody();

  replaceAllExact(body, buildTemplateMap(payload));

  insertImageAtMarkerOrNearby(
    body,
    '[[SIGN_갑]]',
    signFile.getBlob(),
    CONFIG.SIGNATURE_MAX_WIDTH_PT,
    CONFIG.SIGNATURE_MAX_HEIGHT_PT
  );

  // 하단 오른쪽에 계약서 NO. [코드]
  applyFooterCodeStamp_(doc, payload.challenge_code);

  doc.saveAndClose();

  const pdfBlob = DriveApp.getFileById(copy.getId()).getAs('application/pdf');
  const pdfFile = companyFolder.createFile(pdfBlob).setName(`${baseName}.pdf`);

  const sh = getOrCreateLogSheet();
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    (jsonBlob.getDataAsString()||'') + '|' + (payload.signature_png||'') + '|' + (payload.selfie_image||'')
  );
  const hashHex = digest.map(b=>('0'+(b&0xFF).toString(16)).slice(-2)).join('');

  sh.appendRow([
    new Date(), payload.company_name, payload.biz_no||'', payload.contact_name, payload.phone, payload.email,
    payload.start_date, payload.end_date, payload.auto_extend_months, payload.challenge_code,
    !!payload.agree_tos, !!payload.agree_privacy,
    pdfFile.getUrl(), jsonFile.getUrl(), selfieFile ? selfieFile.getUrl() : '', companyFolder.getUrl(),
    copy.getId(), pdfFile.getId(), jsonFile.getId(), selfieFile ? selfieFile.getId() : '',
    '진행', '', hashHex, payload.user_agent || ''
  ]);

  const guideLink = (typeof getGuideViewLink_ === 'function') ? getGuideViewLink_() : '';
  const subject   = (typeof mailSubject_ === 'function') ? mailSubject_() : '제이제이 3PL 전자계약 접수';
  const bodyText  = (typeof mailBody_ === 'function')
    ? mailBody_({ payload: payload, guideLink: guideLink, pdfUrl: pdfFile.getUrl() })
    : '계약이 접수되었습니다.\n(템플릿 로드 실패 시 기본 메시지)';

  let mailSent = false, mailError = '';
  try {
    GmailApp.sendEmail(
      payload.email,
      subject,
      bodyText,
      { attachments: [ pdfFile.getAs('application/pdf') ], name: '제이제이 3PL' }
    );
    mailSent = true;
  } catch(e) {
    try {
      MailApp.sendEmail({
        to: payload.email,
        subject: subject,
        body: bodyText,
        attachments: [ pdfFile.getAs('application/pdf') ]
      });
      mailSent = true;
    } catch(e2){ mailError = String(e2); }
  }

  return { ok:true, pdfUrl: pdfFile.getUrl(), folderUrl: companyFolder.getUrl(), mailSent, mailError };
}

/* ================== 유틸 ================== */
function validateForSubmit(p){
  const req = [
    'company_name','contact_name','phone','email',
    'start_date','end_date','auto_extend_months',
    'agree_tos','agree_privacy','read_confirmed',
    'challenge_code','signature_png','selfie_image'
  ];
  req.forEach(k=>{
    if(p[k]===undefined || String(p[k]).trim()==='') {
      throw new Error('필수값 누락: '+k);
    }
  });
  if (!/@/.test(p.email)) throw new Error('이메일 형식이 올바르지 않습니다');
}

function buildTemplateMap(p){
  return {
    '{{갑_회사명}}': p.company_name,
    '{{갑_주소}}': p.company_address || '',
    '{{갑_대표자}}': p.rep_name || p.contact_name,
    '{{갑_연락처}}': p.phone,
    '{{갑_사업자번호}}': p.biz_no || '',
    '{{본인확인코드}}': p.challenge_code || '',
    '{{시작_년}}': p.start_date.split('-')[0],
    '{{시작_월}}': p.start_date.split('-')[1],
    '{{시작_일}}': p.start_date.split('-')[2],
    '{{종료_년}}': p.end_date.split('-')[0],
    '{{종료_월}}': p.end_date.split('-')[1],
    '{{종료_일}}': p.end_date.split('-')[2],
    '{{자동연장_개월}}': p.auto_extend_months,
    '{{계약일_년}}': Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy'),
    '{{계약일_월}}': Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MM'),
    '{{계약일_일}}': Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd')
  };
}

function replaceAllExact(body, kv){
  Object.keys(kv).forEach(key=>{
    const pattern = key.replace(/[-\/\\^$*+?.()|[\]{}]/g,'\\$&');
    body.replaceText(pattern, String(kv[key] ?? ''));
  });
}

/** 하단 오른쪽에 계약서 NO. [코드] 표시 */
function applyFooterCodeStamp_(doc, code){
  if (!code) return;
  let footer = doc.getFooter();
  if (!footer) footer = doc.addFooter();

  const text = '계약서 NO. [' + String(code) + ']';

  // 동일 문구 중복 방지
  const it = footer.getNumChildren();
  for (let i = it - 1; i >= 0; i--) {
    const child = footer.getChild(i);
    if (child.getType() === DocumentApp.ElementType.PARAGRAPH) {
      const t = child.asParagraph().getText();
      if (t && t.indexOf('계약서 NO. [') === 0) footer.removeChild(child);
    }
  }

  const p = footer.appendParagraph(text);
  p.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  p.setBold(false);
  p.setFontSize(9);
  p.setForegroundColor('#666666');
  p.setSpacingBefore(0);
  p.setSpacingAfter(0);
  p.setLineSpacing(1.0);
}

/** (핵심) 서명 마커 자리에 정확히 이미지 삽입 (문단/리스트/표 셀 대응) */
function insertImageAtMarkerOrNearby(body, marker, blob, maxWidthPt, maxHeightPt){
  const pat = marker.replace(/[-\/\\^$*+?.()|[\]{}]/g,'\\$&');
  const range = body.findText(pat);
  let placed = false;

  function scale(img){
    try{
      const w = img.getWidth(), h = img.getHeight();
      const ratio = Math.min((maxWidthPt||w)/w, (maxHeightPt||h)/h);
      img.setWidth(Math.round(w*ratio));
      img.setHeight(Math.round(h*ratio));
    }catch(_){}
  }

  if (range){
    const text = range.getElement().asText();
    const start = range.getStartOffset();
    const end   = range.getEndOffsetInclusive();
    // 1) 마커 텍스트 제거
    text.deleteText(start, end);

    // 2) 텍스트 노드가 속한 Paragraph/ListItem 탐색
    let container = text.getParent();
    while (container && container.getType() !== DocumentApp.ElementType.PARAGRAPH &&
           container.getType() !== DocumentApp.ElementType.LIST_ITEM) {
      container = container.getParent && container.getParent();
    }

    try {
      if (container){
        const para = container.asParagraph();                // ListItem도 asParagraph() 가능
        const idx  = para.getChildIndex(text);               // 텍스트 노드의 child index
        let img    = null;
        try {
          // 텍스트 노드 "바로 뒤"에 삽입
          img = para.insertInlineImage(idx + 1, blob);
        } catch(e1) {
          // 일부 스타일/러너타임에서 index 삽입이 막힐 수 있어 문단 끝에 삽입
          img = para.appendInlineImage(blob);
        }
        scale(img);
        placed = true;
      }
    } catch(e){
      // 계속 실패하면 마지막 폴백
    }
  }

  if (!placed){
    const img = body.appendParagraph(' ').insertInlineImage(0, blob);
    scale(img);
  }
}

/* 공통 */
function dataUrlToPngBlob(dataUrl, name){
  const base64 = (dataUrl||'').split(',')[1] || '';
  const bytes = Utilities.base64Decode(base64);
  return Utilities.newBlob(bytes, 'image/png', name);
}
function getOrCreateFolder(parent, name){
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function sanitizeName(s){ return String(s||'').replace(/[\\/:*?"<>|]/g,'_').trim(); }
function getNextSequence(folder, basePrefix){
  let maxSeq = 0; const it = folder.getFiles();
  while (it.hasNext()){
    const nm = it.next().getName();
    if (nm.indexOf(basePrefix) === 0){
      const m = nm.match(/-(\d{3})(?:\.|_|$)/);
      if (m) maxSeq = Math.max(maxSeq, parseInt(m[1],10));
    }
  }
  return maxSeq + 1;
}

/* 로그 시트 */
function getOrCreateLogSheet(){
  if (CONFIG.LOG_SHEET_ID && CONFIG.LOG_SHEET_ID.trim() !== ''){
    const ss = SpreadsheetApp.openById(CONFIG.LOG_SHEET_ID);
    const sh = ss.getSheetByName('Log') || ss.getSheets()[0];
    ensureLogHeaders(sh); return sh;
  }
  const folder = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
  const files = folder.getFiles();
  while (files.hasNext()){
    const f = files.next();
    if (f.getMimeType() === MimeType.GOOGLE_SHEETS && f.getName().indexOf('Contract Submission Log') !== -1){
      const ss = SpreadsheetApp.openById(f.getId());
      const sh = ss.getSheetByName('Log') || ss.getSheets()[0];
      ensureLogHeaders(sh); return sh;
    }
  }
  const ss = SpreadsheetApp.create('Contract Submission Log');
  const file = DriveApp.getFileById(ss.getId());
  folder.addFile(file); DriveApp.getRootFolder().removeFile(file);
  const sh = ss.getSheets()[0]; sh.setName('Log'); ensureLogHeaders(sh);
  return sh;
}
function ensureLogHeaders(sh){
  const headers = [
    'Timestamp','Company','BizNo','Contact','Phone','Email',
    'StartDate','EndDate','AutoExtend(M)','ChallengeCode',
    'AgreeTOS','AgreePrivacy',
    'PDF URL','JSON URL','Selfie URL','Folder URL',
    'DocId','PdfFileId','JsonFileId','SelfieFileId',
    'Status','PurgeDone','PayloadHash','UserAgent'
  ];
  const r = sh.getRange(1,1,1,headers.length);
  if (r.getValues()[0][0] !== 'Timestamp'){ r.setValues([headers]); sh.setFrozenRows(1); }
}

/* include & sanity */
function include(filename){ return HtmlService.createHtmlOutputFromFile(filename).getContent(); }
function compileCheck(){ return true; }
