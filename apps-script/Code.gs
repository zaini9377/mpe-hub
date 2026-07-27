/**
 * MPE Hub - Google Apps Script backend
 * Deploy > New deployment > Web app
 * Execute as: Me | Who has access: Anyone
 */
const APP = {
  spreadsheetName: 'MPE Hub - Pangkalan Data',
  folderName: 'MPE Hub - Lampiran',
  projectCardFolderName: 'MPE Hub - Kad Projek Kumpulan',
  moduleTwoMemoFolderName: 'MPE Hub - Memo Modul 2',
  sheets: {
    logbook: ['Record ID','Timestamp','Nama','No. Pekerja','Bahagian','Makmal','Tarikh','Masa Masuk','Masa Keluar','Aktiviti','Pegawai','Butiran','Status','Lampiran URL'],
    asset: ['Record ID','Timestamp','No. Permohonan','Nama Pemohon','Jawatan','Bahagian','Tujuan','Tempat Digunakan','Nama Pengeluar','Tarikh Permohonan','Status','Butiran Aset'],
    mccb: ['Record ID','Timestamp','Test Ref. No.','Job No.','Company','Brand','Model','Type','Poles','Rated Current (A)','Short Circuit (kA)','Ambient Start','Ambient End','Humidity Start','Humidity End','TCD','Cable Size','Torque','Equipment','Rated at Test','1.05 Test Current','1.30 Test Current','Actual 1.05','Trip 1.05','Result 1.05','Actual 1.30','Trip 1.30','Result 1.30','Readings','Tested By','Tester Position','Verified By','Verifier Position','Test Date','Overall Result']
  }
};

function doGet(e) {
  return jsonResponse(handleRequest({action: (e && e.parameter && e.parameter.action) || 'dashboard'}));
}

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    return jsonResponse(handleRequest(payload));
  } catch (error) {
    return jsonResponse({ok:false,error:String(error && error.message || error)});
  }
}

function handleRequest(payload) {
  ensureSetup();
  if (payload.action === 'dashboard') return {ok:true,summary:getDashboardSummary()};
  if (payload.action === 'save') return saveRecord(payload.module, payload.data || {});
  if (payload.action === 'createProjectCard') return createProjectCard(payload.data || {});
  if (payload.action === 'createModuleTwoMemo') return createModuleTwoMemo(payload.data || {});
  return {ok:false,error:'Tindakan tidak dikenali'};
}

function createProjectCard(data) {
  data = data || {};
  const groupName = cleanText(data.groupName, 120);
  const title = cleanText(data.title, 180);
  const sections = Array.isArray(data.sections) ? data.sections : [];
  if (!groupName) return {ok:false,error:'Nama kumpulan diperlukan'};
  if (!title) return {ok:false,error:'Tajuk peluang diperlukan'};
  if (!sections.length) return {ok:false,error:'Jawapan kanvas tidak lengkap'};

  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const props = PropertiesService.getScriptProperties();
    let folderId = props.getProperty('PROJECT_CARD_FOLDER_ID');
    let folder;
    if (folderId) {
      try { folder = DriveApp.getFolderById(folderId); } catch (error) { folder = null; }
    }
    if (!folder) {
      folder = DriveApp.createFolder(APP.projectCardFolderName);
      props.setProperty('PROJECT_CARD_FOLDER_ID', folder.getId());
    }

    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Kuala_Lumpur', 'yyyyMMdd-HHmmss');
    const documentName = 'Kad Projek - ' + safeFileName(groupName) + ' - ' + timestamp;
    const doc = DocumentApp.create(documentName);
    const body = doc.getBody();
    body.clear();
    body.appendParagraph('KAD PROJEK KUMPULAN').setHeading(DocumentApp.ParagraphHeading.TITLE);
    body.appendParagraph(title).setHeading(DocumentApp.ParagraphHeading.HEADING1);
    body.appendParagraph('Kumpulan: ' + groupName);
    body.appendParagraph('Dijana daripada Kanvas Peluang Produktiviti MPE pada ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Kuala_Lumpur', 'dd MMMM yyyy, HH:mm'));
    body.appendHorizontalRule();

    sections.forEach(function(section) {
      const heading = cleanText(section.heading, 160);
      const items = Array.isArray(section.items) ? section.items : [];
      if (!heading || !items.length) return;
      body.appendParagraph(heading).setHeading(DocumentApp.ParagraphHeading.HEADING2);
      items.forEach(function(item) {
        const label = cleanText(item.label, 200);
        const value = cleanText(item.value, 2000);
        if (!label || !value) return;
        const paragraph = body.appendParagraph('');
        paragraph.appendText(label + ': ').setBold(true);
        paragraph.appendText(value);
      });
    });

    body.appendHorizontalRule();
    body.appendParagraph('Dokumen latihan — gunakan data rekaan sahaja. Semakan dan kelulusan manusia masih diperlukan.').setItalic(true);
    doc.saveAndClose();

    const file = DriveApp.getFileById(doc.getId());
    file.moveTo(folder);
    let sharingWarning = '';
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
    } catch (error) {
      sharingWarning = 'Dokumen dicipta tetapi polisi organisasi menghalang perkongsian pautan. Fasilitator perlu berkongsi dokumen secara manual.';
    }
    return {ok:true,documentId:doc.getId(),documentUrl:doc.getUrl(),documentName:documentName,sharingWarning:sharingWarning};
  } finally {
    lock.releaseLock();
  }
}

