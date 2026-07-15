import { DEFAULT_CATEGORIES, PRIORITIES, STATUSES } from "./config.js";
import { drawBarChart, drawDonutChart } from "./charts.js";
import { exportState, importStateFile, loadState, saveState } from "./storage.js";
import { resetPassword, signIn, signUp, syncTasks } from "./supabase.js";
import { addDays, dateKey, downloadText, escapeHTML, formatClock, formatDate, isSameWeek, parseLocalDate, todayISO, uid } from "./utils.js";

const initialState = {
  view: "dashboard",
  filter: "Todas",
  theme: localStorage.getItem("taskflow-theme") || "dark",
  fontScale: Number(localStorage.getItem("taskflow-font-scale") || 1),
  categories: DEFAULT_CATEGORIES,
  history: [],
  archived: [],
  user: { name: "Wagner", points: 0, streak: 0, level: 1, badges: [], rewardedTaskIds: [] },
  tasks: seedTasks(),
};

let state = loadState() || initialState;
let deletedSnapshot = null;
let searchTerm = "";
let selectedCalendarDay = todayISO();

const els = {
  app: document.querySelector("#app"),
  host: document.querySelector("#viewHost"),
  search: document.querySelector("#globalSearch"),
  taskDialog: document.querySelector("#taskDialog"),
  taskForm: document.querySelector("#taskForm"),
  authDialog: document.querySelector("#authDialog"),
  authForm: document.querySelector("#authForm"),
  toastHost: document.querySelector("#toastHost"),
  sidebar: document.querySelector(".sidebar"),
};

document.documentElement.dataset.theme = state.theme;
document.documentElement.style.setProperty("--font-scale", state.fontScale);

init();

function init() {
  fillTaskOptions();
  bindGlobalEvents();
  hydrateDashboardShell();
  render();
  setInterval(hydrateDashboardShell, 1000);
  notifyOverdueTasks();
}

function bindGlobalEvents() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      els.sidebar.classList.remove("open");
      persistAndRender();
    });
  });
  document.querySelector("#menuToggle").addEventListener("click", () => els.sidebar.classList.toggle("open"));
  document.querySelector("#openTaskModal").addEventListener("click", () => openTaskModal());
  document.querySelector("#themeToggle").addEventListener("click", toggleTheme);
  document.querySelector("#openAuthModal").addEventListener("click", () => els.authDialog.showModal());
  document.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", () => els.taskDialog.close()));
  document.querySelectorAll("[data-close-auth]").forEach((button) => button.addEventListener("click", () => els.authDialog.close()));
  document.querySelector("#deleteTaskBtn").addEventListener("click", deleteTaskFromModal);
  els.search.addEventListener("input", (event) => {
    searchTerm = event.target.value.trim().toLowerCase();
    render();
  });
  els.taskForm.addEventListener("submit", saveTaskFromForm);
  els.authForm.addEventListener("submit", handleSignIn);
  document.querySelector("#signupBtn").addEventListener("click", handleSignUp);
  document.querySelector("#resetPasswordBtn").addEventListener("click", handlePasswordReset);
  document.addEventListener("keydown", handleShortcuts);
}

function seedTasks() {
  const today = todayISO();
  const tomorrow = dateKey(addDays(new Date(), 1));
  return [
    createTask({ title: "Revisar planejamento da semana", category: "Trabalho", priority: "Alta", status: "Em andamento", date: today, time: "09:30", tags: ["planejamento"], estimated: 45, spent: 20, favorite: true }),
    createTask({ title: "Enviar proposta ao cliente", category: "Cliente", priority: "Muito Alta", status: "A Fazer", date: today, time: "15:00", tags: ["cliente", "urgente"], estimated: 60 }),
    createTask({ title: "Treino funcional", category: "Academia", priority: "Media", status: "Concluida", date: today, time: "18:30", tags: ["saude"], estimated: 50, spent: 50 }),
    createTask({ title: "Organizar contas do mes", category: "Financeiro", priority: "Baixa", status: "Em espera", date: tomorrow, time: "11:00", tags: ["casa"], estimated: 30 }),
  ];
}

