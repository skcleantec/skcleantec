function include(filename){
return HtmlService.createHtmlOutputFromFile(filename).getContent();
}


function getOrCreateFolder(parent, name){
const it = parent.getFoldersByName(name);
return it.hasNext()? it.next() : parent.createFolder(name);
}


function sanitizeName(s){
return String(s||'').replace(/[\\/:*?"<>|]/g,'_').trim();
}


function dataUrlToPngBlob(dataUrl, name){
const base64 = dataUrl.split(',')[1];
const bytes = Utilities.base64Decode(base64);
return Utilities.newBlob(bytes, 'image/png', name);
}


function replaceAll(body, kv){
Object.keys(kv).forEach(k=>{ body.replaceText(k, kv[k]); });
}


function insertImageAtMarker(body, marker, blob, width){
const range = body.findText(marker);
if (!range) return;
let cur = range;
while (cur){
const el = cur.getElement();
const p = el.getParent().asParagraph();
el.asText().deleteText(cur.getStartOffset(), cur.getEndOffset());
const img = p.insertInlineImage(0, blob);
if (width){
img.setWidth(width);
const ratio = blob.getDataAsString ? 1 : (img.getHeight() / img.getWidth()); // 안전장치
}
cur = body.findText(marker);
}
}


function getNextSequence(folder, basePrefix){
let maxSeq = 0;
const files = folder.getFiles();
while(files.hasNext()){
const f = files.next();
const name = f.getName();
if (name.indexOf(basePrefix)===0){
const m = name.match(/-(\d{3})(?:\.|_|$)/);
if (m){ maxSeq = Math.max(maxSeq, parseInt(m[1],10)); }
}
}
return maxSeq+1;
}