function authorizeProjectCard() {
  const doc = DocumentApp.create('MPE Hub - Pemeriksaan Kebenaran Google Docs');
  doc.getBody().appendParagraph('Fail sementara untuk mengesahkan kebenaran penciptaan Kad Projek Kumpulan.');
  doc.saveAndClose();
  DriveApp.getFileById(doc.getId()).setTrashed(true);
  Logger.log('Kebenaran Google Docs berjaya disahkan. Fail pemeriksaan telah dipindahkan ke Trash.');
}

function createModuleTwoMemo(data) {
  data = data || {};
  const groupName = cleanText(data.groupName, 120);
  const title = cleanText(data.title, 180);
  const sourceUrl = cleanText(data.sourceUrl, 1000);
  const sections = Array.isArray(data.sections) ? data.sections : [];
  if (!groupName) return {ok:false,error:'Nama kumpulan diperlukan'};
  if (!title) return {ok:false,error:'Tajuk projek diperlukan'};
  if (!sections.length) return {ok:false,error:'Kandungan memo tidak lengkap'};

  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const props = PropertiesService.getScriptProperties();
    let folderId = props.getProperty('MODULE_TWO_MEMO_FOLDER_ID');
    let folder;
    if (folderId) {
      try { folder = DriveApp.getFolderById(folderId); } catch (error) { folder = null; }
    }
    if (!folder) {
      folder = DriveApp.createFolder(APP.moduleTwoMemoFolderName);
      props.setProperty('MODULE_TWO_MEMO_FOLDER_ID', folder.getId());
    }

    const now = new Date();
    const timezone = Session.getScriptTimeZone() || 'Asia/Kuala_Lumpur';
    const timestamp = Utilities.formatDate(now, timezone, 'yyyyMMdd-HHmmss');
    const documentName = 'Memo Percubaan Kecil - ' + safeFileName(groupName) + ' - ' + timestamp;
    const doc = DocumentApp.create(documentName);
    const body = doc.getBody();
    body.clear();
    body.appendParagraph('DRAF — UNTUK LATIHAN SAHAJA').setHeading(DocumentApp.ParagraphHeading.SUBTITLE);
    body.appendParagraph('MEMO CADANGAN PERCUBAAN KECIL').setHeading(DocumentApp.ParagraphHeading.TITLE);
    body.appendParagraph(title).setHeading(DocumentApp.ParagraphHeading.HEADING1);
    body.appendParagraph('Kumpulan: ' + groupName);
    body.appendParagraph('Tarikh: [PERLU PENGESAHAN]');
    body.appendParagraph('Kepada: [PERLU PENGESAHAN]');
    body.appendParagraph('Daripada: [PERLU PENGESAHAN]');
    body.appendParagraph('No. rujukan: [PERLU PENGESAHAN]');
    if (sourceUrl) {
      const source = body.appendParagraph('Kad Projek Modul 1: ');
      source.appendText(sourceUrl).setLinkUrl(sourceUrl);
    }
    body.appendParagraph('Dijana pada ' + Utilities.formatDate(now, timezone, 'dd MMMM yyyy, HH:mm'));
    body.appendHorizontalRule();

    sections.forEach(function(section) {
      const heading = cleanText(section.heading, 160);
      const items = Array.isArray(section.items) ? section.items : [];
      if (!heading || !items.length) return;
      body.appendParagraph(heading).setHeading(DocumentApp.ParagraphHeading.HEADING2);
      items.forEach(function(item) {
        const label = cleanText(item.label, 200);
        const value = cleanText(item.value, 3000);
        if (!label || !value) return;
        const paragraph = body.appendParagraph('');
        paragraph.appendText(label + ': ').setBold(true);
        paragraph.appendText(value);
      });
    });

    body.appendHorizontalRule();
    body.appendParagraph('SEMAKAN MANUSIA WAJIB').setHeading(DocumentApp.ParagraphHeading.HEADING2);
    body.appendListItem('Semak semua fakta dan gantikan [PERLU PENGESAHAN].');
    body.appendListItem('Sahkan risiko, kawalan, pemilik dan ukuran kejayaan.');
    body.appendListItem('Kelulusan akhir kekal pada pegawai yang diberi kuasa.');
    body.appendParagraph('Dokumen ini ialah hasil latihan dan bukan rekod atau kelulusan rasmi.').setItalic(true);
    doc.saveAndClose();

    const file = DriveApp.getFileById(doc.getId());
    file.moveTo(folder);
    let sharingWarning = '';
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
    } catch (error) {
      sharingWarning = 'Dokumen dicipta tetapi polisi organisasi menghalang perkongsian pautan. Fasilitator perlu berkongsi dokumen secara manual.';
    }
    return {ok:true,documentId:doc.getId(),documentUrl:doc.getUrl(),documentName:documentName,sharingWarning:sharingWarning};
  } finally {
    lock.releaseLock();
  }
}

