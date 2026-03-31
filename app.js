const tg = window.Telegram?.WebApp;
const API_URL = "https://tg-autoresponder-bot-production.up.railway.app";

let state = {};

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

  // Badge & stats
  document.getElementById("profile-badge").textContent = state.profile || "default";
  document.getElementById("msg-count").textContent = state.msg_count || 0;
  document.getElementById("profiles-count").textContent = Object.keys(state.profiles || {}).length;

  // Toggles
  document.getElementById("toggle-auto").checked = state.auto_reply;
  document.getElementById("toggle-learn").checked = state.learning;

  // Profiles
  const profilesList = document.getElementById("profiles-list");
  profilesList.innerHTML = "";
  for (const [name, count] of Object.entries(state.profiles || {})) {
    const isActive = name === state.profile;
    const card = document.createElement("div");
    card.className = "item-card" + (isActive ? " active" : "");
    card.innerHTML = `
      <div>
        <div class="item-name">${name}</div>
        <div class="item-meta">${count} сообщений</div>
      </div>
      <div class="item-check"></div>
    `;
    card.onclick = () => switchProfile(name);
    profilesList.appendChild(card);
  }

  // Models
  const modelDescriptions = {
    fast: "Llama 3.1 8B — быстрая",
    smart: "Llama 3.3 70B — умная",
    mixtral: "Mixtral 8x7B",
    gemma: "Gemma 9B",
  };
  const modelsList = document.getElementById("models-list");
  modelsList.innerHTML = "";
  for (const name of state.models || []) {
    const isActive = name === state.model;
    const card = document.createElement("div");
    card.className = "item-card" + (isActive ? " active" : "");
    card.innerHTML = `
      <div>
        <div class="item-name">${name}</div>
        <div class="item-meta">${modelDescriptions[name] || name}</div>
      </div>
      <div class="item-check"></div>
    `;
    card.onclick = () => switchModel(name);
    modelsList.appendChild(card);
  }
}

// === Actions ===

async function toggleAuto(enabled) {
  await api("/api/auto", "POST", { enabled });
  state.auto_reply = enabled;
  if (tg) tg.HapticFeedback?.impactOccurred("light");
}

async function toggleLearn(enabled) {
  await api("/api/learning", "POST", { enabled });
  state.learning = enabled;
  if (tg) tg.HapticFeedback?.impactOccurred("light");
}

async function switchProfile(name) {
  await api("/api/profile", "POST", { name });
  if (tg) tg.HapticFeedback?.impactOccurred("medium");
  await loadStatus();
}

async function switchModel(name) {
  await api("/api/model", "POST", { name });
  if (tg) tg.HapticFeedback?.impactOccurred("medium");
  await loadStatus();
}

async function createProfile(name) {
  await api("/api/newprofile", "POST", { name });
  if (tg) tg.HapticFeedback?.notificationOccurred("success");
  await loadStatus();
}

async function clearMemory() {
  if (tg) {
    tg.showConfirm("Очистить память текущего профиля?", async (ok) => {
      if (ok) {
        await api("/api/clear", "POST");
        tg.HapticFeedback?.notificationOccurred("warning");
        await loadStatus();
      }
    });
  } else {
    if (confirm("Очистить память текущего профиля?")) {
      await api("/api/clear", "POST");
      await loadStatus();
    }
  }
}

// === Events ===

document.getElementById("toggle-auto").addEventListener("change", (e) => {
  toggleAuto(e.target.checked);
});

document.getElementById("toggle-learn").addEventListener("change", (e) => {
  toggleLearn(e.target.checked);
});

document.getElementById("clear-btn").addEventListener("click", clearMemory);

// Modal
document.getElementById("add-profile-btn").addEventListener("click", () => {
  document.getElementById("modal").classList.add("show");
  document.getElementById("profile-input").value = "";
  document.getElementById("profile-input").focus();
});

document.getElementById("modal-cancel").addEventListener("click", () => {
  document.getElementById("modal").classList.remove("show");
});

document.getElementById("modal-create").addEventListener("click", async () => {
  const name = document.getElementById("profile-input").value.trim().toLowerCase();
  if (name) {
    await createProfile(name);
    document.getElementById("modal").classList.remove("show");
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
  document.getElementById("loading").innerHTML = `
    <div style="text-align:center;color:#888">
      <p>Не удалось подключиться к боту</p>
      <p style="font-size:12px;margin-top:8px">Проверь что бот запущен</p>
    </div>
  `;
});
