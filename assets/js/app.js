const STORAGE_KEY = "limpmix-ponto-state-v1";

const DEFAULT_STATE = {
  cadastros: {
    usuarios: [
      {
        id: 1,
        nome: "Administrador",
        usuario: "master",
        senhaHash: "e7bc2f973afb8dfaf00fadfb19596741108be08ab4a107c6a799c429b684c64a",
        tipo: "MASTER",
        funcao: "Administrador",
        setor: "Gestao",
        dataAdmissao: todayISO(),
        horarioEntrada: "08:00",
        horarioAlmoco: "12:00",
        horarioRetorno: "13:00",
        horarioSaida: "18:00",
        tolerancia: 10,
        ativo: true
      }
    ],
    configuracoes: {
      empresa: "LimpMix Pitanga",
      janelaInicio: "07:50",
      janelaFim: "18:30"
    }
  },
  registros: {
    registros: [],
    logs: []
  }
};

const pointTypes = ["ENTRADA", "SAIDA_ALMOCO", "RETORNO_ALMOCO", "SAIDA"];
const pointLabels = {
  ENTRADA: "Entrada",
  SAIDA_ALMOCO: "Saida almoco",
  RETORNO_ALMOCO: "Retorno almoco",
  SAIDA: "Saida"
};
const reasons = ["Hora Extra", "Reuniao", "Treinamento", "Esquecimento", "Outro"];

let state = structuredClone(DEFAULT_STATE);
let currentUser = null;
let currentView = "ponto";
let alertBox = null;
let clockTimer = null;

const app = document.querySelector("#app");

boot();

async function boot() {
  state = await loadState();
  const remembered = localStorage.getItem("limpmix-current-user");
  if (remembered) {
    currentUser = state.cadastros.usuarios.find((u) => u.id === Number(remembered) && u.ativo) || null;
  }
  render();
}

async function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  try {
    const [cadastros, registros] = await Promise.all([
      fetch("data/cadastros.json").then((r) => r.json()),
      fetch("data/registros.json").then((r) => r.json())
    ]);
    if (saved) {
      const local = JSON.parse(saved);
      const merged = mergeBaseState(local, { cadastros, registros });
      saveState(merged);
      return merged;
    }
    const loaded = { cadastros, registros };
    saveState(loaded);
    return loaded;
  } catch {
    if (saved) return JSON.parse(saved);
    saveState(DEFAULT_STATE);
    return structuredClone(DEFAULT_STATE);
  }
}

function mergeBaseState(local, base) {
  const result = local || structuredClone(DEFAULT_STATE);
  result.cadastros ||= { usuarios: [], configuracoes: {} };
  result.registros ||= { registros: [], logs: [] };
  result.cadastros.usuarios ||= [];
  result.registros.registros ||= [];
  result.registros.logs ||= [];
  result.cadastros.configuracoes = {
    ...(base.cadastros?.configuracoes || {}),
    ...(result.cadastros.configuracoes || {})
  };
  for (const baseUser of base.cadastros?.usuarios || []) {
    const exists = result.cadastros.usuarios.some(
      (user) => String(user.usuario).toLowerCase() === String(baseUser.usuario).toLowerCase()
    );
    if (!exists) result.cadastros.usuarios.push(baseUser);
  }
  return result;
}