function createTask(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: uid(),
    title: "",
    description: "",
    category: "Trabalho",
    priority: "Media",
    date: todayISO(),
    time: "",
    color: "#7c3aed",
    tags: [],
    location: "",
    notes: "",
    attachments: [],
    checklist: [],
    estimated: 0,
    spent: 0,
    status: "A Fazer",
    favorite: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function fillTaskOptions() {
  setOptions("#category", state.categories);
  setOptions("#priority", PRIORITIES.map((item) => item.name));
  setOptions("#status", STATUSES);
}

function setOptions(selector, options) {
  document.querySelector(selector).innerHTML = options.map((option) => `<option>${escapeHTML(option)}</option>`).join("");
}

function hydrateDashboardShell() {
  const completed = state.tasks.filter((task) => task.status === "Concluida").length;
  const level = Math.max(1, Math.floor(state.user.points / 140) + 1);
  const xp = state.user.points % 140;
  document.querySelector("#levelLabel").textContent = `Nivel ${level}`;
  document.querySelector("#xpText").textContent = `${state.user.points} XP`;
  document.querySelector("#xpBar").style.width = `${Math.min(100, (xp / 140) * 100)}%`;
  document.querySelector("#authNotice span").textContent = `${formatDate(new Date())} • ${formatClock(new Date())} • ${completed} tarefas concluidas`;
}

function render() {
  document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === state.view));
  const views = {
    dashboard: renderDashboard,
    tasks: renderTasksView,
    kanban: renderKanban,
    calendar: renderCalendarView,
    stats: renderStats,
    settings: renderSettings,
  };
  els.host.innerHTML = views[state.view]();
  bindViewEvents();
  renderChartsIfNeeded();
}

function renderDashboard() {
  const metrics = getMetrics();
  return `
    <section class="view">
      <div class="hero-grid">
        <article class="hero-card">
          <div>
            <span class="mini-label">${formatDate(new Date())} • ${formatClock(new Date())}</span>
            <h1>Ola, ${escapeHTML(state.user.name)}.</h1>
            <p>Seu painel combina tarefas, calendario, produtividade e proximos compromissos em uma experiencia rapida e elegante.</p>
          </div>
          <div>
            <div class="progress-track"><span style="width:${metrics.percent}%"></span></div>
            <div class="hero-actions">
              <button class="primary-button" data-new-task>Adicionar tarefa</button>
              <button class="ghost-button" data-view-jump="kanban">Abrir Kanban</button>
            </div>
          </div>
        </article>
        <article class="panel-card">
          <div class="section-head"><h2>Proximos compromissos</h2><span class="chip">${metrics.pending} pendentes</span></div>
          <div class="task-list">${upcomingTasks().slice(0, 4).map(renderTaskCard).join("") || emptyState("Nenhum compromisso proximo")}</div>
        </article>
      </div>
      <div class="metrics-grid">
        ${metricCard("Tarefas", metrics.total, "total cadastradas")}
        ${metricCard("Concluidas", metrics.completed, "finalizadas")}
        ${metricCard("Pendentes", metrics.pending, "precisam de atencao")}
        ${metricCard("Conclusao", `${metrics.percent}%`, "taxa atual")}
      </div>
      <div class="dashboard-lower">
        <article class="panel-card"><div class="section-head"><h2>Calendario mensal</h2></div>${renderCalendarMini()}</article>
        <article class="panel-card"><div class="section-head"><h2>Gamificacao</h2><span class="chip">${state.user.streak} dias</span></div>${renderGamification()}</article>
      </div>
    </section>
  `;
}

function metricCard(label, value, hint) {
  return `<article class="metric-card"><span>${label}</span><strong>${value}</strong><span>${hint}</span></article>`;
}

