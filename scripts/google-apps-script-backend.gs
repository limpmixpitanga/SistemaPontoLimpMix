const TOKEN = 'limpmix-ponto-2026';
const PROP_KEY = 'LIMPMIX_PONTO_STATE';

function doGet(e) {
  const callback = e.parameter.callback || 'callback';
  const action = e.parameter.action || 'load';
  const token = e.parameter.token || '';

  if (token !== TOKEN) {
    return jsonp(callback, { ok: false, error: 'Token invalido.' });
  }

  if (action !== 'load') {
    return jsonp(callback, { ok: false, error: 'Acao invalida.' });
  }

  return jsonp(callback, { ok: true, state: loadState_() });
}

function doPost(e) {
  const payload = JSON.parse(e.postData.contents || '{}');
  if (payload.token !== TOKEN) {
    return json({ ok: false, error: 'Token invalido.' });
  }

  if (payload.action === 'save') {
    const current = loadState_();
    const merged = mergeState_(current, payload.state);
    saveState_(merged);
    return json({ ok: true });
  }

  return json({ ok: false, error: 'Acao invalida.' });
}

function loadState_() {
  const raw = PropertiesService.getScriptProperties().getProperty(PROP_KEY);
  if (raw) return JSON.parse(raw);
  return {
    cadastros: {
      usuarios: [],
      configuracoes: {}
    },
    registros: {
      registros: [],
      logs: []
    }
  };
}

function saveState_(state) {
  PropertiesService.getScriptProperties().setProperty(PROP_KEY, JSON.stringify(state));
  backupToDrive_(state);
}

function mergeState_(current, incoming) {
  const result = current || loadState_();
  incoming = incoming || loadState_();

  result.cadastros = result.cadastros || { usuarios: [], configuracoes: {} };
  result.registros = result.registros || { registros: [], logs: [] };
  incoming.cadastros = incoming.cadastros || { usuarios: [], configuracoes: {} };
  incoming.registros = incoming.registros || { registros: [], logs: [] };

  const users = {};
  (result.cadastros.usuarios || []).forEach((user) => users[String(user.usuario).toLowerCase()] = user);
  (incoming.cadastros.usuarios || []).forEach((user) => users[String(user.usuario).toLowerCase()] = user);

  const records = {};
  (result.registros.registros || []).forEach((record) => records[String(record.id)] = record);
  (incoming.registros.registros || []).forEach((record) => records[String(record.id)] = record);

  const logs = {};
  (result.registros.logs || []).forEach((log) => logs[String(log.id)] = log);
  (incoming.registros.logs || []).forEach((log) => logs[String(log.id)] = log);

  return {
    cadastros: {
      usuarios: Object.values(users),
      configuracoes: Object.assign({}, result.cadastros.configuracoes || {}, incoming.cadastros.configuracoes || {})
    },
    registros: {
      registros: Object.values(records),
      logs: Object.values(logs)
    }
  };
}

function backupToDrive_(state) {
  const folderId = '1M3Hx8BjmgQpkL9HfI3X6y9Yrx-CE1QLs';
  try {
    const folder = DriveApp.getFolderById(folderId);
    const now = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyyMMdd_HHmmss');
    folder.createFile(`backup_ponto_limpMix_${now}.json`, JSON.stringify(state, null, 2), MimeType.PLAIN_TEXT);
  } catch (error) {
    console.warn(error);
  }
}

function json(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonp(callback, payload) {
  return ContentService
    .createTextOutput(`${callback}(${JSON.stringify(payload)});`)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
