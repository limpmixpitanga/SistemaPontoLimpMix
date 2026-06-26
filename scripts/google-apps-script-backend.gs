const TOKEN = 'limpmix-ponto-2026';
const PROP_KEY = 'LIMPMIX_PONTO_STATE';
const SHEET_ID_KEY = 'LIMPMIX_PONTO_SHEET_ID';
const FOLDER_ID = '1M3Hx8BjmgQpkL9HfI3X6y9Yrx-CE1QLs';
const SHEET_NAME = 'Sistema Ponto LimpMix - Registros';

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

  const state = loadState_();
  const spreadsheet = getSpreadsheet_();
  writeSpreadsheet_(state, spreadsheet);
  return jsonp(callback, { ok: true, state: state, spreadsheetUrl: spreadsheet.getUrl() });
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
    const spreadsheet = getSpreadsheet_();
    writeSpreadsheet_(merged, spreadsheet);
    return json({ ok: true, spreadsheetUrl: spreadsheet.getUrl() });
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

function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty(SHEET_ID_KEY);
  if (existingId) {
    try {
      return SpreadsheetApp.openById(existingId);
    } catch (error) {
      props.deleteProperty(SHEET_ID_KEY);
    }
  }

  const spreadsheet = SpreadsheetApp.create(SHEET_NAME);
  props.setProperty(SHEET_ID_KEY, spreadsheet.getId());

  try {
    const file = DriveApp.getFileById(spreadsheet.getId());
    const folder = DriveApp.getFolderById(FOLDER_ID);
    folder.addFile(file);
    DriveApp.getRootFolder().removeFile(file);
  } catch (error) {
    console.warn(error);
  }

  return spreadsheet;
}

function writeSpreadsheet_(state, spreadsheet) {
  writeFuncionarios_(spreadsheet, state.cadastros.usuarios || []);
  writeRegistros_(spreadsheet, state.registros.registros || [], state.cadastros.usuarios || []);
  writeLogs_(spreadsheet, state.registros.logs || []);
  writeResumo_(spreadsheet, state);
}

function writeFuncionarios_(spreadsheet, usuarios) {
  const sheet = prepareSheet_(spreadsheet, 'Funcionarios');
  const rows = [
    ['ID', 'Nome', 'Usuario', 'Tipo', 'Funcao', 'Setor', 'Data Admissao', 'Entrada', 'Almoco', 'Retorno', 'Saida', 'Tolerancia', 'Ativo'],
    ...usuarios.map((user) => [
      user.id,
      user.nome,
      user.usuario,
      user.tipo,
      user.funcao || '',
      user.setor || '',
      user.dataAdmissao || '',
      user.horarioEntrada || '',
      user.horarioAlmoco || '',
      user.horarioRetorno || '',
      user.horarioSaida || '',
      user.tolerancia || '',
      user.ativo ? 'Sim' : 'Nao'
    ])
  ];
  setRows_(sheet, rows);
}

function writeRegistros_(spreadsheet, registros, usuarios) {
  const sheet = prepareSheet_(spreadsheet, 'Registros');
  const userById = {};
  usuarios.forEach((user) => userById[user.id] = user);
  const rows = [
    ['ID', 'Funcionario', 'Usuario', 'Data', 'Hora', 'Tipo', 'Justificativa', 'Criado Em', 'Editado Em', 'Editado Por', 'Email Primeira Batida'],
    ...registros
      .slice()
      .sort((a, b) => String(`${a.data} ${a.hora}`).localeCompare(String(`${b.data} ${b.hora}`)))
      .map((record) => {
        const user = userById[record.usuarioId] || {};
        return [
          record.id,
          user.nome || record.usuarioId,
          user.usuario || '',
          record.data || '',
          record.hora || '',
          record.tipo || '',
          record.justificativa || '',
          record.criadoEm || '',
          record.editadoEm || '',
          record.editadoPor || '',
          record.emailPrimeiraBatida || ''
        ];
      })
  ];
  setRows_(sheet, rows);
}

function writeLogs_(spreadsheet, logs) {
  const sheet = prepareSheet_(spreadsheet, 'Logs');
  const rows = [
    ['ID', 'Usuario', 'Acao', 'Data/Hora'],
    ...logs
      .slice()
      .sort((a, b) => String(a.dataHora).localeCompare(String(b.dataHora)))
      .map((log) => [log.id, log.usuario, log.acao, log.dataHora])
  ];
  setRows_(sheet, rows);
}

function writeResumo_(spreadsheet, state) {
  const sheet = prepareSheet_(spreadsheet, 'Resumo');
  const usuarios = state.cadastros.usuarios || [];
  const registros = state.registros.registros || [];
  const hoje = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd');
  const rows = [
    ['Indicador', 'Valor'],
    ['Atualizado em', Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd HH:mm:ss')],
    ['Funcionarios ativos', usuarios.filter((user) => user.ativo && user.tipo === 'FUNCIONARIO').length],
    ['Registros totais', registros.length],
    ['Registros hoje', registros.filter((record) => record.data === hoje).length],
    ['Ultima batida', registros.length ? JSON.stringify(registros[registros.length - 1]) : '']
  ];
  setRows_(sheet, rows);
}

function prepareSheet_(spreadsheet, name) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  sheet.clear();
  return sheet;
}

function setRows_(sheet, rows) {
  if (!rows.length) return;
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sheet.getRange(1, 1, 1, rows[0].length).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, rows[0].length);
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
  try {
    const folder = DriveApp.getFolderById(FOLDER_ID);
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