function renderTasksView() {
  const tasks = filteredTasks();
  return `
    <section class="view">
      <div class="section-head">
        <div><span class="mini-label">Organizacao</span><h2>Tarefas</h2></div>
        <button class="primary-button" data-new-task>+ Nova tarefa</button>
      </div>
      <div class="filters">${["Hoje", "Amanha", "Esta semana", "Este mes", "Todas", "Atrasadas", "Favoritas", "Concluidas"].map((filter) => `<button class="filter-button ${state.filter === filter ? "active" : ""}" data-filter="${filter}">${filter}</button>`).join("")}</div>
      <div class="task-list">${tasks.map(renderTaskCard).join("") || emptyState("Nenhuma tarefa encontrada")}</div>
    </section>
  `;
}

function renderTaskCard(task) {
  const priority = PRIORITIES.find((item) => item.name === task.priority) || PRIORITIES[2];
  return `
    <article class="task-card" draggable="true" data-task-id="${task.id}" style="border-left:4px solid ${task.color || priority.color}">
      <div class="task-top">
        <div>
          <div class="task-title"><button class="mini-button" data-toggle-complete="${task.id}">${task.status === "Concluida" ? "✓" : "○"}</button>${escapeHTML(task.title)}</div>
          <p class="task-desc">${escapeHTML(task.description || task.notes || "Sem descricao")}</p>
        </div>
        <button class="mini-button" data-favorite="${task.id}">${task.favorite ? "★" : "☆"}</button>
      </div>
      <div class="chips">
        <span class="chip">${escapeHTML(task.category)}</span>
        <span class="chip" style="color:${priority.color}">${escapeHTML(task.priority)}</span>
        <span class="chip">${escapeHTML(task.status)}</span>
        <span class="chip">${escapeHTML(task.date)} ${escapeHTML(task.time || "")}</span>
        ${task.tags.map((tag) => `<span class="chip">#${escapeHTML(tag)}</span>`).join("")}
      </div>
      <div class="card-actions">
        <button class="mini-button" data-edit="${task.id}">Editar</button>
        <button class="mini-button" data-duplicate="${task.id}">Duplicar</button>
        <button class="mini-button" data-copy="${task.id}">Copiar</button>
        <button class="mini-button" data-share="${task.id}">Compartilhar</button>
        <button class="mini-button" data-archive="${task.id}">Arquivar</button>
      </div>
    </article>
  `;
}

function renderKanban() {
  const columns = ["A Fazer", "Em andamento", "Em espera", "Concluida"];
  return `
    <section class="view">
      <div class="section-head"><div><span class="mini-label">Fluxo visual</span><h2>Kanban</h2></div><button class="primary-button" data-new-task>+ Nova tarefa</button></div>
      <div class="kanban-board">
        ${columns.map((status) => {
          const tasks = filteredTasks().filter((task) => task.status === status);
          return `<section class="kanban-column" data-drop-status="${status}">
            <div class="kanban-title"><strong>${status}</strong><span class="chip">${tasks.length}</span></div>
            <div class="task-list">${tasks.map(renderTaskCard).join("") || emptyState("Solte tarefas aqui")}</div>
          </section>`;
        }).join("")}
      </div>
    </section>
  `;
}

function renderCalendarView() {
  const dayTasks = state.tasks.filter((task) => task.date === selectedCalendarDay);
  return `
    <section class="view">
      <div class="section-head"><div><span class="mini-label">Agenda interativa</span><h2>Calendario</h2></div><span class="chip">${selectedCalendarDay}</span></div>
      <div class="dashboard-lower">
        <article class="panel-card">${renderCalendarMini()}</article>
        <article class="panel-card">
          <div class="section-head"><h2>Tarefas do dia</h2></div>
          <div class="task-list">${dayTasks.map(renderTaskCard).join("") || emptyState("Nenhuma tarefa neste dia")}</div>
        </article>
      </div>
    </section>
  `;
}

function renderCalendarMini() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, index) => addDays(start, index));
  return `<div class="calendar-grid">${["D", "S", "T", "Q", "Q", "S", "S"].map((d) => `<strong class="mini-label">${d}</strong>`).join("")}${days.map((day) => {
    const key = dateKey(day);
    const tasks = state.tasks.filter((task) => task.date === key);
    return `<div class="day-cell ${key === selectedCalendarDay ? "active" : ""}">
      <button data-calendar-day="${key}">${day.getDate()}</button>
      <small>${tasks.length ? `${tasks.length} tarefa(s)` : ""}</small>
      <div class="day-dots">${tasks.slice(0, 5).map((task) => `<span class="dot" style="background:${priorityColor(task.priority)}"></span>`).join("")}</div>
    </div>`;
  }).join("")}</div>`;
}

function renderStats() {
  return `
    <section class="view">
      <div class="section-head"><div><span class="mini-label">Inteligencia</span><h2>Estatisticas</h2></div></div>
      <div class="stats-grid">
        <article class="panel-card"><div class="section-head"><h2>Concluidas por semana</h2></div><canvas id="weeklyChart"></canvas></article>
        <article class="panel-card"><div class="section-head"><h2>Taxa de conclusao</h2></div><canvas id="completionChart"></canvas></article>
        <article class="panel-card"><div class="section-head"><h2>Categorias mais usadas</h2></div><canvas id="categoryChart"></canvas></article>
        <article class="panel-card"><div class="section-head"><h2>Tempo gasto</h2></div><canvas id="timeChart"></canvas></article>
      </div>
    </section>
  `;
}

function renderSettings() {
  return `
    <section class="view">
      <div class="section-head"><div><span class="mini-label">Controle</span><h2>Ajustes</h2></div></div>
      <div class="settings-grid">
        <article class="panel-card">
          <div class="section-head"><h2>Aparencia</h2></div>
          <label>Tema<select id="themeSelect"><option value="dark">Escuro</option><option value="light">Claro</option></select></label>
          <label>Tamanho da fonte<input id="fontRange" type="range" min="0.9" max="1.18" step="0.02" value="${state.fontScale}"></label>
          <label>Nova categoria<input id="newCategory" placeholder="Ex: Marketing"></label>
          <button class="ghost-button" data-add-category>Adicionar categoria</button>
        </article>
        <article class="panel-card">
          <div class="section-head"><h2>Dados e notificacoes</h2></div>
          <div class="task-list">
            <button class="ghost-button" data-export>Exportar backup</button>
            <button class="ghost-button" data-export-csv>Exportar CSV</button>
            <label>Importar backup<input id="importFile" type="file" accept="application/json"></label>
            <button class="ghost-button" data-sync>Sincronizar Supabase</button>
            <button class="ghost-button" data-notify>Ativar notificacoes locais</button>
          </div>
        </article>
        <article class="panel-card">
          <div class="section-head"><h2>Historico</h2><span class="chip">${state.history.length}</span></div>
          <div class="task-list">${state.history.slice(-8).reverse().map((item) => `<span class="chip">${escapeHTML(item)}</span>`).join("") || emptyState("Sem historico ainda")}</div>
        </article>
        <article class="panel-card">
          <div class="section-head"><h2>Arquivadas</h2><span class="chip">${state.archived.length}</span></div>
          <div class="task-list">${state.archived.map((task) => `<button class="ghost-button" data-restore="${task.id}">Restaurar ${escapeHTML(task.title)}</button>`).join("") || emptyState("Nada arquivado")}</div>
        </article>
      </div>
    </section>
  `;
}

function renderGamification() {
  const badges = state.user.badges.map((badge) => `<span class="chip">🏅 ${escapeHTML(badge)}</span>`).join("");
  return `<div class="task-list">
    <div class="metric-card"><span>Pontuacao</span><strong>${state.user.points}</strong><span>XP acumulado</span></div>
    <div class="progress-track"><span style="width:${Math.min(100, state.user.points % 140 / 140 * 100)}%"></span></div>
    <div class="chips">${badges}<span class="chip">Nivel ${Math.max(1, Math.floor(state.user.points / 140) + 1)}</span></div>
  </div>`;
}

function bindViewEvents() {
  document.querySelectorAll("[data-new-task]").forEach((button) => button.addEventListener("click", () => openTaskModal()));
  document.querySelectorAll("[data-view-jump]").forEach((button) => button.addEventListener("click", () => { state.view = button.dataset.viewJump; persistAndRender(); }));
  document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => { state.filter = button.dataset.filter; persistAndRender(); }));
  document.querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => openTaskModal(button.dataset.edit)));
  document.querySelectorAll("[data-favorite]").forEach((button) => button.addEventListener("click", () => mutateTask(button.dataset.favorite, (task) => task.favorite = !task.favorite, "Favorito atualizado")));
  document.querySelectorAll("[data-toggle-complete]").forEach((button) => button.addEventListener("click", () => mutateTask(button.dataset.toggleComplete, (task) => task.status = task.status === "Concluida" ? "A Fazer" : "Concluida", "Status atualizado")));
  document.querySelectorAll("[data-duplicate]").forEach((button) => button.addEventListener("click", () => duplicateTask(button.dataset.duplicate)));
  document.querySelectorAll("[data-copy]").forEach((button) => button.addEventListener("click", () => copyTask(button.dataset.copy)));
  document.querySelectorAll("[data-share]").forEach((button) => button.addEventListener("click", () => shareTask(button.dataset.share)));
  document.querySelectorAll("[data-archive]").forEach((button) => button.addEventListener("click", () => archiveTask(button.dataset.archive)));
  document.querySelectorAll("[data-restore]").forEach((button) => button.addEventListener("click", () => restoreTask(button.dataset.restore)));
  document.querySelectorAll("[data-calendar-day]").forEach((button) => button.addEventListener("click", () => { selectedCalendarDay = button.dataset.calendarDay; state.view = "calendar"; render(); }));
  bindDragAndDrop();
  bindSettingsEvents();
}

function bindDragAndDrop() {
  document.querySelectorAll(".task-card").forEach((card) => {
    card.addEventListener("dragstart", (event) => event.dataTransfer.setData("text/plain", card.dataset.taskId));
  });
  document.querySelectorAll("[data-drop-status]").forEach((column) => {
    column.addEventListener("dragover", (event) => { event.preventDefault(); column.classList.add("drag-over"); });
    column.addEventListener("dragleave", () => column.classList.remove("drag-over"));
    column.addEventListener("drop", (event) => {
      event.preventDefault();
      column.classList.remove("drag-over");
      mutateTask(event.dataTransfer.getData("text/plain"), (task) => task.status = column.dataset.dropStatus, "Tarefa movida no Kanban");
    });
  });
}

function bindSettingsEvents() {
  const themeSelect = document.querySelector("#themeSelect");
  if (themeSelect) {
    themeSelect.value = state.theme;
    themeSelect.addEventListener("change", () => { state.theme = themeSelect.value; applyTheme(); persistAndRender(); });
  }
  const fontRange = document.querySelector("#fontRange");
  if (fontRange) fontRange.addEventListener("input", () => {
    state.fontScale = Number(fontRange.value);
    document.documentElement.style.setProperty("--font-scale", state.fontScale);
    localStorage.setItem("taskflow-font-scale", state.fontScale);
  });
  document.querySelector("[data-add-category]")?.addEventListener("click", addCategory);
  document.querySelector("[data-export]")?.addEventListener("click", () => exportState(state));
  document.querySelector("[data-export-csv]")?.addEventListener("click", exportCsv);
  document.querySelector("[data-sync]")?.addEventListener("click", async () => {
    const result = await syncTasks(state.tasks);
    toast(result.skipped ? "Configure Supabase para sincronizar." : "Sincronizacao enviada ao Supabase.");
  });
  document.querySelector("[data-notify]")?.addEventListener("click", requestNotifications);
  document.querySelector("#importFile")?.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const imported = await importStateFile(file);
      if (!confirm(`Importar ${imported.tasks.length} tarefa(s)? Isso substitui os dados atuais.`)) {
        event.target.value = "";
        return;
      }
      state = imported;
      document.documentElement.dataset.theme = state.theme;
      document.documentElement.style.setProperty("--font-scale", state.fontScale);
      toast("Backup importado.");
      persistAndRender();
    } catch (error) {
      toast(error.message || "Falha ao importar backup.");
    } finally {
      event.target.value = "";
    }
  });
}

function renderChartsIfNeeded() {
  if (state.view !== "stats") return;
  const completedWeek = [0, 1, 2, 3, 4, 5, 6].map((offset) => {
    const key = dateKey(addDays(new Date(), offset - 6));
    return state.tasks.filter((task) => task.status === "Concluida" && task.date === key).length;
  });
  drawBarChart(document.querySelector("#weeklyChart"), ["D-6", "D-5", "D-4", "D-3", "D-2", "Ontem", "Hoje"], completedWeek, ["#38bdf8", "#8b5cf6"]);
  const metrics = getMetrics();
  drawDonutChart(document.querySelector("#completionChart"), [
    { label: "Concluidas", value: metrics.completed, color: "#34d399" },
    { label: "Pendentes", value: metrics.pending, color: "#8b5cf6" },
  ]);
  drawBarChart(document.querySelector("#categoryChart"), state.categories.slice(0, 7), state.categories.slice(0, 7).map((category) => state.tasks.filter((task) => task.category === category).length), ["#38bdf8", "#8b5cf6", "#34d399"]);
  drawBarChart(document.querySelector("#timeChart"), ["Estimado", "Gasto"], [
    state.tasks.reduce((sum, task) => sum + Number(task.estimated || 0), 0),
    state.tasks.reduce((sum, task) => sum + Number(task.spent || 0), 0),
  ], ["#fbbf24", "#fb7185"]);
}

function openTaskModal(id) {
  fillTaskOptions();
  const task = id ? state.tasks.find((item) => item.id === id) : createTask();
  document.querySelector("#taskModalTitle").textContent = id ? "Editar tarefa" : "Nova tarefa";
  document.querySelector("#deleteTaskBtn").style.display = id ? "inline-block" : "none";
  setFormValue("taskId", task.id);
  ["title", "description", "category", "priority", "date", "time", "color", "location", "notes", "status"].forEach((key) => setFormValue(key, task[key] || ""));
  setFormValue("estimated", task.estimated || 0);
  setFormValue("spent", task.spent || 0);
  setFormValue("tags", task.tags.join(", "));
  setFormValue("checklist", task.checklist.map((item) => item.text || item).join("\n"));
  els.taskDialog.showModal();
}

function setFormValue(id, value) {
  document.querySelector(`#${id}`).value = value;
}

