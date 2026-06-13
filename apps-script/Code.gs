const SERVICE_VERSION = "2026-06-12.7";
const SCHEMA = {
  Clientes: ["key", "idPessoa", "name", "document", "phone", "status", "units", "country", "state", "city", "zip",
    "street", "number", "complement", "neighborhood", "address", "addressHash", "hash", "updatedAt", "datasetVersion"],
  Pets: ["key", "idPessoa", "name", "updatedAt", "datasetVersion"],
  Geocodificacao: ["key", "idPessoa", "addressHash", "inputCountry", "inputState", "inputCity", "inputZip", "inputStreet",
    "inputNumber", "inputComplement", "inputNeighborhood", "formattedAddress", "country", "state", "city", "zip", "street",
    "number", "complement", "neighborhood", "placeId", "lat", "lng", "quality", "status", "failureReason", "distanceKm",
    "validationVersion", "geocodedAt", "datasetVersion"],
  Overrides: ["overrideId", "idPessoa", "kind", "correctedIdPessoa", "correctedAddress", "retryGeocode", "status", "updatedAt", "updatedBy", "justification"],
  Meta: ["key", "value", "updatedAt"],
  Configuracoes: ["key", "value", "updatedAt"],
  Execucoes: ["runId", "startedAt", "finishedAt", "status", "result", "type", "periodStart", "periodEnd", "visibleUser",
    "pertinent", "accepted", "rejected", "mapped", "pending", "error", "counters"],
  LogDetalhado: ["runId", "timestamp", "source", "idPessoa", "reason", "message"],
  Diagnostico: ["testId", "createdAt", "artificial"],
  Pendencias: ["pendingId", "source", "reason", "idPessoa", "customerName", "message", "status", "resolvedAt", "resolvedBy"],
  ResolucaoPendencias: ["auditId", "pendingId", "action", "previousValue", "correctedValue", "visibleUser", "timestamp", "justification"],
  Staging: ["runId", "kind", "data", "stagedAt"]
};

