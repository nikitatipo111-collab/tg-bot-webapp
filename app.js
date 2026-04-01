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
      if (tab.dataset.tab === "tests") loadChatStats();
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

  // Voice toggle — show only if configured
  const voiceCard = document.getElementById("voice-card");
  if (state.voice_available) {
    voiceCard.style.display = "";
    document.getElementById("toggle-voice").checked = state.voice_mode;
  } else {
    voiceCard.style.display = "none";
  }

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
        ${name !== "default" ? '<button class="del-btn" data-name="' + name + '">&#10005;</button>' : ""}
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
  const desc = { fast: "Llama 3.1 8B", smart: "Llama 3.3 70B", mixtral: "Mixtral 8x7B", gemma: "Gemma 9B" };
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

// Find which preset matches current style
function getCurrentPresetName() {
  if (!state.style_desc) return null;
  const presets = state.presets || {};
  for (const [key, info] of Object.entries(presets)) {
    if (typeof info === "object" && info.name) {
      return info.name;
    }
  }
  return null;
}

function renderStyle() {
  const el = document.getElementById("style-status");
  const btn = document.getElementById("analyze-btn");
  if (state.style_desc) {
    // Try to find matching preset name
    let label = null;
    const presets = state.presets || {};
    for (const [key, info] of Object.entries(presets)) {
      const name = typeof info === "object" ? info.name : info;
      const short = typeof info === "object" ? info.short : "";
      // No easy way to match, just show truncated
    }
    const display = state.style_desc.length > 120 ? state.style_desc.substring(0, 120) + "..." : state.style_desc;
    el.textContent = display;
    el.className = "style-text active";
    btn.textContent = "Переанализировать";
  } else {
    el.textContent = "Стиль не установлен";
    el.className = "style-text";
    btn.textContent = "Анализировать из сообщений";
  }
}

function renderPresets() {
  const list = document.getElementById("presets-list");
  if (!list) return;
  list.innerHTML = "";
  const presets = state.presets || {};
  const icons = { troll: "fire", friendly: "wave", chill: "sleep", flirt: "wink", formal: "tie", zek: "lock" };
  const colors = { troll: "#ef4444", friendly: "#22c55e", chill: "#3b82f6", flirt: "#ec4899", formal: "#6366f1", zek: "#f59e0b" };

  for (const [key, info] of Object.entries(presets)) {
    const name = typeof info === "object" ? info.name : info;
    const short = typeof info === "object" ? (info.short || key) : key;
    const color = colors[key] || "#8b5cf6";
    const card = document.createElement("div");
    card.className = "item-card preset-card";
    card.innerHTML = `
      <div class="preset-info">
        <div class="item-name" style="display:flex;align-items:center;gap:8px">
          <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;box-shadow:0 0 8px ${color}40"></span>
          ${name}
        </div>
        <div class="preset-short">${short}</div>
      </div>
      <button class="apply-btn">Применить</button>`;
    card.querySelector(".apply-btn").onclick = (e) => {
      e.stopPropagation();
      applyPreset(key, e.target);
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

async function toggleVoice(enabled) {
  state.voice_mode = enabled;
  if (tg) tg.HapticFeedback?.impactOccurred("light");
  api("/api/voice", "POST", { enabled });
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

async function applyPreset(key, btn) {
  if (busy) return;
  busy = true;
  const origText = btn.textContent;
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
  btn.textContent = origText;
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

// === Test Functions ===

async function testReply(text) {
  if (busy || !text.trim()) return;
  busy = true;
  const resultDiv = document.getElementById("test-result");
  const replyDiv = document.getElementById("test-reply");
  const sendBtn = document.getElementById("test-send-btn");
  resultDiv.style.display = "block";
  replyDiv.textContent = "думаю...";
  replyDiv.className = "test-reply loading";
  sendBtn.disabled = true;
  if (tg) tg.HapticFeedback?.impactOccurred("light");
  try {
    const res = await api("/api/test-reply", "POST", { text: text.trim() });
    if (res.reply) {
      replyDiv.textContent = res.reply;
      replyDiv.className = "test-reply";
      if (tg) tg.HapticFeedback?.notificationOccurred("success");
    } else {
      replyDiv.textContent = res.error || "ошибка";
      replyDiv.className = "test-reply";
    }
  } catch (e) {
    replyDiv.textContent = "не удалось";
    replyDiv.className = "test-reply";
  }
  sendBtn.disabled = false;
  busy = false;
}

async function loadChatStats() {
  try {
    const res = await api("/api/chat-stats");
    document.getElementById("active-chats").textContent = res.active_chats || 0;
    document.getElementById("total-history").textContent = res.total_messages || 0;
  } catch (e) {}
}

async function clearChatHistory() {
  const doClear = async () => {
    if (tg) tg.HapticFeedback?.notificationOccurred("warning");
    await api("/api/clear-history", "POST");
    loadChatStats();
  };
  if (tg) {
    tg.showConfirm("Очистить все диалоги бота?", (ok) => { if (ok) doClear(); });
  } else {
    if (confirm("Очистить все диалоги бота?")) doClear();
  }
}

// === Events ===

document.getElementById("toggle-auto").addEventListener("change", (e) => toggleAuto(e.target.checked));
document.getElementById("toggle-learn").addEventListener("change", (e) => toggleLearn(e.target.checked));
document.getElementById("toggle-voice").addEventListener("change", (e) => toggleVoice(e.target.checked));
document.getElementById("clear-btn").addEventListener("click", clearMemory);

document.getElementById("test-send-btn").addEventListener("click", () => {
  testReply(document.getElementById("test-input").value);
});

document.getElementById("test-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") testReply(e.target.value);
});

document.querySelectorAll(".quick-test-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.getElementById("test-input").value = btn.dataset.msg;
    testReply(btn.dataset.msg);
  });
});

document.getElementById("clear-history-btn").addEventListener("click", clearChatHistory);

document.getElementById("analyze-btn").addEventListener("click", async () => {
  const btn = document.getElementById("analyze-btn");
  const el = document.getElementById("style-status");
  btn.textContent = "Анализирую...";
  btn.style.pointerEvents = "none";
  el.textContent = "Подожди 5-10 сек...";
  el.className = "style-text";
  el.style.color = "var(--accent)";
  try {
    const res = await api("/api/analyze", "POST");
    if (res.style_desc) {
      state.style_desc = res.style_desc;
      if (tg) tg.HapticFeedback?.notificationOccurred("success");
    } else if (res.error) {
      el.textContent = res.error;
      el.style.color = "var(--danger)";
    }
  } catch (e) {
    el.textContent = "Ошибка";
    el.style.color = "var(--danger)";
  }
  el.style.color = "";
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
  tg.setHeaderColor("#0c0c14");
  tg.setBackgroundColor("#0c0c14");
}

loadStatus().catch(() => {
  document.getElementById("loading").innerHTML = '<div style="text-align:center;color:#6b6b80"><p>Не удалось подключиться</p></div>';
});