function saveState(nextState = state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

function render(message) {
  if (!currentUser) {
    renderLogin(message);
    return;
  }
  if (currentUser.tipo !== "MASTER") currentView = "ponto";
  const nav = currentUser.tipo === "MASTER" ? masterNav() : employeeNav();
  app.innerHTML = `
    <div class="layout">
      <aside class="sidebar">
        <div class="brand"><span class="brand-mark">LM</span><div><strong>LimpMix</strong><br><span>Ponto</span></div></div>
        <nav class="nav">${nav}</nav>
      </aside>
      <main class="main">
        <div id="alert-slot">${message ? alertHtml(message) : ""}</div>
        <section id="view"></section>
      </main>
    </div>`;
  alertBox = document.querySelector("#alert-slot");
  bindNav();
  renderView();
}

function renderLogin(message) {
  clearInterval(clockTimer);
  app.innerHTML = `
    <main class="login-page">
      <section class="login-card">
        <div class="brand">
          <span class="brand-mark">LM</span>
          <div>
            <h1>LimpMix Pitanga</h1>
            <p class="muted">Sistema de controle de ponto</p>
          </div>
        </div>
        <div id="alert-slot">${message ? alertHtml(message) : ""}</div>
        <form class="form" id="login-form">
          <label>Usuario <input name="usuario" autocomplete="username" required autofocus></label>
          <label>Senha <input name="senha" type="password" autocomplete="current-password" required></label>
          <label class="check"><input type="checkbox" name="remember"> Lembrar acesso</label>
          <button class="btn primary" type="submit">Entrar</button>
        </form>
        <p class="muted">Primeiro acesso: <strong>master</strong> / <strong>master123</strong>.</p>
      </section>
    </main>`;
  document.querySelector("#login-form").addEventListener("submit", login);
}

async function login(event) {
  event.preventDefault();
  const form = new FormData(event.target);
  const usuario = String(form.get("usuario") || "").trim();
  const senhaHash = await sha256(String(form.get("senha") || ""));
  const user = state.cadastros.usuarios.find(
    (item) => String(item.usuario).toLowerCase() === usuario.toLowerCase() && item.senhaHash === senhaHash && item.ativo
  );
  if (!user) {
    renderLogin({ type: "error", text: "Usuario ou senha invalidos." });
    return;
  }
  currentUser = user;
  currentView = user.tipo === "MASTER" ? "dashboard" : "ponto";
  if (form.get("remember")) localStorage.setItem("limpmix-current-user", user.id);
  addLog(user.usuario, "Entrou no sistema");
  render();
}

function logout() {
  addLog(currentUser.usuario, "Saiu do sistema");
  currentUser = null;
  localStorage.removeItem("limpmix-current-user");
  renderLogin();
}

function masterNav() {
  return [
    ["dashboard", "Painel"],
    ["funcionarios", "Funcionarios"],
    ["batidas", "Batidas"],
    ["relatorios", "Relatorios"],
    ["dados", "Dados e backup"],
    ["logs", "Auditoria"],
    ["logout", "Sair"]
  ].map(([view, label]) => `<button data-view="${view}" class="${currentView === view ? "active" : ""}">${label}</button>`).join("");
}

function employeeNav() {
  return [
    ["ponto", "Bater ponto"],
    ["logout", "Sair"]
  ].map(([view, label]) => `<button data-view="${view}" class="${currentView === view ? "active" : ""}">${label}</button>`).join("");
}

function bindNav() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.view === "logout") {
        logout();
        return;
      }
      currentView = button.dataset.view;
      render();
    });
  });
}

function renderView() {
  clearInterval(clockTimer);
  const view = document.querySelector("#view");
  if (currentView === "dashboard") return renderDashboard(view);
  if (currentView === "funcionarios") return renderFuncionarios(view);
  if (currentView === "batidas") return renderBatidas(view);
  if (currentView === "relatorios") return renderRelatorios(view);
  if (currentView === "dados") return renderDados(view);
  if (currentView === "logs") return renderLogs(view);
  return renderPonto(view);
}