function saveTaskFromForm(event) {
  event.preventDefault();
  const id = document.querySelector("#taskId").value;
  const existing = state.tasks.find((task) => task.id === id);
  const wasDone = existing?.status === "Concluida";
  const files = [...document.querySelector("#attachments").files].map((file) => ({ name: file.name, size: file.size, type: file.type }));
  const checklistLines = value("checklist").split("\n").map((text) => text.trim()).filter(Boolean);
  const previousChecklist = existing?.checklist || [];
  const checklist = checklistLines.map((text, index) => {
    const prev = previousChecklist.find((item) => (item.text || item) === text) || previousChecklist[index];
    return {
      id: prev?.id || `cl_${index}`,
      text,
      done: Boolean(prev?.done),
    };
  });
  const payload = {
    title: value("title"),
    description: value("description"),
    category: value("category"),
    priority: value("priority"),
    date: value("date"),
    time: value("time"),
    color: value("color"),
    location: value("location"),
    notes: value("notes"),
    status: value("status"),
    estimated: Number(value("estimated") || 0),
    spent: Number(value("spent") || 0),
    tags: value("tags").split(",").map((tag) => tag.trim()).filter(Boolean),
    checklist,
    attachments: files.length ? files : existing?.attachments || [],
    updatedAt: new Date().toISOString(),
  };
  if (existing) Object.assign(existing, payload);
  else state.tasks.unshift(createTask({ id, ...payload }));
  state.history.push(`${existing ? "Editou" : "Criou"}: ${payload.title}`);
  if (!wasDone && payload.status === "Concluida") {
    rewardCompletion(existing || state.tasks[0], 20);
  }
  els.taskDialog.close();
  toast("Tarefa salva com sucesso.");
  persistAndRender();
}

