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
      if (tab.dataset.tab === "tests") { loadChatStats(); loadReplyLog(); loadBlacklist(); }
      if (tab.dataset.tab === "tgdel") { openTGDel(); return; }
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

  // Delay slider
  const delaySlider = document.getElementById("delay-slider");
  delaySlider.value = state.reply_delay || 0;
  document.getElementById("delay-value").textContent = (state.reply_delay || 0) + "с";

  // TTL slider
  const ttlSlider = document.getElementById("ttl-slider");
  ttlSlider.value = state.context_ttl || 0;
  document.getElementById("ttl-value").textContent = (state.context_ttl || 0) > 0 ? (state.context_ttl + "ч") : "∞";

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

// === Delay & TTL ===

let delayTimer = null;
let ttlTimer = null;

function initSliders() {
  const delaySlider = document.getElementById("delay-slider");
  const ttlSlider = document.getElementById("ttl-slider");

  delaySlider.addEventListener("input", (e) => {
    const v = parseInt(e.target.value);
    document.getElementById("delay-value").textContent = v + "с";
    clearTimeout(delayTimer);
    delayTimer = setTimeout(() => {
      api("/api/delay", "POST", { seconds: v });
      if (tg) tg.HapticFeedback?.impactOccurred("light");
    }, 500);
  });

  ttlSlider.addEventListener("input", (e) => {
    const v = parseInt(e.target.value);
    document.getElementById("ttl-value").textContent = v > 0 ? (v + "ч") : "∞";
    clearTimeout(ttlTimer);
    ttlTimer = setTimeout(() => {
      api("/api/context-ttl", "POST", { hours: v });
      if (tg) tg.HapticFeedback?.impactOccurred("light");
    }, 500);
  });
}

// === Blacklist ===

async function loadBlacklist() {
  try {
    const res = await api("/api/blacklist");
    renderBlacklist(res.blacklist || []);
  } catch (e) {}
}

function renderBlacklist(list) {
  const el = document.getElementById("blacklist");
  if (!list.length) {
    el.innerHTML = '<div class="log-empty">Список пуст</div>';
    return;
  }
  el.innerHTML = list.map(item => `
    <div class="blacklist-entry">
      <div class="blacklist-info">
        <div class="blacklist-name">${item.name || "Без имени"}</div>
        <div class="blacklist-id">${item.chat_id}</div>
      </div>
      <button class="blacklist-remove" data-id="${item.chat_id}">✕</button>
    </div>
  `).join("");
  el.querySelectorAll(".blacklist-remove").forEach(btn => {
    btn.addEventListener("click", async () => {
      await api("/api/blacklist/remove", "POST", { chat_id: parseInt(btn.dataset.id) });
      if (tg) tg.HapticFeedback?.notificationOccurred("warning");
      loadBlacklist();
    });
  });
}

async function addToBlacklist() {
  const chatId = document.getElementById("blacklist-input").value.trim();
  const name = document.getElementById("blacklist-name").value.trim();
  if (!chatId) return;
  await api("/api/blacklist/add", "POST", { chat_id: parseInt(chatId), name });
  document.getElementById("blacklist-input").value = "";
  document.getElementById("blacklist-name").value = "";
  if (tg) tg.HapticFeedback?.notificationOccurred("success");
  loadBlacklist();
}

// === Reply Log ===

async function loadReplyLog() {
  try {
    const res = await api("/api/reply-log");
    renderReplyLog(res.log || []);
  } catch (e) {}
}