function cleanText(value, maxLength) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, maxLength || 2000);
}

function safeFileName(value) {
  return cleanText(value, 80).replace(/[\\/:*?"<>|]/g, '-');
}

function ensureSetup() {
  const props = PropertiesService.getScriptProperties();
  let spreadsheetId = props.getProperty('SPREADSHEET_ID');
  let folderId = props.getProperty('FOLDER_ID');
  let ss;
  if (!spreadsheetId) {
    ss = SpreadsheetApp.create(APP.spreadsheetName);
    spreadsheetId = ss.getId(); props.setProperty('SPREADSHEET_ID', spreadsheetId);
  } else ss = SpreadsheetApp.openById(spreadsheetId);
  Object.keys(APP.sheets).forEach(function(name) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getLastRow() === 0) {
      const headers = APP.sheets[name];
      sheet.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold').setBackground('#e6e9e3');
      sheet.setFrozenRows(1); sheet.getRange(1,1,1,headers.length).createFilter();
    }
  });
  const initial = ss.getSheetByName('Sheet1'); if (initial && ss.getSheets().length > 3) ss.deleteSheet(initial);
  if (!folderId) {
    const folder = DriveApp.createFolder(APP.folderName); folderId = folder.getId(); props.setProperty('FOLDER_ID', folderId);
  }
  return {ss:ss,folder:DriveApp.getFolderById(folderId)};
}