function renderDashboard(view) {
  const today = todayISO();
  const funcionarios = state.cadastros.usuarios.filter((u) => u.tipo === "FUNCIONARIO" && u.ativo).length;
  const registrosHoje = state.registros.registros.filter((r) => r.data === today).length;
  const justificativas = state.registros.registros.filter((r) => r.data === today && r.justificativa).length;
  const pendentes = state.cadastros.usuarios.filter((u) => u.tipo === "FUNCIONARIO" && u.ativo && dayRecords(u.id, today).length < 4).length;
  const recent = [...state.registros.registros].sort((a, b) => b.id - a.id).slice(0, 8);
  view.innerHTML = `
    <header class="page-header">
      <div class="page-title"><p class="eyebrow">Painel administrativo</p><h1>Resumo do dia</h1></div>
      <button class="btn primary" id="new-employee">Novo funcionario</button>
    </header>
    <section class="grid">
      ${metric("Funcionarios ativos", funcionarios)}
      ${metric("Registros hoje", registrosHoje)}
      ${metric("Pendencias", pendentes)}
      ${metric("Justificativas", justificativas)}
    </section>
    <section class="panel">
      <div class="page-header"><h2>Ultimas batidas</h2><button class="btn" data-go="batidas">Ver e editar</button></div>
      ${recordsTable(recent, true)}
    </section>`;
  document.querySelector("#new-employee").addEventListener("click", () => employeeModal());
  document.querySelector("[data-go='batidas']").addEventListener("click", () => { currentView = "batidas"; render(); });
  bindRecordActions();
}

function renderPonto(view) {
  const today = todayISO();
  const existing = dayRecords(currentUser.id, today);
  const nextType = existing.length < pointTypes.length ? pointTypes[existing.length] : null;
  const history = state.registros.registros
    .filter((r) => r.usuarioId === currentUser.id)
    .sort((a, b) => b.id - a.id)
    .slice(0, 20);
  view.innerHTML = `
    <section class="clock-layout">
      <article class="clock-card">
        <div class="brand" style="justify-content:center;text-align:left">
          <span class="brand-mark">LM</span>
          <div><p class="eyebrow">LOGO LIMPMIX</p><h1>Bem-vindo, ${escapeHtml(currentUser.nome)}</h1></div>
        </div>
        <div class="clock" id="clock">--:--:--</div>
        <p class="muted">Data: ${formatDate(today)}</p>
        ${nextType ? `<button class="point-btn" id="point-btn">${pointLabels[nextType]}</button>` : `<div class="notice"><strong>Ponto encerrado</strong><p>Ate amanha.</p></div>`}
      </article>
      <article class="panel">
        <div class="page-header"><h2>Registros recentes</h2></div>
        <div class="timeline">
          ${history.length ? history.map((r) => `
            <div class="timeline-item">
              <strong>${r.hora} - ${pointLabels[r.tipo] || r.tipo}</strong>
              <span>${formatDate(r.data)} ${r.justificativa ? " - " + escapeHtml(r.justificativa) : ""}</span>
            </div>`).join("") : `<p class="muted">Nenhum registro encontrado.</p>`}
        </div>
      </article>
    </section>`;
  startClock();
  const button = document.querySelector("#point-btn");
  if (button) button.addEventListener("click", () => registerPoint(nextType));
}

function registerPoint(tipo) {
  const now = new Date();
  const hora = now.toTimeString().slice(0, 5);
  const cfg = state.cadastros.configuracoes;
  let justificativa = "";
  if (hora < cfg.janelaInicio || hora > cfg.janelaFim) {
    const motivo = window.prompt(`Registro fora do horario permitido. Motivos: ${reasons.join(", ")}\\nInforme o motivo:`);
    if (!motivo) return;
    const descricao = window.prompt("Descreva a justificativa:");
    if (!descricao) return;
    justificativa = `Registro Extraordinario - ${motivo}: ${descricao}`;
  }
  const record = {
    id: nextId(state.registros.registros),
    usuarioId: currentUser.id,
    data: todayISO(),
    hora,
    tipo,
    justificativa,
    ip: "",
    criadoEm: new Date().toISOString(),
    editadoEm: "",
    editadoPor: ""
  };
  state.registros.registros.push(record);
  addLog(currentUser.usuario, `Registrou ponto: ${pointLabels[tipo]}`);
  saveState();
  render({ type: "success", text: `${pointLabels[tipo]} registrada com sucesso.` });
}

