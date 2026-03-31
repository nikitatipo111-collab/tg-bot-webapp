const tg = window.Telegram?.WebApp;
const API_URL = "https://tg-autoresponder-bot-production.up.railway.app";

let state = {};
let busy = false;

// === API ===

async function api(path, method = "GET", body = null) {
  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": tg?.initData || "",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API_URL + path, opts);
  return res.json();
}

async function loadStatus() {
  state = await api("/api/status");
  render();
}

// === Render ===

function render() {
  document.getElementById("loading").style.display = "none";
  document.getElementById("app").style.display = "block";

  document.getElementById("profile-badge").textContent = state.profile || "default";
  document.getElementById("msg-count").textContent = state.msg_count || 0;
  document.getElementById("profiles-count").textContent = Object.keys(state.profiles || {}).length;

  document.getElementById("toggle-auto").checked = state.auto_reply;
  document.getElementById("toggle-learn").checked = state.learning;

  renderProfiles();
  renderModels();
}

function renderProfiles() {
  const list = document.getElementById("profiles-list");
  list.innerHTML = "";
  for (const [name, count] of Object.entries(state.profiles || {})) {
    const active = name === state.profile;
    const card = document.createElement("div");
    card.className = "item-card" + (active ? " active" : "");
    card.innerHTML = `<div><div class="item-name">${name}</div><div class="item-meta">${count} сообщений</div></div><div class="item-check"></div>`;
    card.onclick = () => switchProfile(name);
    list.appendChild(card);
  }
}

function renderModels() {
  const desc = { fast: "Llama 3.1 8B — быстрая", smart: "Llama 3.3 70B — умная", mixtral: "Mixtral 8x7B", gemma: "Gemma 9B" };
  const list = document.getElementById("models-list");
  list.innerHTML = "";
  for (const name of state.models || []) {
    const active = name === state.model;
    const card = document.createElement("div");
    card.className = "item-card" + (active ? " active" : "");
    card.innerHTML = `<div><div class="item-name">${name}</div><div class="item-meta">${desc[name] || name}</div></div><div class="item-check"></div>`;
    card.onclick = () => switchModel(name);
    list.appendChild(card);
  }
}

// === Actions (optimistic UI — обновляем сразу, потом шлём запрос) ===

async function toggleAuto(enabled) {
  state.auto_reply = enabled;
  if (tg) tg.HapticFeedback?.impactOccurred("light");
  api("/api/auto", "POST", { enabled });
}

async function toggleLearn(enabled) {
  state.learning = enabled;
  if (tg) tg.HapticFeedback?.impactOccurred("light");
  api("/api/learning", "POST", { enabled });
}

async function switchProfile(name) {
  if (busy || name === state.profile) return;
  busy = true;
  state.profile = name;
  state.msg_count = state.profiles[name] || 0;
  renderProfiles();
  document.getElementById("profile-badge").textContent = name;
  document.getElementById("msg-count").textContent = state.msg_count;
  if (tg) tg.HapticFeedback?.impactOccurred("medium");
  await api("/api/profile", "POST", { name });
  busy = false;
}

async function switchModel(name) {
  if (busy || name === state.model) return;
  busy = true;
  state.model = name;
  renderModels();
  if (tg) tg.HapticFeedback?.impactOccurred("medium");
  await api("/api/model", "POST", { name });
  busy = false;
}

async function createProfile(name) {
  if (busy) return;
  busy = true;
  state.profiles[name] = 0;
  state.profile = name;
  state.msg_count = 0;
  state.learning = true;
  render();
  if (tg) tg.HapticFeedback?.notificationOccurred("success");
  await api("/api/newprofile", "POST", { name });
  busy = false;
}

async function clearMemory() {
  const doClear = async () => {
    state.msg_count = 0;
    state.profiles[state.profile] = 0;
    render();
    if (tg) tg.HapticFeedback?.notificationOccurred("warning");
    await api("/api/clear", "POST");
  };

  if (tg) {
    tg.showConfirm("Очистить память текущего профиля?", (ok) => { if (ok) doClear(); });
  } else {
    if (confirm("Очистить память текущего профиля?")) doClear();
  }
}

// === Events ===

document.getElementById("toggle-auto").addEventListener("change", (e) => toggleAuto(e.target.checked));
document.getElementById("toggle-learn").addEventListener("change", (e) => toggleLearn(e.target.checked));
document.getElementById("clear-btn").addEventListener("click", clearMemory);

document.getElementById("add-profile-btn").addEventListener("click", () => {
  document.getElementById("modal").classList.add("show");
  document.getElementById("profile-input").value = "";
  setTimeout(() => document.getElementById("profile-input").focus(), 100);
});

document.getElementById("modal-cancel").addEventListener("click", () => {
  document.getElementById("modal").classList.remove("show");
});

document.getElementById("modal-create").addEventListener("click", async () => {
  const name = document.getElementById("profile-input").value.trim().toLowerCase();
  if (name) {
    document.getElementById("modal").classList.remove("show");
    await createProfile(name);
  }
});

document.getElementById("profile-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("modal-create").click();
});

// === Init ===

if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor("#0a0a0f");
  tg.setBackgroundColor("#0a0a0f");
}

loadStatus().catch(() => {
  document.getElementById("loading").innerHTML = '<div style="text-align:center;color:#888"><p>Не удалось подключиться</p></div>';
});
