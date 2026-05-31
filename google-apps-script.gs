const SHEET_NAME = "Satir 五種自由回應";
const AXES = [
  { id: "see-hear", label: "自由地看和聽" },
  { id: "say", label: "自由地說出所感所想" },
  { id: "feel", label: "自由地感覺" },
  { id: "ask", label: "自由地要求你所想要的" },
  { id: "risk", label: "自由地根據自己想法去冒險" },
];
const DIMENSIONS = [
  { id: "importance", label: "重視程度" },
  { id: "usage", label: "使用頻率" },
  { id: "familiarity", label: "熟悉程度" },
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const payload = JSON.parse(e.postData.contents);
    const sheet = getResponseSheet_();
    const headers = getHeaders_(payload);
    ensureHeaders_(sheet, headers);

    if (payload.action === "archive") {
      const archiveName = archiveAndReset_(sheet, headers);
      return jsonOutput_({ ok: true, action: "archive", archiveName });
    }

    const row = buildRow_(payload, headers);
    sheet.appendRow(row);

    return jsonOutput_({ ok: true, action: "append" });
  } catch (error) {
    return jsonOutput_({ ok: false, error: String(error) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  const callback = e && e.parameter && e.parameter.callback;

  if (action === "list") {
    return output_(listResponses_(), callback);
  }

  return ContentService
    .createTextOutput("Satir 五種自由 Google Sheet 記錄服務已啟用")
    .setMimeType(ContentService.MimeType.TEXT);
}

function getResponseSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  return spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
}

function getHeaders_(payload) {
  const headers = ["送出時間", "問卷名稱", "填答者", "回應ID"];

  payload.dimensions.forEach((dimension) => {
    payload.axes.forEach((axis) => {
      headers.push(`${dimension.label}-${axis.label}`);
    });
  });

  return headers;
}

function ensureHeaders_(sheet, headers) {
  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const hasHeaders = firstRow.some((value) => value);

  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  }
}

function archiveAndReset_(sheet, headers) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const archiveName = buildArchiveSheetName_();
  const archiveSheet = sheet.copyTo(spreadsheet).setName(archiveName);
  spreadsheet.setActiveSheet(archiveSheet);
  spreadsheet.moveActiveSheet(spreadsheet.getNumSheets());

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);

  return archiveName;
}

function buildArchiveSheetName_() {
  const timestamp = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyyMMdd-HHmmss"
  );
  return `備份-${timestamp}`;
}

function listResponses_() {
  const sheet = getResponseSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return { ok: true, responses: [] };
  }

  const headers = values[0].map(String);
  const responses = values.slice(1)
    .filter((row) => row.some((value) => value !== ""))
    .map((row, index) => rowToResponse_(headers, row, index));

  return { ok: true, responses };
}

function rowToResponse_(headers, row, index) {
  const rowMap = {};
  headers.forEach((header, columnIndex) => {
    rowMap[header] = row[columnIndex];
  });

  const scores = {};
  DIMENSIONS.forEach((dimension) => {
    scores[dimension.id] = {};
    AXES.forEach((axis) => {
      const value = rowMap[`${dimension.label}-${axis.label}`];
      scores[dimension.id][axis.id] = Number(value || 0);
    });
  });

  const createdAt = rowMap["送出時間"];
  return {
    id: String(rowMap["回應ID"] || `sheet-row-${index + 2}`),
    name: String(rowMap["填答者"] || `填答者 ${index + 1}`),
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : String(createdAt || ""),
    scores,
  };
}

function buildRow_(payload, headers) {
  const rowMap = {
    "送出時間": payload.createdAt || new Date().toISOString(),
    "問卷名稱": payload.survey || "Satir 五種自由",
    "填答者": payload.respondent || "",
    "回應ID": payload.responseId || "",
  };

  payload.dimensions.forEach((dimension) => {
    payload.axes.forEach((axis) => {
      rowMap[`${dimension.label}-${axis.label}`] = payload.scores[dimension.id][axis.id];
    });
  });

  return headers.map((header) => rowMap[header] ?? "");
}

function jsonOutput_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function output_(data, callback) {
  if (callback) {
    return ContentService
      .createTextOutput(`${callback}(${JSON.stringify(data)});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return jsonOutput_(data);
}