function rewardCompletion(task, points = 10) {
  if (!task?.id) return 0;
  if (!Array.isArray(state.user.rewardedTaskIds)) state.user.rewardedTaskIds = [];
  if (state.user.rewardedTaskIds.includes(task.id)) return 0;
  state.user.rewardedTaskIds.push(task.id);
  state.user.points += points;
  state.user.level = Math.max(1, Math.floor(state.user.points / 140) + 1);
  return points;
}

function value(id) {
  return document.querySelector(`#${id}`).value.trim();
}

function deleteTaskFromModal() {
  const id = document.querySelector("#taskId").value;
  const task = state.tasks.find((item) => item.id === id);
  if (!task || !confirm(`Excluir "${task.title}"?`)) return;
  deletedSnapshot = task;
  state.tasks = state.tasks.filter((item) => item.id !== id);
  state.history.push(`Excluiu: ${task.title}`);
  els.taskDialog.close();
  toast("Tarefa excluida.", "Desfazer", () => {
    state.tasks.unshift(deletedSnapshot);
    deletedSnapshot = null;
    persistAndRender();
  });
  persistAndRender();
}

function mutateTask(id, mutator, history) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  const wasDone = task.status === "Concluida";
  mutator(task);
  task.updatedAt = new Date().toISOString();
  state.history.push(`${history}: ${task.title}`);
  if (!wasDone && task.status === "Concluida") {
    const gained = rewardCompletion(task, 10);
    if (gained) toast(`Tarefa concluida! +${gained} XP`);
  }
  persistAndRender();
}

