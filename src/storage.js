const STORAGE_KEY = "taskflow-pro-state-v1";
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const VALID_STATUSES = ["A Fazer", "Em andamento", "Em espera", "Concluida", "Cancelada"];
const VALID_PRIORITIES = ["Muito Alta", "Alta", "Media", "Baixa", "Sem prioridade"];

export function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return null;
  try {
    return normalizeState(JSON.parse(saved));
  } catch {
    return null;
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function exportState(state) {
  const payload = {
    app: "taskflow-pro",
    version: 1,
    exportedAt: new Date().toISOString(),
    state,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const now = new Date();
  const localDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  link.download = `taskflow-backup-${localDay}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function importStateFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("Nenhum arquivo selecionado."));
      return;
    }
    if (file.size > MAX_IMPORT_BYTES) {
      reject(new Error("Arquivo muito grande (máx. 5 MB)."));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const candidate = parsed?.state && typeof parsed.state === "object" ? parsed.state : parsed;
        const normalized = normalizeState(candidate);
        if (!normalized || !Array.isArray(normalized.tasks)) {
          reject(new Error("Backup inválido: estrutura de estado não reconhecida."));
          return;
        }
        resolve(normalized);
      } catch (error) {
        reject(error instanceof Error ? error : new Error("JSON inválido."));
      }
    };
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsText(file);
  });
}

function normalizeChecklist(list = [], previous = []) {
  const prevById = new Map(previous.map((item) => [item.id, item]));
  const prevByText = new Map(previous.map((item) => [String(item.text || item).trim().toLowerCase(), item]));

  return (Array.isArray(list) ? list : [])
    .map((item, index) => {
      if (typeof item === "string") {
        const text = item.trim();
        if (!text) return null;
        const prev = prevByText.get(text.toLowerCase());
        return { id: prev?.id || `cl_${index}`, text, done: Boolean(prev?.done) };
      }
      if (!item || typeof item !== "object") return null;
      const text = String(item.text || "").trim();
      if (!text) return null;
      const prev = prevById.get(item.id) || prevByText.get(text.toLowerCase());
      return {
        id: typeof item.id === "string" ? item.id : prev?.id || `cl_${index}`,
        text,
        done: typeof item.done === "boolean" ? item.done : Boolean(prev?.done),
      };
    })
    .filter(Boolean);
}

function normalizeTask(raw) {
  if (!raw || typeof raw !== "object") return null;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!title) return null;
  return {
    ...raw,
    id: typeof raw.id === "string" && raw.id ? raw.id : crypto.randomUUID(),
    title,
    description: typeof raw.description === "string" ? raw.description : "",
    category: typeof raw.category === "string" ? raw.category : "Trabalho",
    priority: VALID_PRIORITIES.includes(raw.priority) ? raw.priority : "Media",
    status: VALID_STATUSES.includes(raw.status) ? raw.status : "A Fazer",
    date: typeof raw.date === "string" ? raw.date : (() => {
      const n = new Date();
      return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
    })(),
    time: typeof raw.time === "string" ? raw.time : "",
    tags: Array.isArray(raw.tags) ? raw.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
    checklist: normalizeChecklist(raw.checklist),
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
    estimated: Math.max(0, Number(raw.estimated) || 0),
    spent: Math.max(0, Number(raw.spent) || 0),
    favorite: Boolean(raw.favorite),
    archived: Boolean(raw.archived),
  };
}

export function normalizeState(raw) {
  if (!raw || typeof raw !== "object") return null;
  const tasks = Array.isArray(raw.tasks) ? raw.tasks.map(normalizeTask).filter(Boolean) : [];
  const categories = Array.isArray(raw.categories)
    ? raw.categories.map((name) => String(name).trim()).filter(Boolean)
    : [];
  const user = raw.user && typeof raw.user === "object" ? raw.user : {};
  return {
    ...raw,
    view: typeof raw.view === "string" ? raw.view : "dashboard",
    filter: typeof raw.filter === "string" ? raw.filter : "Todas",
    theme: raw.theme === "light" ? "light" : "dark",
    fontScale: Number(raw.fontScale) || 1,
    categories: categories.length ? categories : raw.categories,
    history: Array.isArray(raw.history) ? raw.history.map(String) : [],
    archived: Array.isArray(raw.archived) ? raw.archived.map(normalizeTask).filter(Boolean) : [],
    tasks,
    user: {
      name: typeof user.name === "string" ? user.name : "Usuario",
      points: Math.max(0, Number(user.points) || 0),
      streak: Math.max(0, Number(user.streak) || 0),
      level: Math.max(1, Number(user.level) || 1),
      badges: Array.isArray(user.badges) ? user.badges.map(String) : [],
      rewardedTaskIds: Array.isArray(user.rewardedTaskIds)
        ? user.rewardedTaskIds.filter((id) => typeof id === "string")
        : [],
    },
  };
}