function renderFuncionarios(view) {
  const users = [...state.cadastros.usuarios].sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome));
  view.innerHTML = `
    <header class="page-header">
      <div class="page-title"><p class="eyebrow">Cadastro</p><h1>Funcionarios</h1></div>
      <button class="btn primary" id="new-employee">Novo funcionario</button>
    </header>
    <section class="panel table-wrap">
      <table>
        <thead><tr><th>Nome</th><th>Usuario</th><th>Tipo</th><th>Setor</th><th>Ativo</th><th></th></tr></thead>
        <tbody>${users.map((u) => `
          <tr>
            <td>${escapeHtml(u.nome)}</td><td>${escapeHtml(u.usuario)}</td><td>${u.tipo}</td><td>${escapeHtml(u.setor || "")}</td><td>${u.ativo ? "Sim" : "Nao"}</td>
            <td class="actions">
              <button class="btn small" data-edit-user="${u.id}">Editar</button>
              ${u.usuario !== "master" ? `<button class="btn small danger" data-delete-user="${u.id}">Excluir</button>` : ""}
            </td>
          </tr>`).join("")}</tbody>
      </table>
    </section>`;
  document.querySelector("#new-employee").addEventListener("click", () => employeeModal());
  document.querySelectorAll("[data-edit-user]").forEach((b) => b.addEventListener("click", () => employeeModal(Number(b.dataset.editUser))));
  document.querySelectorAll("[data-delete-user]").forEach((b) => b.addEventListener("click", () => deleteUser(Number(b.dataset.deleteUser))));
}

function employeeModal(userId = null) {
  const user = userId ? state.cadastros.usuarios.find((u) => u.id === userId) : null;
  const modal = openModal(`
    <h2>${user ? "Editar" : "Novo"} funcionario</h2>
    <form id="employee-form" class="form-grid">
      <label>Nome <input name="nome" value="${escapeAttr(user?.nome || "")}" required></label>
      <label>Usuario <input name="usuario" value="${escapeAttr(user?.usuario || "")}" required></label>
      <label>Senha <input name="senha" type="password" placeholder="${user ? "Deixe em branco para manter" : ""}"></label>
      <label>Tipo <select name="tipo"><option ${selected(user?.tipo, "FUNCIONARIO")} value="FUNCIONARIO">Funcionario</option><option ${selected(user?.tipo, "MASTER")} value="MASTER">Master</option></select></label>
      <label>Funcao <input name="funcao" value="${escapeAttr(user?.funcao || "")}"></label>
      <label>Setor <input name="setor" value="${escapeAttr(user?.setor || "")}"></label>
      <label>Data admissao <input type="date" name="dataAdmissao" value="${user?.dataAdmissao || todayISO()}"></label>
      <label>Entrada <input type="time" name="horarioEntrada" value="${user?.horarioEntrada || "08:00"}"></label>
      <label>Almoco <input type="time" name="horarioAlmoco" value="${user?.horarioAlmoco || "12:00"}"></label>
      <label>Retorno <input type="time" name="horarioRetorno" value="${user?.horarioRetorno || "13:00"}"></label>
      <label>Saida <input type="time" name="horarioSaida" value="${user?.horarioSaida || "18:00"}"></label>
      <label>Tolerancia <input type="number" min="0" name="tolerancia" value="${user?.tolerancia ?? 10}"></label>
      <label class="check span-2"><input type="checkbox" name="ativo" ${user?.ativo === false ? "" : "checked"}> Ativo</label>
      <div class="actions span-2"><button type="button" class="btn" data-close>Cancelar</button><button class="btn primary" type="submit">Salvar</button></div>
    </form>`);
  modal.querySelector("[data-close]").addEventListener("click", closeModal);
  modal.querySelector("#employee-form").addEventListener("submit", (event) => saveUser(event, userId));
}