function saveRecord(module, data) {
  if (!APP.sheets[module]) return {ok:false,error:'Modul tidak sah'};
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const setup = ensureSetup(); const sheet = setup.ss.getSheetByName(module);
    const recordId = createRecordId(module); const now = new Date(); let row;
    if (module === 'logbook') {
      let attachmentUrl = '';
      if (data.lampiran && data.lampiran.data) attachmentUrl = saveAttachment(setup.folder, recordId, data.lampiran);
      row=[recordId,now,data.nama,data.noPekerja,data.bahagian,data.makmal,data.tarikh,data.masaMasuk,data.masaKeluar||'',data.aktiviti,data.pegawai||'',data.butiran,data.status,attachmentUrl];
    } else if (module === 'asset') {
      row=[recordId,now,data.noPermohonan,data.namaPemohon,data.jawatan,data.bahagian,data.tujuan,data.tempat,data.namaPengeluar||'',data.tarikhPermohonan,data.status,JSON.stringify(data.items||[])];
    } else {
      const rated=(Number(data.ratedCurrent)||0)*(Number(data.tcd)||0);
      row=[recordId,now,data.testRef,data.jobNo,data.company,data.brand,data.model,data.type,data.poles,data.ratedCurrent,data.shortCircuit||'',data.ambientStart,data.ambientEnd||'',data.humidityStart,data.humidityEnd||'',data.tcd,data.cableSize||'',data.torque||'',JSON.stringify(data.equipment||[]),rated,rated*1.05,rated*1.30,data.actual105||'',data.trip105||'',data.result105,data.actual130||'',data.trip130||'',data.result130,JSON.stringify(data.readings||[]),data.testedBy,data.testerPosition,data.verifiedBy||'',data.verifierPosition||'',data.testDate,data.overallResult];
    }
    sheet.appendRow(row); return {ok:true,recordId:recordId};
  } finally { lock.releaseLock(); }
}

function saveAttachment(folder, recordId, attachment) {
  const bytes=Utilities.base64Decode(attachment.data); const safeName=String(attachment.name||'lampiran').replace(/[^a-zA-Z0-9._-]/g,'_');
  const blob=Utilities.newBlob(bytes,attachment.type||'application/octet-stream',recordId+'_'+safeName); return folder.createFile(blob).getUrl();
}

function createRecordId(module) {
  const prefix={logbook:'LOG',asset:'PA9',mccb:'TR'}[module];
  return prefix+'-'+Utilities.formatDate(new Date(),Session.getScriptTimeZone()||'Asia/Kuala_Lumpur','yyyyMMdd-HHmmss');
}

function getDashboardSummary() {
  const setup=ensureSetup(),ss=setup.ss; const log=ss.getSheetByName('logbook'),asset=ss.getSheetByName('asset'),mccb=ss.getSheetByName('mccb');
  const logRows=getRows(log),assetRows=getRows(asset),testRows=getRows(mccb); const today=Utilities.formatDate(new Date(),Session.getScriptTimeZone()||'Asia/Kuala_Lumpur','yyyy-MM-dd');
  const activeAssets=assetRows.filter(function(r){return !/Dipulangkan|Tidak Lulus/i.test(String(r[10]||''));}).length;
  const passed=testRows.filter(function(r){return /pass|lulus/i.test(String(r[34]||''));}).length; const passRate=testRows.length?Math.round(passed/testRows.length*100):0;
  const incomplete=logRows.filter(function(r){return /Tidak Lengkap|Dalam Pelaksanaan/i.test(String(r[12]||''));}).length + testRows.filter(function(r){return /fail/i.test(String(r[34]||''));}).length;
  const recent=[];
  logRows.slice(-3).forEach(function(r){recent.push({module:'logbook',timestamp:r[1],title:r[9]||'Aktiviti makmal',meta:(r[5]||'Makmal')+' · '+(r[7]||''),status:r[12]||''});});
  assetRows.slice(-3).forEach(function(r){recent.push({module:'asset',timestamp:r[1],title:'Pinjaman '+(r[6]||'aset'),meta:r[2]||'',status:r[10]||''});});
  testRows.slice(-3).forEach(function(r){recent.push({module:'mccb',timestamp:r[1],title:'MCCB '+(r[9]||'')+'A · '+(r[5]||''),meta:r[2]||'',status:r[34]||''});});
  recent.sort(function(a,b){return new Date(b.timestamp)-new Date(a.timestamp);});
  return {logbook:logRows.length,assets:activeAssets,passRate:passRate,actions:incomplete,total:logRows.length+assetRows.length+testRows.length,logToday:logRows.filter(function(r){return String(r[6])===today;}).length,recent:recent.slice(0,5)};
}

function getRows(sheet) {
  if (sheet.getLastRow()<2) return [];
  return sheet.getRange(2,1,sheet.getLastRow()-1,sheet.getLastColumn()).getValues();
}

function jsonResponse(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function getStorageLinks() {
  const setup=ensureSetup();
  Logger.log('Spreadsheet: '+setup.ss.getUrl());
  Logger.log('Folder: '+setup.folder.getUrl());
}