function duplicateTask(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  state.tasks.unshift(createTask({ ...task, id: uid(), title: `${task.title} (copia)`, status: "A Fazer", createdAt: new Date().toISOString() }));
  state.history.push(`Duplicou: ${task.title}`);
  toast("Tarefa duplicada.");
  persistAndRender();
}

async function copyTask(id) {
  const task = state.tasks.find((item) => item.id === id);
  await navigator.clipboard?.writeText(`${task.title}\n${task.description}\n${task.date} ${task.time}`);
  toast("Conteudo copiado.");
}

async function shareTask(id) {
  const task = state.tasks.find((item) => item.id === id);
  const text = `${task.title} - ${task.date} ${task.time}`;
  if (navigator.share) await navigator.share({ title: task.title, text });
  else await navigator.clipboard?.writeText(text);
  toast("Tarefa pronta para compartilhar.");
}

function archiveTask(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  state.tasks = state.tasks.filter((item) => item.id !== id);
  state.archived.unshift(task);
  state.history.push(`Arquivou: ${task.title}`);
  toast("Tarefa arquivada.");
  persistAndRender();
}

function restoreTask(id) {
  const task = state.archived.find((item) => item.id === id);
  if (!task) return;
  state.archived = state.archived.filter((item) => item.id !== id);
  state.tasks.unshift(task);
  state.history.push(`Restaurou: ${task.title}`);
  persistAndRender();
}