async function saveUser(event, userId) {
  event.preventDefault();
  const form = new FormData(event.target);
  const usuario = String(form.get("usuario") || "").trim();
  if (state.cadastros.usuarios.some((u) => String(u.usuario).toLowerCase() === usuario.toLowerCase() && u.id !== userId)) {
    showAlert({ type: "error", text: "Este usuario ja existe." });
    return;
  }
  const senha = String(form.get("senha") || "");
  if (!userId && !senha) {
    showAlert({ type: "error", text: "Informe a senha inicial." });
    return;
  }
  const target = userId ? state.cadastros.usuarios.find((u) => u.id === userId) : { id: nextId(state.cadastros.usuarios) };
  Object.assign(target, {
    nome: String(form.get("nome") || "").trim(),
    usuario,
    tipo: String(form.get("tipo") || "FUNCIONARIO"),
    funcao: String(form.get("funcao") || "").trim(),
    setor: String(form.get("setor") || "").trim(),
    dataAdmissao: String(form.get("dataAdmissao") || ""),
    horarioEntrada: String(form.get("horarioEntrada") || "08:00"),
    horarioAlmoco: String(form.get("horarioAlmoco") || "12:00"),
    horarioRetorno: String(form.get("horarioRetorno") || "13:00"),
    horarioSaida: String(form.get("horarioSaida") || "18:00"),
    tolerancia: Number(form.get("tolerancia") || 10),
    ativo: Boolean(form.get("ativo"))
  });
  if (senha) target.senhaHash = await sha256(senha);
  if (!userId) state.cadastros.usuarios.push(target);
  addLog(currentUser.usuario, `${userId ? "Alterou" : "Cadastrou"} funcionario ${target.nome}`);
  saveState();
  closeModal();
  render({ type: "success", text: "Funcionario salvo." });
}

function deleteUser(userId) {
  const user = state.cadastros.usuarios.find((u) => u.id === userId);
  if (!user || !confirm(`Excluir ${user.nome}?`)) return;
  state.cadastros.usuarios = state.cadastros.usuarios.filter((u) => u.id !== userId);
  addLog(currentUser.usuario, `Excluiu funcionario ${user.nome}`);
  saveState();
  render({ type: "success", text: "Funcionario excluido." });
}

function renderBatidas(view) {
  const today = todayISO();
  const monthStart = today.slice(0, 8) + "01";
  const filters = getFilters({ inicio: monthStart, fim: today, funcionarioId: "0" });
  const records = filteredRecords(filters);
  view.innerHTML = `
    <header class="page-header"><div class="page-title"><p class="eyebrow">Administracao</p><h1>Batidas registradas</h1></div></header>
    <section class="panel">
      ${filtersHtml(filters)}
      ${recordsTable(records, true)}
    </section>`;
  bindFilters();
  bindRecordActions();
}

function recordsTable(records, editable) {
  return `<div class="table-wrap"><table>
    <thead><tr><th>Funcionario</th><th>Data</th><th>Hora</th><th>Tipo</th><th>Justificativa</th><th></th></tr></thead>
    <tbody>${records.length ? records.map((r) => {
      const user = findUser(r.usuarioId);
      return `<tr>
        <td>${escapeHtml(user?.nome || "Removido")}</td>
        <td>${formatDate(r.data)}</td>
        <td>${r.hora}</td>
        <td>${pointLabels[r.tipo] || r.tipo}</td>
        <td>${escapeHtml(r.justificativa || "-")}</td>
        <td>${editable ? `<button class="btn small" data-edit-record="${r.id}">Editar</button>` : ""}</td>
      </tr>`;
    }).join("") : `<tr><td colspan="6">Nenhuma batida encontrada.</td></tr>`}</tbody>
  </table></div>`;
}

function bindRecordActions() {
  document.querySelectorAll("[data-edit-record]").forEach((b) => b.addEventListener("click", () => recordModal(Number(b.dataset.editRecord))));
}