function renderReplyLog(log) {
  const el = document.getElementById("reply-log");
  if (!log.length) {
    el.innerHTML = '<div class="log-empty">Пока нет ответов</div>';
    return;
  }
  el.innerHTML = log.map(item => `
    <div class="log-entry">
      <div class="log-header">
        <div class="log-name">${item.name}</div>
        <div class="log-time">${item.time}</div>
      </div>
      <div class="log-incoming">→ ${item.incoming}</div>
      <div class="log-reply">← ${item.reply}</div>
    </div>
  `).join("");
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
document.getElementById("blacklist-add-btn").addEventListener("click", addToBlacklist);
document.getElementById("tg-exit").addEventListener("click", closeTGDel);
document.getElementById("tg-exit2").addEventListener("click", closeTGDel);
document.getElementById("tg-chat-back").addEventListener("click", closeTGChat);

// Filter click handlers
document.querySelectorAll(".tg-filter").forEach(f => {
  f.addEventListener("click", () => {
    document.querySelectorAll(".tg-filter").forEach(x => x.classList.remove("active"));
    f.classList.add("active");
    tgActiveFilter = f.dataset.filter;
    if (tgCachedChats.length) renderTGChats(tgCachedChats);
    if (tg) tg.HapticFeedback?.impactOccurred("light");
  });
});
document.getElementById("toggle-tgdel").addEventListener("change", (e) => {
  api("/api/tgdel/toggle", "POST", { enabled: e.target.checked });
  if (tg) tg.HapticFeedback?.impactOccurred("light");
});

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

// === TGDel — Fullscreen Telegram Clone ===

let tgCachedChats = [];
let tgActiveFilter = "all";

const TG_GRADIENTS = [
  "linear-gradient(135deg, #FF885E, #FF516A)",
  "linear-gradient(135deg, #FFD54F, #FF9800)",
  "linear-gradient(135deg, #76C84D, #53B917)",
  "linear-gradient(135deg, #6EC6FF, #2196F3)",
  "linear-gradient(135deg, #B39DDB, #7C4DFF)",
  "linear-gradient(135deg, #F06292, #EC407A)",
];

function tgAvStyle(id) { return TG_GRADIENTS[Math.abs(id) % TG_GRADIENTS.length]; }
function tgInitial(n) { return (n || "?").charAt(0).toUpperCase(); }

function openTGDel() {
  document.getElementById("tg-app").classList.remove("tg-hidden");
  document.getElementById("app").style.display = "none";
  document.getElementById("loading").style.display = "none";
  document.querySelector(".aurora").style.display = "none";
  document.body.style.padding = "0";
  document.body.style.overflow = "hidden";
  loadTGChats();
  if (tg) tg.HapticFeedback?.impactOccurred("medium");
}

function closeTGDel() {
  document.getElementById("tg-app").classList.add("tg-hidden");
  document.getElementById("app").style.display = "block";
  document.querySelector(".aurora").style.display = "";
  document.body.style.padding = "";
  document.body.style.overflow = "";
  // Reset to list screen
  document.getElementById("tg-screen-chat").classList.add("tg-offscreen-right");
  document.getElementById("tg-screen-settings").classList.add("tg-hidden");
  document.getElementById("tg-screen-list").classList.remove("tg-hidden");
  // Reset filter
  tgActiveFilter = "all";
  document.querySelectorAll(".tg-filter").forEach(f => f.classList.remove("active"));
  document.querySelector('.tg-filter[data-filter="all"]')?.classList.add("active");
  // Switch back to main tab
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
  document.querySelector('[data-tab="main"]').classList.add("active");
  document.getElementById("tab-main").classList.add("active");
  if (tg) tg.HapticFeedback?.impactOccurred("light");
}

async function loadTGChats() {
  try {
    const res = await api("/api/tgdel/chats");
    document.getElementById("toggle-tgdel").checked = res.enabled;
    renderTGChats(res.chats || []);
  } catch (e) {}
}

function tgStripOwn(name) {
  return (name || "").replace(/^OWN:/, "");
}

function renderTGChats(chats) {
  const el = document.getElementById("tg-chat-list");
  if (!chats.length) {
    el.innerHTML = `
      <div class="tg-empty">
        <div class="tg-empty-icon">🗑️</div>
        <div class="tg-empty-text">Удалённых сообщений нет</div>
        <div class="tg-empty-sub">Включи TGDel и жди</div>
      </div>`;
    updateTGFilterCounts([]);
    return;
  }

  // Cache chats for filtering
  tgCachedChats = chats;
  updateTGFilterCounts(chats);

  // Apply active filter
  const filtered = tgActiveFilter === "all" ? chats : chats.filter(c => {
    const t = (c.last_type || "text").toLowerCase();
    if (tgActiveFilter === "text") return t === "text" || t === "deleted" || t === "edited";
    if (tgActiveFilter === "photo") return t === "photo" || t === "view_once";
    if (tgActiveFilter === "voice") return t === "voice";
    if (tgActiveFilter === "video") return t === "video";
    return true;
  });

  el.innerHTML = filtered.map(c => {
    const displayName = tgStripOwn(c.name);
    const icon = c.last_type === "edited" ? "✏️ " : c.last_type === "view_once" ? "👁 " : "🗑 ";
    const prev = (c.last_text || "медиа").substring(0, 45);
    return `
    <div class="tg-chat-row" data-cid="${c.chat_id}" data-cname="${displayName}">
      <div class="tg-av" style="background:${tgAvStyle(c.chat_id)}">${tgInitial(displayName)}</div>
      <div class="tg-chat-body">
        <div class="tg-row-top">
          <div class="tg-chat-name">${displayName}</div>
          <div class="tg-row-time">${c.last_time}</div>
        </div>
        <div class="tg-row-bottom">
          <div class="tg-row-preview">${icon}${prev}</div>
          <div class="tg-row-badge">${c.count}</div>
        </div>
      </div>
    </div>`;
  }).join("");

  el.querySelectorAll(".tg-chat-row").forEach(row => {
    row.addEventListener("click", () => {
      openTGChat(parseInt(row.dataset.cid), row.dataset.cname);
    });
  });
}

function updateTGFilterCounts(chats) {
  const counts = { all: 0, text: 0, photo: 0, voice: 0, video: 0 };
  chats.forEach(c => {
    counts.all += c.count || 0;
    const t = (c.last_type || "text").toLowerCase();
    if (t === "text" || t === "deleted" || t === "edited") counts.text += c.count || 0;
    else if (t === "photo" || t === "view_once") counts.photo += c.count || 0;
    else if (t === "voice") counts.voice += c.count || 0;
    else if (t === "video") counts.video += c.count || 0;
    else counts.text += c.count || 0;
  });
  document.querySelectorAll(".tg-filter").forEach(f => {
    const key = f.dataset.filter;
    const label = { all: "Все", text: "Текст", photo: "Фото", voice: "Голос", video: "Видео" }[key] || key;
    const cnt = counts[key] || 0;
    f.textContent = cnt > 0 ? `${label} ${cnt}` : label;
  });
}

async function openTGChat(chatId, name) {
  const displayName = tgStripOwn(name);
  const av = document.getElementById("tg-chat-av");
  av.className = "tg-chat-av-right";
  av.style.background = tgAvStyle(chatId);
  av.textContent = tgInitial(displayName);
  document.getElementById("tg-chat-title").textContent = displayName;
  document.getElementById("tg-chat-sub").textContent = "был(а) недавно";

  // Slide in
  document.getElementById("tg-screen-chat").classList.remove("tg-offscreen-right");
  if (tg) tg.HapticFeedback?.impactOccurred("light");

  try {
    const res = await api(`/api/tgdel/messages?chat_id=${chatId}`);
    renderTGMsgs(res.messages || []);
  } catch (e) {
    document.getElementById("tg-chat-msgs").innerHTML = '<div class="tg-empty"><div class="tg-empty-text">Ошибка</div></div>';
  }
}

function closeTGChat() {
  document.getElementById("tg-screen-chat").classList.add("tg-offscreen-right");
  document.getElementById("tg-screen-settings").classList.add("tg-hidden");
  document.getElementById("tg-screen-list").classList.remove("tg-hidden");
  if (tg) tg.HapticFeedback?.impactOccurred("light");
}

function tgDateLabel(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  const todayStr = today.toDateString();
  const yest = new Date(today); yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === todayStr) return "Сегодня";
  if (d.toDateString() === yest.toDateString()) return "Вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}


function tgMediaUrl(fileId) {
  if (!fileId) return "";
  const initData = tg?.initData || "";
  return `${API_URL}/api/tgdel/media?file_id=${encodeURIComponent(fileId)}&init_data=${encodeURIComponent(initData)}`;
}

function renderTGMsgs(msgs) {
  const el = document.getElementById("tg-chat-msgs");
  if (!msgs.length) {
    el.innerHTML = '<div class="tg-empty" style="height:100%"><div class="tg-empty-text">Пусто</div></div>';
    return;
  }

  // SVG double check marks
  const checksSvg = '<span class="tg-bub-checks"><svg viewBox="0 0 16 11" fill="none"><path d="M1 5.5L4.5 9L11 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 5.5L8.5 9L15 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';

  let lastDate = null;
  let lastOwn = null; // track sender for grouping

  const parts = [];

  msgs.forEach((m, i) => {
    const own = m.is_own;
    const isPhoto = m.msg_type === "photo" || m.msg_type === "sticker";
    const isVoice = m.msg_type === "voice" || m.msg_type === "video_note";
    const isVideo = m.msg_type === "video";
    const hasFile = !!m.file_id;
    const hasText = !!(m.original);

    // --- Date separator ---
    const dateLabel = tgDateLabel(m.date);
    if (dateLabel && dateLabel !== lastDate) {
      lastDate = dateLabel;
      parts.push(`<div class="tg-date-sep"><span>${dateLabel}</span></div>`);
      lastOwn = null; // reset grouping after date
    }

    // --- Grouping: gap between different senders ---
    const sameGroup = lastOwn === own;
    const gapClass = (lastOwn !== null && !sameGroup) ? "tg-msg-gap" : "";
    lastOwn = own;

    // --- Tail: only on last message before sender change or end ---
    const next = msgs[i + 1];
    const nextDateLabel = next ? tgDateLabel(next.date) : null;
    const isLastInGroup = !next || next.is_own !== own || (nextDateLabel && nextDateLabel !== dateLabel);
    const tailClass = isLastInGroup ? (own ? "tg-bub-tail-r" : "tg-bub-tail-l") : "";

    // --- Sender name above first message from other in group ---
    let senderHtml = "";
    if (!own && !sameGroup) {
      senderHtml = `<div class="tg-sender-name">${m.name || ""}</div>`;
    }

    // --- Meta: time + checks ---
    const meta = `<span class="tg-bub-meta"><span class="tg-bub-meta-time">${m.time}</span>${own ? checksSvg : ""}</span>`;

    // --- Photo block ---
    function photoHtml() {
      if (!hasFile) return '<div class="tg-bub-media">📷 фото</div>';
      return `<div class="tg-bub-photo"><img src="${tgMediaUrl(m.file_id)}" alt="" loading="lazy" onerror="this.parentNode.innerHTML='📷 фото'"></div>`;
    }

    // --- Media label ---
    function mediaHtml() {
      if (isVoice) return '<div class="tg-bub-media">🎤 голосовое</div>';
      if (isVideo) return '<div class="tg-bub-media">🎬 видео</div>';
      if (m.msg_type === "document") return '<div class="tg-bub-media">📄 документ</div>';
      if (m.msg_type === "sticker") {
        return hasFile
          ? `<div class="tg-bub-photo"><img src="${tgMediaUrl(m.file_id)}" alt="" style="max-width:150px" onerror="this.parentNode.innerHTML='🏷 стикер'"></div>`
          : '<div class="tg-bub-media">🏷 стикер</div>';
      }
      return "";
    }

    // --- Photo-only class ---
    const photoClass = (isPhoto && hasFile && !hasText) ? "tg-bub-has-photo" : "";
    const side = own ? "tg-bub-right" : "";

    // --- Build bubble content ---
    let bubbleContent = "";

    if (m.event === "deleted") {
      if (isPhoto) {
        bubbleContent = `${photoHtml()}${hasText ? `<div class="tg-bub-txt">${m.original}</div>` : ""}`;
      } else if (m.msg_type !== "text") {
        bubbleContent = `${mediaHtml()}${hasText ? `<div class="tg-bub-txt">${m.original}</div>` : ""}`;
      } else {
        bubbleContent = `<div class="tg-bub-txt">${m.original || ""}</div>`;
      }
      bubbleContent += `<div class="tg-bub-lbl tg-lbl-del">🗑 удалено</div>${meta}`;

    } else if (m.event === "edited") {
      // First bubble: old text
      const bub1 = `<div class="tg-bub ${side} ${tailClass}">
        <div class="tg-bub-txt strike">${m.original || ""}</div>
        <div class="tg-bub-lbl tg-lbl-was">✏️ было</div>${meta}
      </div>`;
      // Arrow
      const arrow = `<div class="tg-arrow ${own ? "tg-arrow-right" : ""}">↓</div>`;
      // Second bubble: new text
      const bub2 = `<div class="tg-bub ${side}">
        <div class="tg-bub-txt">${m.new_text || ""}</div>
        <div class="tg-bub-lbl tg-lbl-now">✏️ стало</div>${meta}
      </div>`;

      parts.push(`<div class="tg-msg-wrap ${own ? "tg-msg-own" : ""} ${gapClass}">
        ${senderHtml}${bub1}${arrow}${bub2}
      </div>`);
      return; // skip normal wrapping

    } else if (m.event === "view_once") {
      if (isPhoto && hasFile) {
        bubbleContent = photoHtml();
      } else {
        bubbleContent = hasText
          ? `<div class="tg-bub-txt">${m.original}</div>`
          : '<div class="tg-bub-media">📷 одноразовое</div>';
      }
      bubbleContent += `<div class="tg-bub-lbl tg-lbl-vo">👁 одноразовое</div>${meta}`;
    }

    // --- Wrap in bubble + wrapper ---
    parts.push(`<div class="tg-msg-wrap ${own ? "tg-msg-own" : ""} ${gapClass}">
      ${senderHtml}
      <div class="tg-bub ${side} ${tailClass} ${photoClass}">${bubbleContent}</div>
    </div>`);
  });

  el.innerHTML = parts.join("");
  el.scrollTop = el.scrollHeight;
}

// === TGDel Tab navigation ===
unction tgSwitchScreen(screenName) {
  const list = document.getElementById("tg-screen-list");
  const settings = document.getElementById("tg-screen-settings");
  if (screenName === "list") {
    list.classList.remove("tg-hidden");
    settings.classList.add("tg-hidden");
  } else if (screenName === "settings") {
    list.classList.add("tg-hidden");
    settings.classList.remove("tg-hidden");
    fillTGSettings();
  }
  // Update all tab buttons across screens
  document.querySelectorAll(".tg-tab-btn[data-screen]").forEach(btn => {
    btn.classList.toggle("tg-tab-active", btn.dataset.screen === screenName);
  });
  if (tg) tg.HapticFeedback?.impactOccurred("light");
}

unction fillTGSettings() {
  const user = tg?.initDataUnsafe?.user;
  const av = document.getElementById("tg-settings-av");
  const name = document.getElementById("tg-settings-name");
  const uname = document.getElementById("tg-settings-uname");
  if (user) {
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");
    name.textContent = fullName || "User";
    uname.textContent = user.username ? "@" + user.username : "";
    if (user.photo_url) {
      av.innerHTML = `<img src="${user.photo_url}" alt="">`;
    } else {
      av.textContent = (fullName || "U").charAt(0).toUpperCase();
    }
  } else {
    name.textContent = "TGDel User";
    uname.textContent = "";
    av.textContent = "U";
  }
  // Sync toggle
  const mainToggle = document.getElementById("toggle-tgdel");
  const settingsToggle = document.getElementById("toggle-tgdel-settings");
  if (mainToggle && settingsToggle) settingsToggle.checked = mainToggle.checked;
}

// === Init ===

// TGDel tab buttonsdocument.querySelectorAll(".tg-tab-btn[data-screen]").forEach(btn => {  btn.addEventListener("click", () => tgSwitchScreen(btn.dataset.screen));});// Settings toggle syncdocument.getElementById("toggle-tgdel-settings")?.addEventListener("change", async (e) => {  const enabled = e.target.checked;  document.getElementById("toggle-tgdel").checked = enabled;  await api("/api/tgdel/toggle", "POST", { enabled });});// Clear historydocument.getElementById("tg-clear-history")?.addEventListener("click", async () => {  if (confirm("Очистить всю историю удалённых сообщений?")) {    await api("/api/tgdel/clear", "POST");    loadTGChats();    tgSwitchScreen("list");  }});// Exit from settingsdocument.getElementById("tg-exit3")?.addEventListener("click", closeTGDel);
initTabs();
initSliders();

if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor("#0c0c14");
  tg.setBackgroundColor("#0c0c14");
}

loadStatus().catch(() => {
  document.getElementById("loading").innerHTML = '<div style="text-align:center;color:#6b6b80"><p>Не удалось подключиться</p></div>';
});
