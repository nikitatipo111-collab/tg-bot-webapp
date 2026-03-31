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

// === Tabs ===

function initTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById("tab-" + tab.dataset.tab).classList.add("active");
      if (tg) tg.HapticFeedback?.impactOccurred("light");
    });
  });
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
  renderStyle();
  renderPresets();
}

function renderProfiles() {
  const list = document.getElementById("profiles-list");
  list.innerHTML = "";
  for (const [name, count] of Object.entries(state.profiles || {})) {
    const active = name === state.profile;
    const card = document.createElement("div");
    card.className = "item-card" + (active ? " active" : "");
    card.innerHTML = `
      <div style="flex:1" class="item-card-click">
        <div class="item-name">${name}</div>
        <div class="item-meta">${count} сообщений</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        ${name !== "default" ? '<button class="del-btn" data-name="' + name + '">✕</button>' : ""}
        <div class="item-check"></div>
      </div>`;
    card.querySelector(".item-card-click").onclick = () => switchProfile(name);
    const delBtn = card.querySelector(".del-btn");
    if (delBtn) {
      delBtn.onclick = (e) => {
        e.stopPropagation();
        deleteProfile(name);
      };
    }
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

function renderStyle() {
  const el = document.getElementById("style-status");
  const btn = document.getElementById("analyze-btn");
  if (state.style_desc) {
    el.textContent = state.style_desc.length > 150 ? state.style_desc.substring(0, 150) + "..." : state.style_desc;
    el.style.color = "#ccc";
    btn.textContent = "Переанализировать";
  } else {
    el.textContent = "Стиль не установлен";
    el.style.color = "#888";
    btn.textContent = "Анализировать из сообщений";
  }
}

function renderPresets() {
  const list = document.getElementById("presets-list");
  if (!list) return;
  list.innerHTML = "";
  const presets = state.presets || {};
  const presetEmoji = { troll: "🔥", friendly: "😊", chill: "😎", flirt: "😏", formal: "👔" };
  for (const [key, name] of Object.entries(presets)) {
    const card = document.createElement("div");
    card.className = "item-card preset-card";
    card.innerHTML = `
      <div>
        <div class="item-name">${presetEmoji[key] || "🎭"} ${name}</div>
        <div class="item-meta">${key}</div>
      </div>
      <button class="apply-btn">Применить</button>`;
    card.querySelector(".apply-btn").onclick = (e) => {
      e.stopPropagation();
      applyPreset(key);
    };
    list.appendChild(card);
  }
}

// === Actions ===

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
  // Reload to get new style_desc for this profile
  await loadStatus();
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

async function deleteProfile(name) {
  const doDelete = async () => {
    if (busy) return;
    busy = true;
    delete state.profiles[name];
    if (state.profile === name) {
      state.profile = "default";
      state.msg_count = state.profiles["default"] || 0;
    }
    render();
    if (tg) tg.HapticFeedback?.notificationOccurred("warning");
    await api("/api/delprofile", "POST", { name });
    busy = false;
  };

  if (tg) {
    tg.showConfirm(`Удалить профиль '${name}'?`, (ok) => { if (ok) doDelete(); });
  } else {
    if (confirm(`Удалить профиль '${name}'?`)) doDelete();
  }
}

async function applyPreset(key) {
  if (busy) return;
  busy = true;
  const btn = event.target;
  btn.textContent = "...";
  btn.style.pointerEvents = "none";
  if (tg) tg.HapticFeedback?.impactOccurred("heavy");
  try {
    const res = await api("/api/preset", "POST", { preset: key });
    if (res.style_desc) {
      state.style_desc = res.style_desc;
      renderStyle();
      if (tg) tg.HapticFeedback?.notificationOccurred("success");
    }
  } catch (e) {}
  btn.textContent = "Применить";
  btn.style.pointerEvents = "auto";
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

document.getElementById("analyze-btn").addEventListener("click", async () => {
  const btn = document.getElementById("analyze-btn");
  const el = document.getElementById("style-status");
  btn.textContent = "Анализирую...";
  btn.style.pointerEvents = "none";
  el.textContent = "Подожди 5-10 сек...";
  el.style.color = "#8b5cf6";
  try {
    const res = await api("/api/analyze", "POST");
    if (res.style_desc) {
      state.style_desc = res.style_desc;
      if (tg) tg.HapticFeedback?.notificationOccurred("success");
    } else if (res.error) {
      el.textContent = res.error;
      el.style.color = "#ef4444";
    }
  } catch (e) {
    el.textContent = "Ошибка";
    el.style.color = "#ef4444";
  }
  renderStyle();
  btn.style.pointerEvents = "auto";
});

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

initTabs();

if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor("#0a0a0f");
  tg.setBackgroundColor("#0a0a0f");
}

loadStatus().catch(() => {
  document.getElementById("loading").innerHTML = '<div style="text-align:center;color:#888"><p>Не удалось подключиться</p></div>';
});