function recordModal(recordId) {
  const record = state.registros.registros.find((r) => r.id === recordId);
  if (!record) return;
  const user = findUser(record.usuarioId);
  const modal = openModal(`
    <h2>Editar batida</h2>
    <p class="muted">${escapeHtml(user?.nome || "Funcionario removido")}</p>
    <form id="record-form" class="form-grid">
      <label>Data <input type="date" name="data" value="${record.data}" required></label>
      <label>Hora <input type="time" name="hora" value="${record.hora}" required></label>
      <label>Tipo <select name="tipo">${pointTypes.map((t) => `<option value="${t}" ${selected(record.tipo, t)}>${pointLabels[t]}</option>`).join("")}</select></label>
      <label>Funcionario <input value="${escapeAttr(user?.usuario || "")}" disabled></label>
      <label class="span-2">Justificativa / observacao da alteracao <textarea name="justificativa" rows="5">${escapeHtml(record.justificativa || "")}</textarea></label>
      <div class="actions span-2"><button type="button" class="btn" data-close>Cancelar</button><button class="btn primary" type="submit">Salvar alteracao</button></div>
    </form>`);
  modal.querySelector("[data-close]").addEventListener("click", closeModal);
  modal.querySelector("#record-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    record.data = String(form.get("data"));
    record.hora = String(form.get("hora"));
    record.tipo = String(form.get("tipo"));
    record.justificativa = String(form.get("justificativa") || "").trim();
    record.editadoEm = new Date().toISOString();
    record.editadoPor = currentUser.usuario;
    addLog(currentUser.usuario, `Editou batida #${record.id} de ${user?.nome || "funcionario removido"}`);
    saveState();
    closeModal();
    render({ type: "success", text: "Batida atualizada." });
  });
}

function renderRelatorios(view) {
  const today = todayISO();
  const filters = getFilters({ competencia: today.slice(0, 7), funcionarioId: String(firstEmployeeId()) });
  const rows = reportRows(Number(filters.funcionarioId), filters.competencia);
  const totals = reportTotals(rows);
  view.innerHTML = `
    <header class="page-header">
      <div class="page-title"><p class="eyebrow">Relatorios</p><h1>Relatorio mensal</h1></div>
      <div class="toolbar"><button class="btn" id="print">Imprimir</button><button class="btn primary" id="csv">Exportar CSV</button></div>
    </header>
    <section class="panel">
      <form class="filters" id="filters">
        <label>Funcionario ${employeeSelect(filters.funcionarioId)}</label>
        <label>Competencia <input type="month" name="competencia" value="${filters.competencia}"></label>
        <button class="btn primary">Filtrar</button>
      </form>
      <section class="grid">
        ${metric("Dias trabalhados", totals.dias)}
        ${metric("Horas trabalhadas", totals.horas)}
        ${metric("Atrasos", totals.atrasos)}
        ${metric("Faltas", totals.faltas)}
      </section>
      <div class="table-wrap"><table>
        <thead><tr><th>Data</th><th>Entrada</th><th>Saida almoco</th><th>Retorno</th><th>Saida</th><th>Justificativa</th></tr></thead>
        <tbody>${rows.map((r) => `<tr><td>${formatDate(r.data)}</td><td>${r.entrada}</td><td>${r.saidaAlmoco}</td><td>${r.retorno}</td><td>${r.saida}</td><td>${escapeHtml(r.justificativa)}</td></tr>`).join("")}</tbody>
      </table></div>
    </section>`;
  bindFilters();
  document.querySelector("#print").addEventListener("click", () => window.print());
  document.querySelector("#csv").addEventListener("click", () => downloadCsv(rows, totals, filters.competencia));
}