function addCategory() {
  const input = document.querySelector("#newCategory");
  const name = input.value.trim();
  if (!name || state.categories.includes(name)) return;
  state.categories.push(name);
  input.value = "";
  toast("Categoria adicionada.");
  persistAndRender();
}

function filteredTasks() {
  const now = new Date();
  const today = todayISO();
  const tomorrow = dateKey(addDays(now, 1));
  return state.tasks.filter((task) => {
    const taskDate = parseLocalDate(task.date) || new Date(NaN);
    const filterMatch = {
      Hoje: task.date === today,
      Amanha: task.date === tomorrow,
      "Esta semana": isSameWeek(taskDate, now),
      "Este mes": taskDate.getMonth() === now.getMonth() && taskDate.getFullYear() === now.getFullYear(),
      Todas: true,
      Atrasadas: task.date < today && task.status !== "Concluida",
      Favoritas: task.favorite,
      Concluidas: task.status === "Concluida",
    }[state.filter] ?? true;
    const haystack = [task.title, task.description, task.category, task.priority, task.date, task.status, task.notes, task.location, ...task.tags].join(" ").toLowerCase();
    return filterMatch && (!searchTerm || haystack.includes(searchTerm));
  }).sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority) || `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
}

function upcomingTasks() {
  return state.tasks.filter((task) => task.status !== "Concluida").sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
}

function getMetrics() {
  const total = state.tasks.length;
  const completed = state.tasks.filter((task) => task.status === "Concluida").length;
  const pending = total - completed;
  return { total, completed, pending, percent: total ? Math.round((completed / total) * 100) : 0 };
}

function priorityColor(name) {
  return PRIORITIES.find((item) => item.name === name)?.color || "#94a3b8";
}

function priorityWeight(name) {
  return PRIORITIES.find((item) => item.name === name)?.weight || 0;
}

function emptyState(message) {
  return `<div class="empty-state"><div><div class="skeleton"></div><p>${message}</p></div></div>`;
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  applyTheme();
  persistAndRender();
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  localStorage.setItem("taskflow-theme", state.theme);
}

function exportCsv() {
  const header = ["Titulo", "Categoria", "Prioridade", "Data", "Hora", "Status", "Tags"];
  const rows = state.tasks.map((task) => [task.title, task.category, task.priority, task.date, task.time, task.status, task.tags.join("|")]);
  const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  downloadText(`taskflow-${todayISO()}.csv`, csv, "text/csv");
}

async function requestNotifications() {
  if (!("Notification" in window)) return toast("Este navegador nao suporta notificacoes.");
  const permission = await Notification.requestPermission();
  toast(permission === "granted" ? "Notificacoes ativadas." : "Notificacoes nao autorizadas.");
}

function notifyOverdueTasks() {
  const overdue = state.tasks.filter((task) => task.date < todayISO() && task.status !== "Concluida").length;
  if (overdue) toast(`${overdue} tarefa(s) atrasada(s).`);
}

async function handleSignIn(event) {
  event.preventDefault();
  try {
    const { error } = await signIn(value("authEmail"), value("authPassword"));
    if (error) throw error;
    toast("Login realizado.");
    els.authDialog.close();
  } catch (error) {
    toast(error.message);
  }
}

async function handleSignUp() {
  try {
    const { error } = await signUp(value("authEmail"), value("authPassword"));
    if (error) throw error;
    toast("Cadastro criado. Verifique seu email se necessario.");
  } catch (error) {
    toast(error.message);
  }
}

async function handlePasswordReset() {
  try {
    const { error } = await resetPassword(value("authEmail"));
    if (error) throw error;
    toast("Email de recuperacao enviado.");
  } catch (error) {
    toast(error.message);
  }
}

function handleShortcuts(event) {
  const target = event.target.tagName;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(target)) return;
  if (event.key.toLowerCase() === "n") openTaskModal();
  if (event.key === "/") {
    event.preventDefault();
    els.search.focus();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && deletedSnapshot) {
    state.tasks.unshift(deletedSnapshot);
    deletedSnapshot = null;
    persistAndRender();
  }
}

function toast(message, actionLabel, action) {
  const node = document.createElement("div");
  node.className = "toast";
  node.innerHTML = `${escapeHTML(message)} ${actionLabel ? `<button class="mini-button">${escapeHTML(actionLabel)}</button>` : ""}`;
  if (actionLabel) node.querySelector("button").addEventListener("click", () => { action(); node.remove(); });
  els.toastHost.appendChild(node);
  setTimeout(() => node.remove(), 5200);
}

function persistAndRender() {
  saveState(state);
  hydrateDashboardShell();
  render();
}