function doGet() { return output_({ ok: true, service: "Clube04 Geolocalizacao", version: SERVICE_VERSION }); }
function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents || "{}");
    if (request.secret !== PropertiesService.getScriptProperties().getProperty("WRITE_SECRET")) throw new Error("Segredo invalido.");
    ensureSheets_();
    const actions = { snapshot: snapshot_, stageBatch: stageBatch_, publishRun: publishRun_, discardRun: discardRun_,
      startRun: startRun_, finishRun: finishRun_, saveSettings: saveSettings_, logs: logs_, cleanup: cleanup_,
      healthCheck: healthCheck_, testWrite: testWrite_, testStaging: testStaging_, pendings: pendings_,
      resolvePending: resolvePending_, reopenPending: reopenPending_, consumeRetries: consumeRetries_,
      migrationPreview: migrationPreview_, resetDatabase: resetDatabase_ };
    if (!actions[request.action]) throw new Error("Acao invalida.");
    return output_({ ok: true, data: actions[request.action](request.payload || {}) });
  } catch (error) { return output_({ ok: false, error: error.message }); }
}
function ensureSheets_() {
  const file = SpreadsheetApp.getActive();
  Object.keys(SCHEMA).forEach(name => {
    const sheet = file.getSheetByName(name) || file.insertSheet(name), expected = SCHEMA[name];
    if (!sheet.getLastRow()) { sheet.getRange(1, 1, 1, expected.length).setValues([expected]); return; }
    const current = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (JSON.stringify(current) === JSON.stringify(expected)) return;
    const records = sheet.getDataRange().getValues().slice(1).filter(row => row.some(value => value !== ""))
      .map(row => Object.fromEntries(current.map((key, index) => [key, row[index]])));
    writeObjects_(name, records);
  });
}
function rows_(name) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(name), values = sheet.getDataRange().getValues();
  return values.slice(1).filter(row => row.some(value => value !== ""))
    .map(row => Object.fromEntries(values[0].map((key, index) => [key, parse_(row[index])])));
}
function writeObjects_(name, records) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(name), headers = SCHEMA[name];
  sheet.clearContents(); sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (records && records.length) sheet.getRange(2, 1, records.length, headers.length)
    .setValues(records.map(item => headers.map(key => stringify_(item[key]))));
}
function append_(name, records) {
  if (!records || !records.length) return;
  const sheet = SpreadsheetApp.getActive().getSheetByName(name), headers = SCHEMA[name];
  sheet.getRange(sheet.getLastRow() + 1, 1, records.length, headers.length)
    .setValues(records.map(item => headers.map(key => stringify_(item[key]))));
}
function upsert_(name, records, key) {
  const map = new Map(rows_(name).map(item => [String(item[key]), item]));
  (records || []).filter(item => String(item[key] || "")).forEach(item => map.set(String(item[key]), Object.assign(map.get(String(item[key])) || {}, item)));
  writeObjects_(name, Array.from(map.values()));
}
function versionRows_(name, version) {
  return rows_(name).filter(item => version === "legacy" ? !item.datasetVersion : String(item.datasetVersion) === String(version));
}
function merge_(base, changes, key) {
  const map = new Map((base || []).map(item => [String(item[key]), item]));
  (changes || []).forEach(item => map.set(String(item[key]), Object.assign({}, map.get(String(item[key])) || {}, item)));
  return Array.from(map.values());
}
function stageBatch_(payload) {
  const runId = String(payload.runId || ""); if (!runId) throw new Error("runId obrigatorio.");
  const staged = [];
  ["customers", "pets", "geocodes", "logs", "pendings"].forEach(kind =>
    (payload[kind] || []).forEach(item => staged.push({ runId, kind, data: item, stagedAt: new Date().toISOString() })));
  append_("Staging", staged); return { staged: staged.length };
}
function discardRun_(payload) {
  writeObjects_("Staging", rows_("Staging").filter(item => String(item.runId) !== String(payload.runId || "")));
  return { runId: payload.runId, discarded: true };
}
function publishRun_(payload) {
  const lock = LockService.getDocumentLock(); lock.waitLock(30000);
  try {
    const runId = String(payload.runId || ""), staged = rows_("Staging").filter(item => String(item.runId) === runId);
    if (!runId || (!staged.length && !payload.emptyPeriod)) throw new Error("Nenhum dado preparado para publicacao.");
    if (payload.emptyPeriod) {
      setMeta_({ lastSync: new Date().toISOString(), runId, serviceVersion: SERVICE_VERSION, sourceTotals: payload.sourceTotals || {}, result: "empty_period" });
      discardRun_({ runId }); return { runId, result: "empty_period", datasetVersion: readKeyValues_("Meta").activeVersion || "" };
    }
    const group = kind => staged.filter(item => item.kind === kind).map(item => item.data);
    const customers = group("customers"), pets = group("pets"), geocodes = group("geocodes"), logs = group("logs"), pendings = group("pendings");
    if (!customers.length && !pendings.length) throw new Error("Publicacao bloqueada: nenhum cliente ou pendencia contabilizada.");
    const meta = readKeyValues_("Meta"), active = meta.activeVersion || "legacy", version = runId, processed = new Set(customers.map(item => String(item.idPessoa)));
    const nextCustomers = merge_(versionRows_("Clientes", active), customers, "idPessoa");
    const nextPets = versionRows_("Pets", active).filter(item => !processed.has(String(item.idPessoa))).concat(pets);
    const nextGeocodes = merge_(versionRows_("Geocodificacao", active), geocodes, "idPessoa");
    validateSnapshot_(nextCustomers, nextPets, nextGeocodes);
    appendVersion_("Clientes", nextCustomers, version); appendVersion_("Pets", nextPets, version); appendVersion_("Geocodificacao", nextGeocodes, version);
    if (logs.length) append_("LogDetalhado", logs); if (pendings.length) upsert_("Pendencias", pendings, "pendingId");
    setMeta_({ activeVersion: version, previousVersion: active, lastSync: new Date().toISOString(), runId,
      serviceVersion: SERVICE_VERSION, sourceTotals: payload.sourceTotals || {} });
    pruneVersions_(version, active); discardRun_({ runId });
    return { runId, datasetVersion: version, customers: customers.length, pets: pets.length, geocodes: geocodes.length,
      pendings: pendings.length, result: pendings.length ? "success_with_pendings" : "success" };
  } finally { lock.releaseLock(); }
}
function validateSnapshot_(customers, pets, geocodes) {
  if (customers.some(item => !item.idPessoa)) throw new Error("Snapshot invalido: cliente sem idPessoa.");
  const ids = new Set(customers.map(item => String(item.idPessoa)));
  if (pets.some(item => !ids.has(String(item.idPessoa))) || geocodes.some(item => !ids.has(String(item.idPessoa))))
    throw new Error("Snapshot invalido: relacionamento sem cliente.");
}
function appendVersion_(name, records, version) { append_(name, records.map(item => Object.assign({}, item, { datasetVersion: version }))); }
function pruneVersions_(active, previous) {
  ["Clientes", "Pets", "Geocodificacao"].forEach(name =>
    writeObjects_(name, rows_(name).filter(item => String(item.datasetVersion || "legacy") === String(active) ||
      String(item.datasetVersion || "legacy") === String(previous))));
}
function snapshot_() {
  const meta = readKeyValues_("Meta"), active = meta.activeVersion || "legacy";
  return { customers: versionRows_("Clientes", active), pets: versionRows_("Pets", active), geocodes: versionRows_("Geocodificacao", active),
    pendings: rows_("Pendencias"), overrides: rows_("Overrides").filter(item => item.status !== "inactive"), meta, settings: readKeyValues_("Configuracoes") };
}
function startRun_(payload) {
  const runId = Utilities.getUuid(); abandonRunning_();
  append_("Execucoes", [{ runId, startedAt: new Date().toISOString(), status: "running", type: payload.type,
    periodStart: payload.period.start, periodEnd: payload.period.end, visibleUser: payload.visibleUser || "" }]);
  return { runId };
}
function abandonRunning_() {
  const now = new Date(), cutoff = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  writeObjects_("Execucoes", rows_("Execucoes").map(item => item.status === "running" && new Date(item.startedAt) < cutoff ?
    Object.assign(item, { status: "abandoned", finishedAt: now.toISOString(), error: "Execucao interrompida sem conclusao." }) : item));
}
function finishRun_(payload) {
  writeObjects_("Execucoes", rows_("Execucoes").map(item => item.runId === payload.runId ? Object.assign(item, payload, { finishedAt: new Date().toISOString() }) : item));
  return { runId: payload.runId };
}
function writeKeyValues_(name, object) {
  const now = new Date().toISOString(), output = []; flatten_(object, "", output, now); writeObjects_(name, output);
}
function setMeta_(object) { writeKeyValues_("Meta", Object.assign({}, readKeyValues_("Meta"), object)); }
function flatten_(value, prefix, output, now) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    Object.keys(value).forEach(key => flatten_(value[key], prefix ? prefix + "." + key : key, output, now)); return;
  }
  output.push({ key: prefix, value, updatedAt: now });
}
function readKeyValues_(name) {
  const result = {};
  rows_(name).forEach(item => {
    const parts = String(item.key).split("."); let target = result;
    parts.forEach((part, index) => { if (index === parts.length - 1) target[part] = item.value; else target = target[part] || (target[part] = {}); });
  }); return result;
}
function saveSettings_(payload) { writeKeyValues_("Configuracoes", payload); return payload; }
function logs_() { return { executions: rows_("Execucoes"), details: rows_("LogDetalhado") }; }
function consistency_(meta) {
  const customers = versionRows_("Clientes", meta.activeVersion || "legacy"), pets = versionRows_("Pets", meta.activeVersion || "legacy");
  const geocodes = versionRows_("Geocodificacao", meta.activeVersion || "legacy"), overrides = rows_("Overrides").filter(item => item.status !== "inactive");
  const ids = new Set(customers.map(item => String(item.idPessoa))), duplicateIds = customers.map(item => String(item.idPessoa))
    .filter((id, index, all) => id && all.indexOf(id) !== index);
  const orphan = rows => rows.filter(item => item.idPessoa && !ids.has(String(item.idPessoa))).map(item => String(item.idPessoa));
  const result = { duplicateCustomerIds: Array.from(new Set(duplicateIds)), orphanPets: orphan(pets),
    orphanGeocodes: orphan(geocodes), orphanOverrides: orphan(overrides) };
  result.ok = Object.keys(result).filter(key => key !== "ok").every(key => result[key].length === 0); return result;
}
function healthCheck_() {
  abandonRunning_(); const file = SpreadsheetApp.getActive(), meta = readKeyValues_("Meta");
  const sheets = Object.keys(SCHEMA).map(name => {
    const sheet = file.getSheetByName(name), headers = sheet && sheet.getLastColumn() ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
    return { name, rows: sheet ? Math.max(0, sheet.getLastRow() - 1) : 0, schemaOk: JSON.stringify(headers) === JSON.stringify(SCHEMA[name]) };
  });
  const consistency = consistency_(meta);
  return { ok: sheets.every(item => item.schemaOk) && consistency.ok, serviceVersion: SERVICE_VERSION, spreadsheetId: file.getId(),
    activeVersion: meta.activeVersion || "legacy", sheets, consistency,
    stagingRuns: Array.from(new Set(rows_("Staging").map(item => item.runId))), running: rows_("Execucoes").filter(item => item.status === "running").length };
}
function testWrite_() {
  const testId = "diagnostic-" + Utilities.getUuid(), record = { testId, createdAt: new Date().toISOString(), artificial: true };
  append_("Diagnostico", [record]); const found = rows_("Diagnostico").some(item => item.testId === testId);
  writeObjects_("Diagnostico", rows_("Diagnostico").filter(item => item.testId !== testId));
  return { ok: found, testId, removed: !rows_("Diagnostico").some(item => item.testId === testId) };
}
function testStaging_() {
  const runId = "diagnostic-" + Utilities.getUuid(); stageBatch_({ runId, logs: [{ runId, timestamp: new Date().toISOString(), source: "Diagnostico", reason: "artificial" }] });
  const found = rows_("Staging").some(item => item.runId === runId); discardRun_({ runId });
  return { ok: found && !rows_("Staging").some(item => item.runId === runId), runId, removed: true };
}
function pendings_(payload) { return rows_("Pendencias").filter(item => !payload.status || item.status === payload.status); }
function resolvePending_(payload) {
  const actor = payload.visibleUser || "", now = new Date().toISOString(), all = rows_("Pendencias");
  const previous = all.find(item => item.pendingId === payload.pendingId) || {};
  const status = payload.action === "ignore" ? "ignored" : payload.action === "retry_geocode" ? "open" : "resolved";
  writeObjects_("Pendencias", all.map(item => item.pendingId === payload.pendingId ? Object.assign(item, { status, resolvedAt: now, resolvedBy: actor }) : item));
  const idPessoa = payload.idPessoa || previous.idPessoa;
  if (idPessoa && (payload.correctedAddress || payload.action === "retry_geocode" || payload.correctedIdPessoa))
    upsert_("Overrides", [{ overrideId: "override:" + idPessoa, idPessoa, kind: payload.correctedAddress ? "address" : "relationship",
      correctedIdPessoa: payload.correctedIdPessoa || "", correctedAddress: payload.correctedAddress || "",
      retryGeocode: payload.action === "retry_geocode", status: "active", updatedAt: now, updatedBy: actor, justification: payload.justification || "" }], "overrideId");
  append_("ResolucaoPendencias", [{ auditId: Utilities.getUuid(), pendingId: payload.pendingId, action: payload.action, previousValue: previous,
    correctedValue: payload, visibleUser: actor, timestamp: now, justification: payload.justification || "" }]);
  return { pendingId: payload.pendingId, status, overrideApplied: Boolean(idPessoa && (payload.correctedAddress || payload.action === "retry_geocode" || payload.correctedIdPessoa)) };
}
function reopenPending_(payload) {
  const now = new Date().toISOString(), actor = payload.visibleUser || "", all = rows_("Pendencias");
  writeObjects_("Pendencias", all.map(item => item.pendingId === payload.pendingId ? Object.assign(item, { status: "open", resolvedAt: "", resolvedBy: "" }) : item));
  append_("ResolucaoPendencias", [{ auditId: Utilities.getUuid(), pendingId: payload.pendingId, action: "reopen", visibleUser: actor, timestamp: now,
    justification: payload.justification || "" }]); return { pendingId: payload.pendingId, status: "open" };
}
function consumeRetries_() {
  const all = rows_("Overrides"), changed = all.filter(item => item.retryGeocode === true || item.retryGeocode === "true").length;
  writeObjects_("Overrides", all.map(item => Object.assign({}, item, { retryGeocode: false })));
  return { consumed: changed };
}
function cleanup_(payload) {
  const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - Number(payload.retentionMonths || 12));
  ["Execucoes", "LogDetalhado", "ResolucaoPendencias"].forEach(name =>
    writeObjects_(name, rows_(name).filter(item => new Date(item.startedAt || item.timestamp || item.createdAt) >= cutoff)));
  abandonRunning_(); return { cutoff: cutoff.toISOString() };
}
function migrationPreview_() { return { confirmation: "LIMPAR BANCO GEO", activeVersion: readKeyValues_("Meta").activeVersion || "legacy",
  sheets: Object.keys(SCHEMA).map(name => ({ name, rows: rows_(name).length })) }; }
function resetDatabase_(payload) {
  if (payload.confirmation !== "LIMPAR BANCO GEO") throw new Error("Confirmacao invalida.");
  Object.keys(SCHEMA).forEach(name => writeObjects_(name, [])); writeKeyValues_("Meta", { resetAt: new Date().toISOString(), serviceVersion: SERVICE_VERSION });
  return { reset: true, serviceVersion: SERVICE_VERSION };
}
function parse_(value) { if (typeof value !== "string") return value; try { return JSON.parse(value); } catch (_) { return value; } }
function stringify_(value) { return value && typeof value === "object" ? JSON.stringify(value) : value == null ? "" : value; }
function output_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