function renderDados(view) {
  view.innerHTML = `
    <header class="page-header"><div class="page-title"><p class="eyebrow">Dados</p><h1>Backup e restauracao</h1></div></header>
    <section class="panel">
      <div class="toolbar">
        <button class="btn primary" id="export-all">Exportar backup JSON</button>
        <button class="btn" id="export-cad">Baixar cadastros.json</button>
        <button class="btn" id="export-reg">Baixar registros.json</button>
      </div>
      <hr>
      <form class="form" id="import-form">
        <label>Importar backup JSON <input class="file-input" type="file" name="arquivo" accept=".json,application/json"></label>
        <button class="btn green" type="submit">Importar</button>
      </form>
      <p class="muted">No GitHub Pages, os arquivos em data/*.json sao base inicial. Alteracoes feitas na pagina ficam no navegador ate serem exportadas.</p>
    </section>`;
  document.querySelector("#export-all").addEventListener("click", () => downloadJson("backup_ponto_limpMix.json", state));
  document.querySelector("#export-cad").addEventListener("click", () => downloadJson("cadastros.json", state.cadastros));
  document.querySelector("#export-reg").addEventListener("click", () => downloadJson("registros.json", state.registros));
  document.querySelector("#import-form").addEventListener("submit", importBackup);
}

function renderLogs(view) {
  const logs = [...state.registros.logs].sort((a, b) => b.id - a.id);
  view.innerHTML = `
    <header class="page-header"><div class="page-title"><p class="eyebrow">Seguranca</p><h1>Auditoria</h1></div></header>
    <section class="panel table-wrap"><table>
      <thead><tr><th>Data/Hora</th><th>Usuario</th><th>Acao</th></tr></thead>
      <tbody>${logs.map((l) => `<tr><td>${formatDateTime(l.dataHora)}</td><td>${escapeHtml(l.usuario)}</td><td>${escapeHtml(l.acao)}</td></tr>`).join("")}</tbody>
    </table></section>`;
}

function importBackup(event) {
  event.preventDefault();
  const file = event.target.arquivo.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (imported.cadastros && imported.registros) state = imported;
      else if (imported.usuarios) state.cadastros = imported;
      else if (imported.registros) state.registros = imported;
      else throw new Error("Formato invalido");
      saveState();
      render({ type: "success", text: "Dados importados com sucesso." });
    } catch {
      showAlert({ type: "error", text: "Arquivo JSON invalido." });
    }
  };
  reader.readAsText(file, "utf-8");
}

function filtersHtml(filters) {
  return `<form class="filters" id="filters">
    <label>Funcionario ${employeeSelect(filters.funcionarioId)}</label>
    <label>Inicio <input type="date" name="inicio" value="${filters.inicio}"></label>
    <label>Fim <input type="date" name="fim" value="${filters.fim}"></label>
    <button class="btn primary">Filtrar</button>
  </form>`;
}

function employeeSelect(value) {
  return `<select name="funcionarioId"><option value="0">Todos</option>${state.cadastros.usuarios.filter((u) => u.ativo).map((u) => `<option value="${u.id}" ${String(u.id) === String(value) ? "selected" : ""}>${escapeHtml(u.nome)}</option>`).join("")}</select>`;
}

function bindFilters() {
  const form = document.querySelector("#filters");
  if (!form) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const params = new URLSearchParams(new FormData(form));
    history.replaceState(null, "", `#${currentView}?${params.toString()}`);
    renderView();
  });
}

function getFilters(defaults) {
  const hash = location.hash.split("?")[1] || "";
  const params = new URLSearchParams(hash);
  return Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, params.get(key) || value]));
}

function filteredRecords(filters) {
  return state.registros.registros
    .filter((r) => (!filters.funcionarioId || filters.funcionarioId === "0" || r.usuarioId === Number(filters.funcionarioId)))
    .filter((r) => (!filters.inicio || r.data >= filters.inicio) && (!filters.fim || r.data <= filters.fim))
    .sort((a, b) => `${b.data} ${b.hora}`.localeCompare(`${a.data} ${a.hora}`));
}

function reportRows(userId, competencia) {
  const [year, month] = competencia.split("-").map(Number);
  const days = new Date(year, month, 0).getDate();
  const rows = [];
  for (let day = 1; day <= days; day += 1) {
    const data = `${competencia}-${String(day).padStart(2, "0")}`;
    const records = dayRecords(userId, data);
    rows.push({
      data,
      entrada: records.find((r) => r.tipo === "ENTRADA")?.hora || "",
      saidaAlmoco: records.find((r) => r.tipo === "SAIDA_ALMOCO")?.hora || "",
      retorno: records.find((r) => r.tipo === "RETORNO_ALMOCO")?.hora || "",
      saida: records.find((r) => r.tipo === "SAIDA")?.hora || "",
      justificativa: records.map((r) => r.justificativa).filter(Boolean).join(" | ")
    });
  }
  return rows;
}

function reportTotals(rows) {
  let dias = 0;
  let minutos = 0;
  let atrasos = 0;
  let faltas = 0;
  const today = todayISO();
  for (const row of rows) {
    if (row.entrada || row.saidaAlmoco || row.retorno || row.saida) {
      dias += 1;
      minutos += diffMinutes(row.entrada, row.saidaAlmoco) + diffMinutes(row.retorno, row.saida);
      if (row.entrada > "08:00") atrasos += 1;
    } else if (row.data <= today && new Date(row.data + "T12:00:00").getDay() !== 0) {
      faltas += 1;
    }
  }
  return { dias, horas: minutesToHour(minutos), atrasos, faltas };
}

function downloadCsv(rows, totals, competencia) {
  const lines = [
    ["Competencia", competencia],
    ["Data", "Entrada", "Saida Almoco", "Retorno", "Saida", "Justificativa"],
    ...rows.map((r) => [formatDate(r.data), r.entrada, r.saidaAlmoco, r.retorno, r.saida, r.justificativa]),
    [],
    ["Dias trabalhados", totals.dias],
    ["Horas trabalhadas", totals.horas],
    ["Atrasos", totals.atrasos],
    ["Faltas", totals.faltas]
  ];
  const csv = lines.map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";")).join("\n");
  downloadBlob(`relatorio_${competencia}.csv`, csv, "text/csv;charset=utf-8");
}

function downloadJson(name, data) {
  downloadBlob(name, JSON.stringify(data, null, 2), "application/json;charset=utf-8");
}

function downloadBlob(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function openModal(html) {
  const wrap = document.createElement("div");
  wrap.className = "modal-backdrop";
  wrap.innerHTML = `<section class="modal">${html}</section>`;
  document.body.appendChild(wrap);
  wrap.addEventListener("click", (event) => {
    if (event.target === wrap) closeModal();
  });
  return wrap;
}

function closeModal() {
  document.querySelector(".modal-backdrop")?.remove();
}

function addLog(usuario, acao) {
  state.registros.logs.push({ id: nextId(state.registros.logs), usuario, acao, dataHora: new Date().toISOString() });
  saveState();
}

function metric(label, value) {
  return `<article class="metric"><span>${label}</span><strong>${value}</strong></article>`;
}

function showAlert(message) {
  if (!alertBox) return;
  alertBox.innerHTML = alertHtml(message);
}

function alertHtml(message) {
  return `<div class="alert ${message.type || ""}">${escapeHtml(message.text || message)}</div>`;
}

function startClock() {
  const clock = document.querySelector("#clock");
  const tick = () => { clock.textContent = new Date().toLocaleTimeString("pt-BR", { hour12: false }); };
  tick();
  clockTimer = setInterval(tick, 1000);
}

function dayRecords(userId, data) {
  return state.registros.registros
    .filter((r) => r.usuarioId === userId && r.data === data)
    .sort((a, b) => pointTypes.indexOf(a.tipo) - pointTypes.indexOf(b.tipo) || a.hora.localeCompare(b.hora));
}

function findUser(id) {
  return state.cadastros.usuarios.find((u) => u.id === Number(id));
}

function firstEmployeeId() {
  return state.cadastros.usuarios.find((u) => u.ativo)?.id || 1;
}

function nextId(items) {
  return items.length ? Math.max(...items.map((item) => Number(item.id) || 0)) + 1 : 1;
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatDateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("pt-BR");
}

function diffMinutes(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
}

function minutesToHour(value) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function selected(current, expected) {
  return current === expected ? "selected" : "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
