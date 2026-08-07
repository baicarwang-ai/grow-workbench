/* =========================================================================
 * 个人成长工作台 · 应用逻辑
 * 数据保存在浏览器 localStorage，导出/导入用于备份。
 * ========================================================================= */

/* ---------------- 工具 ---------------- */
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

function toISO(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function fromISO(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function todayStr() { return toISO(new Date()); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function mondayOf(d) { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return x; }
function fmtDate(d) { return (d.getMonth() + 1) + "月" + d.getDate() + "日"; }
function fmtWeekday(d) { return "周" + "日一二三四五六"[d.getDay()]; }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function timeHM(d) { return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
function minutesBetween(a, b) { return Math.round((b - a) / 60000); }

function recipeById(id) {
  return RECIPES.concat(state.customRecipes).find(r => r.id === id) || null;
}
function recipeImg(r) {
  return r.image || `img/recipes/${r.id}.svg`;
}
function recipeOptionsHtml(selected) {
  let h = `<option value="">— 选择菜谱 —</option>`;
  const all = RECIPES.concat(state.customRecipes);
  const cats = { breakfast: "早餐", lunch: "午餐", dinner: "晚餐", snack: "加餐" };
  for (const c of ["breakfast", "lunch", "dinner", "snack"]) {
    h += `<optgroup label="${cats[c]}">`;
    for (const r of all.filter(x => x.category === c)) {
      h += `<option value="${r.id}" ${r.id === selected ? "selected" : ""}>${esc(r.name)}（${r.nutrition.kcal}kcal）</option>`;
    }
    h += `</optgroup>`;
  }
  return h;
}

/* ---------------- 状态 ---------------- */
const STORE_KEY = "grow_workbench_v1";
let state = loadState();

function defaultState() {
  return {
    profile: { ...DEFAULT_PROFILE },
    sleep: {},        // date -> {bed, wake, dur, quality, note}
    water: {},        // date -> [ "HH:MM", ... ]
    sit: {},          // date -> count
    meals: {},        // date -> {breakfast:{recipeId,name,foodInfo,photo,note}, lunch, dinner, snack}
    workouts: [],     // [{id,date,focus,duration,rpe,source,exercises:[{name,sets,reps,weight}],note}]
    readings: [],     // [{id,date,book,minutes,pages,quote,thought}]
    books: [],        // 用户自建书目
    customRecipes: [],// 用户自建菜谱
    weightLog: [],    // [{date,weight,bodyFat,note}]
    settings: {
      waterReminder: false, waterInterval: 60, waterStart: "08:00", waterEnd: "21:30",
      sitReminder: false, sitInterval: 50,
      lastWater: 0, lastSit: 0,
      calorieGoal: 2000,
    },
    weeklyMenu: null,
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      const def = defaultState();
      return Object.assign(def, s, { settings: Object.assign(def.settings, s.settings || {}) });
    }
  } catch (e) { console.warn("读取数据失败", e); }
  return defaultState();
}
function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch (e) { console.error("保存失败（可能存储已满）", e); showToast("⚠️", "保存失败", "本地存储可能已满，请导出数据并清理旧照片。"); }
}

/* ---------------- 模态框 ---------------- */
function openModal(title, html) {
  $("#modal-title").textContent = title;
  $("#modal-body").innerHTML = html;
  $("#modal").classList.add("show");
  $("#modal-mask").classList.add("show");
  bindModalEvents();
}
function closeModal() {
  $("#modal").classList.remove("show");
  $("#modal-mask").classList.remove("show");
}
function bindModalEvents() {
  $("#modal-close").onclick = closeModal;
  $("#modal-mask").onclick = closeModal;
}

/* ---------------- Toast 与系统通知 ---------------- */
function hideToast(t) {
  t.classList.remove("show");
  clearTimeout(t._timer);
}
/* showToast(icon, title, msg, ms, btn)
   btn = { label, onClick } 可选操作按钮；弹窗自带 ✕ 手动关闭。
   自动关闭 = JS setTimeout 兜底 + CSS 动画（挂在 .show 上，--toast-ms 控制时长）双保险，
   iOS Safari 定时器节流时由 CSS 动画保证准时收起。 */
function showToast(icon, title, msg, ms = 6000, btn = null) {
  const t = $("#toast");
  t.style.setProperty("--toast-ms", ms + "ms");
  t.innerHTML = `<span class="t-icon">${icon}</span>
    <div class="t-body">
      <div class="t-title">${esc(title)}</div>
      <div class="t-msg">${esc(msg)}</div>
      ${btn ? `<button class="t-btn" type="button">${esc(btn.label)}</button>` : ""}
    </div>
    <button class="t-close" type="button" aria-label="关闭">✕</button>
    <span class="t-progress"></span>`;
  // 重启自动关闭动画：先移除 .show（取消旧动画/填充态）→ 强制回流 → 重新显示（动画从头计时）
  t.classList.remove("show");
  void t.offsetWidth;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => hideToast(t), ms);
  t.querySelector(".t-close").onclick = (e) => { e.stopPropagation(); hideToast(t); };
  if (btn) {
    t.querySelector(".t-btn").onclick = (e) => {
      e.stopPropagation(); hideToast(t);
      try { btn.onClick(); } catch (err) { console.error(err); }
    };
  }
}
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880; g.gain.value = 0.08;
    o.start(); o.stop(ctx.currentTime + 0.35);
  } catch (e) { /* noop */ }
}
function notify(icon, title, msg, btn = null, ms = 15000) {
  if ("Notification" in window && Notification.permission === "granted") {
    try { new Notification(title, { body: msg, icon: undefined }); } catch (e) {}
  }
  showToast(icon, title, msg, ms, btn);
  beep();
}
function requestNotifyPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

/* ---------------- 提醒引擎（每 30 秒检查） ---------------- */
function checkReminders() {
  const s = state.settings;
  const now = new Date();
  const hm = timeHM(now);
  if (s.waterReminder && hm >= s.waterStart && hm <= s.waterEnd) {
    if (now.getTime() - s.lastWater > s.waterInterval * 60000) {
      s.lastWater = now.getTime(); saveState();
      const today = todayStr();
      const got = (state.water[today] || []).length * 250;
      notify("💧", "该喝水啦", `已喝 ${got}ml / 目标 ${state.profile.waterTargetMl}ml。喝完后点「喝完了」就好。`,
        { label: "💧 喝完了", onClick: function () { addWater(); } });
    }
  }
  if (s.sitReminder) {
    if (now.getTime() - s.lastSit > s.sitInterval * 60000) {
      s.lastSit = now.getTime(); saveState();
      notify("🧘", "久坐提醒", "已坐了一段时间，起身活动 2–3 分钟。活动完点「已活动」就好。",
        { label: "🧘 已活动", onClick: function () { logSit(); } });
    }
  }
}
setInterval(checkReminders, 30000);

/* ---------------- 顶部快速统计 ---------------- */
function renderQuickStats() {
  const t = todayStr();
  const water = (state.water[t] || []).length * 250;
  const sl = state.sleep[t];
  const wkStart = toISO(mondayOf(new Date()));
  const wkEnd = toISO(addDays(fromISO(wkStart), 6));
  const wkWorkouts = state.workouts.filter(w => w.date >= wkStart && w.date <= wkEnd).length;
  const readToday = state.readings.filter(r => r.date === t).reduce((a, r) => a + (r.minutes || 0), 0);
  $("#quick-stats").innerHTML = `
    <div class="quick-stat"><b>${water}<small style="font-size:12px">ml</small></b><span>今日饮水</span></div>
    <div class="quick-stat"><b>${sl ? sl.dur.toFixed(1) : "--"}</b><span>昨晚睡眠 h</span></div>
    <div class="quick-stat"><b>${state.profile.weightKg}<small style="font-size:12px">kg</small></b><span>当前体重</span></div>
    <div class="quick-stat"><b>${wkWorkouts}</b><span>本周训练</span></div>
    <div class="quick-stat"><b>${readToday}<small style="font-size:12px">min</small></b><span>今日阅读</span></div>`;
}

/* ---------------- 科学依据 ---------------- */
function renderScienceBanner() {
  $("#science-banner-items").innerHTML = SCIENCE.slice(0, 4).map(s =>
    `<div class="banner-item"><b>${esc(s.title)}</b><br>${esc(s.detail.length > 55 ? s.detail.slice(0, 55) + "…" : s.detail)}</div>`).join("");
}

/* ---------------- 通用日历 ---------------- */
function renderCalendar(container, monthDate, dayInfo, onClick) {
  const y = monthDate.getFullYear(), m = monthDate.getMonth();
  const first = new Date(y, m, 1);
  const startOffset = (first.getDay() + 6) % 7; // 周一为 0
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = todayStr();
  let html = `<div class="cal-dow">一</div><div class="cal-dow">二</div><div class="cal-dow">三</div><div class="cal-dow">四</div><div class="cal-dow">五</div><div class="cal-dow">六</div><div class="cal-dow">日</div>`;
  for (let i = 0; i < startOffset; i++) html += `<div class="cal-day empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(y, m, d);
    const iso = toISO(date);
    const info = dayInfo(iso);
    const cls = ["cal-day", iso === today ? "today" : "", info ? info.cls : ""].join(" ");
    html += `<div class="${cls}" data-date="${iso}" title="${info ? info.tip : ""}">${d}${info && info.dot ? `<span class="dot">${info.dot}</span>` : ""}</div>`;
  }
  container.innerHTML = html;
  container.querySelectorAll(".cal-day[data-date]").forEach(el => {
    el.onclick = () => onClick(el.dataset.date);
  });
}

/* ================= 第一栏：作息与健康 ================= */
let sleepCalDate = new Date();

function renderSleep() {
  $("#sleep-cal-title").textContent = `${sleepCalDate.getFullYear()}年${sleepCalDate.getMonth() + 1}月`;
  const today = todayStr();
  const last = state.sleep[today];
  const wkStart = toISO(mondayOf(new Date()));
  const wkSleep = [];
  for (let i = 0; i < 7; i++) {
    const r = state.sleep[toISO(addDays(fromISO(wkStart), i))];
    if (r) wkSleep.push(r.dur);
  }
  $("#sleep-last").textContent = last ? last.dur.toFixed(1) + " h" : "—";
  $("#sleep-avg").textContent = wkSleep.length ? (wkSleep.reduce((a, b) => a + b, 0) / wkSleep.length).toFixed(1) + " h" : "—";
  $("#sleep-goal").textContent = "7–9 h";
  renderCalendar($("#sleep-cal"), sleepCalDate, (iso) => {
    const r = state.sleep[iso];
    if (!r) return { cls: "", dot: "", tip: "" };
    const cls = r.dur >= 7 ? "good" : r.dur >= 6 ? "mid" : "bad";
    return { cls, dot: "🌙", tip: `${r.dur.toFixed(1)}h ${r.bed}→${r.wake}` };
  }, (iso) => openSleepModal(iso));
}

function openSleepModal(dateStr) {
  const r = state.sleep[dateStr] || { bed: "23:30", wake: "07:00", dur: 7.5, quality: 3, note: "" };
  openModal(`记录睡眠 · ${fmtDate(fromISO(dateStr))}`, `
    <div class="form-row">
      <div class="field"><label>入睡时间</label><input type="time" id="sl-bed" value="${r.bed}"></div>
      <div class="field"><label>起床时间</label><input type="time" id="sl-wake" value="${r.wake}"></div>
    </div>
    <div class="form-row3">
      <div class="field"><label>睡眠时长（小时，自动算也可手填）</label><input type="number" step="0.1" id="sl-dur" value="${r.dur}"></div>
      <div class="field"><label>睡眠质量 1-5</label><input type="number" min="1" max="5" id="sl-quality" value="${r.quality}"></div>
    </div>
    <div class="field"><label>备注</label><textarea id="sl-note" rows="2">${esc(r.note || "")}</textarea></div>
    <div class="modal-actions">
      <button class="neu-btn primary" id="sl-save">保存</button>
      ${state.sleep[dateStr] ? `<button class="neu-btn" id="sl-del">删除</button>` : ""}
    </div>`);
  const bed = $("#sl-bed"), wake = $("#sl-wake"), dur = $("#sl-dur");
  const calc = () => {
    const [bh, bm] = bed.value.split(":").map(Number);
    const [wh, wm] = wake.value.split(":").map(Number);
    let mins = (wh * 60 + wm) - (bh * 60 + bm);
    if (mins < 0) mins += 1440;
    dur.value = (mins / 60).toFixed(1);
  };
  bed.onchange = calc; wake.onchange = calc;
  $("#sl-save").onclick = () => {
    state.sleep[dateStr] = {
      bed: bed.value, wake: wake.value,
      dur: parseFloat(dur.value) || 0,
      quality: parseInt($("#sl-quality").value) || 3,
      note: $("#sl-note").value.trim(),
    };
    saveState(); closeModal(); renderAll();
    showToast("🌙", "睡眠已记录", "坚持规律作息，减脂效果会更好。");
  };
  const del = $("#sl-del");
  if (del) del.onclick = () => { delete state.sleep[dateStr]; saveState(); closeModal(); renderAll(); };
}

/* ---- 饮水 ---- */
function renderWater() {
  const t = todayStr();
  const cups = state.water[t] || [];
  const ml = cups.length * 250;
  const target = state.profile.waterTargetMl;
  const pct = Math.min(100, Math.round(ml / target * 100));
  $("#water-num").textContent = ml;
  $("#water-percent").textContent = pct + "%";
  $("#water-target").textContent = target;
  $("#water-cups").textContent = cups.length;
  $("#water-ring").style.background = pct >= 100
    ? "radial-gradient(circle at 30% 25%, #fff, transparent 60%), linear-gradient(145deg,#6fc79b,#5fae84)"
    : "radial-gradient(circle at 30% 25%, #fff, transparent 60%), linear-gradient(145deg,var(--blue-soft),#cfe0fb)";
  const last = cups.slice(-12).reverse();
  $("#water-timeline").innerHTML = last.length
    ? last.map(c => `<div class="water-drop" title="${c}">💧</div>`).join("")
    : `<span class="muted">今天还没喝水，来一杯吧～</span>`;
  $("#water-reminder").checked = state.settings.waterReminder;
  $("#water-interval").value = state.settings.waterInterval;
  $("#water-start").value = state.settings.waterStart;
  $("#water-end").value = state.settings.waterEnd;
}

function addWater() {
  const t = todayStr();
  if (!state.water[t]) state.water[t] = [];
  state.water[t].push(timeHM(new Date()));
  state.settings.lastWater = Date.now(); // 刚喝过水，重置提醒计时
  saveState(); renderAll();
  const target = state.profile.waterTargetMl;
  const ml = state.water[t].length * 250;
  if (ml >= target) showToast("🎉", "今日饮水目标达成！", `已喝 ${ml}ml ≥ ${target}ml，继续保持。`);
  else showToast("💧", "已记录一杯", `今日 ${ml}ml / ${target}ml，还差 ${target - ml}ml。`);
}
function undoWater() {
  const t = todayStr();
  if (state.water[t] && state.water[t].length) { state.water[t].pop(); saveState(); renderAll(); }
}

/* ---- 久坐 ---- */
function renderSit() {
  const t = todayStr();
  $("#sit-count").textContent = state.sit[t] || 0;
  $("#sit-reminder").checked = state.settings.sitReminder;
  $("#sit-interval").value = state.settings.sitInterval;
  $("#sit-interval-label").textContent = state.settings.sitInterval;
}
function logSit() {
  const t = todayStr();
  state.sit[t] = (state.sit[t] || 0) + 1;
  state.settings.lastSit = Date.now(); // 刚活动过，重置提醒计时
  saveState(); renderSit(); renderQuickStats();
  showToast("🧘", "干得漂亮", "起身活动能让身体更轻松。");
}

/* ================= 第二栏：饮食 ================= */
let selectedDietDate = todayStr();

function getWeekMenu() {
  const monday = mondayOf(new Date());
  const key = toISO(monday);
  if (state.weeklyMenu && state.weeklyMenu.weekStart === key) return state.weeklyMenu;
  const epoch = new Date(2026, 7, 3); // 2026-08-03 周一
  const weeks = Math.max(0, Math.round((monday - epoch) / 86400000 / 7));
  const b = RECIPES.filter(r => r.category === "breakfast");
  const l = RECIPES.filter(r => r.category === "lunch");
  const d = RECIPES.filter(r => r.category === "dinner");
  const days = {};
  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
    const ds = toISO(date);
    let bi = b[(weeks * 3 + i) % b.length].id;
    let li = l[(weeks * 2 + i) % l.length].id;
    let di = d[(weeks + i) % d.length].id;
    if (li === di) di = d[(weeks + i + 3) % d.length].id; // 避免午晚餐重复
    days[ds] = { breakfast: bi, lunch: li, dinner: di };
  }
  state.weeklyMenu = { weekStart: key, days };
  saveState();
  return state.weeklyMenu;
}

function renderWeekMenu() {
  const menu = getWeekMenu();
  const today = todayStr();
  $("#week-title").textContent = `本周菜谱（${fmtDate(mondayOf(new Date()))} 起 · 自动轮换）`;
  let html = "";
  for (let i = 0; i < 7; i++) {
    const date = addDays(mondayOf(new Date()), i);
    const ds = toISO(date);
    const day = menu.days[ds];
    const isToday = ds === today;
    let kcal = 0;
    const lines = [];
    for (const [slot, tag, label] of [["breakfast", "breakfast", "早餐"], ["lunch", "lunch", "午餐"], ["dinner", "dinner", "晚餐"]]) {
      const r = recipeById(day[slot]);
      if (!r) continue;
      kcal += r.nutrition.kcal;
      lines.push(`<div class="meal-line"><span class="meal-tag ${tag}">${label}</span><span class="meal-name" data-recipe="${r.id}">${esc(r.name)}</span><span class="meal-nut">${r.nutrition.kcal}kcal · P${r.nutrition.protein}g</span></div>`);
    }
    html += `<div class="week-day ${isToday ? "today" : ""}">
      <div class="week-day-head"><span>${fmtDate(date)} ${fmtWeekday(date)}${isToday ? " · 今天" : ""}</span><span class="muted">约 ${kcal}kcal</span></div>
      <div class="week-day-meals">${lines.join("")}</div>
    </div>`;
  }
  $("#week-menu").innerHTML = html;
  $("#week-menu").querySelectorAll(".meal-name").forEach(el => {
    el.onclick = () => openRecipeModal(el.dataset.recipe);
  });
}

/* ---- 菜谱库 ---- */
let recipeFilter = "all";
let recipeSearch = "";

function renderRecipeChips() {
  const cats = [["all", "全部"], ["breakfast", "早餐"], ["lunch", "午餐"], ["dinner", "晚餐"], ["snack", "加餐"]];
  $("#recipe-chips").innerHTML = cats.map(([v, t]) =>
    `<button class="chip ${recipeFilter === v ? "active" : ""}" data-cat="${v}">${t}</button>`).join("") +
    `<button class="chip ${recipeFilter === "high" ? "active" : ""}" data-cat="high">高蛋白</button>`;
  $("#recipe-chips").querySelectorAll(".chip").forEach(el => {
    el.onclick = () => {
      recipeFilter = el.dataset.cat;
      renderRecipeChips(); renderRecipeGrid();
    };
  });
}

function renderRecipeGrid() {
  const q = recipeSearch.trim().toLowerCase();
  let list = RECIPES.concat(state.customRecipes);
  if (recipeFilter !== "all") {
    if (recipeFilter === "high") list = list.filter(r => r.nutrition.protein >= 30);
    else list = list.filter(r => r.category === recipeFilter);
  }
  if (q) {
    list = list.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.tags.some(t => t.toLowerCase().includes(q)) ||
      r.ingredients.some(i => i.toLowerCase().includes(q)) ||
      (r.category === "breakfast" ? "早餐" : r.category === "lunch" ? "午餐" : r.category === "dinner" ? "晚餐" : "加餐").includes(q)
    );
  }
  $("#recipe-grid").innerHTML = list.length ? list.map(r => {
        const img = `<img src="${recipeImg(r)}" alt="${esc(r.name)}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'img-ph',textContent:'${r.emoji}'}))">`;
    const catLabel = r.category === "breakfast" ? "早餐" : r.category === "lunch" ? "午餐" : r.category === "dinner" ? "晚餐" : "加餐";
    return `<div class="recipe-card" data-recipe="${r.id}">
      ${img}
      <div class="rc-body">
        <h4>${esc(r.name)}</h4>
        <div class="rc-meta"><span>⏱ ${r.time}</span><span>🔥 ${r.nutrition.kcal}kcal</span><span>💪 ${r.nutrition.protein}g</span></div>
        <div class="rc-tags"><span class="mini-tag o">${catLabel}</span>${r.tags.slice(0, 2).map(t => `<span class="mini-tag g">${esc(t)}</span>`).join("")}</div>
      </div>
    </div>`;
  }).join("") : `<div class="empty">没有找到匹配的菜谱，换个关键词试试，或让我帮你生成。</div>`;
  $("#recipe-grid").querySelectorAll(".recipe-card").forEach(el => {
    el.onclick = () => openRecipeModal(el.dataset.recipe);
  });
}

function openRecipeModal(id) {
  const r = recipeById(id);
  if (!r) return;
    const img = `<img class="dish" src="${recipeImg(r)}" alt="${esc(r.name)}" onerror="this.remove()">`;
  const n = r.nutrition;
  openModal(r.name, `
    ${img}
    <div class="nut-grid">
      <div class="nut-cell"><b>${n.kcal}</b><span>热量 kcal</span></div>
      <div class="nut-cell"><b>${n.protein}g</b><span>蛋白质</span></div>
      <div class="nut-cell"><b>${n.carbs}g</b><span>碳水</span></div>
      <div class="nut-cell"><b>${n.fat}g</b><span>脂肪</span></div>
    </div>
    <p class="muted">膳食纤维 ${n.fiber}g · ${r.time} · ${r.difficulty} · ${r.servings}人份 · 营养为估算值</p>
    <h4>🥬 食材</h4>
    <ul>${r.ingredients.map(i => `<li>${esc(i)}</li>`).join("")}</ul>
    <h4>👨‍🍳 烹饪步骤</h4>
    <ol>${r.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>
    <p class="muted">标签：${r.tags.map(esc).join(" · ")}　|　来源：${esc(r.source)}</p>
    <div class="modal-actions">
      <button class="neu-btn primary" data-close>好的，今天吃它</button>
    </div>`);
  $("#modal-body").querySelector("[data-close]").onclick = closeModal;
}

/* ---- 饮食日历与三餐记录 ---- */
function renderDietCalendar() {
  $("#diet-cal-title").textContent = `${selectedDietDate.slice(0, 4)}年${parseInt(selectedDietDate.slice(5, 7))}月`;
  const monthDate = fromISO(selectedDietDate);
  renderCalendar($("#diet-cal"), monthDate, (iso) => {
    const m = state.meals[iso];
    const n = m ? Object.values(m).filter(x => x && (x.recipeId || x.name || x.photo || x.foodInfo)).length : 0;
    return n ? { cls: "has-data", dot: "🍽".repeat(Math.min(n, 3)), tip: `已记录 ${n} 餐` } : { cls: "", dot: "", tip: "" };
  }, (iso) => { selectedDietDate = iso; renderDietCalendar(); renderMealDay(); });
}

function renderMealDay() {
  const ds = selectedDietDate;
  const m = state.meals[ds] || {};
  $("#meal-day-title").textContent = `${fmtDate(fromISO(ds))} ${fmtWeekday(fromISO(ds))} · 三餐记录`;
  const slots = [
    ["breakfast", "早餐"], ["lunch", "午餐"], ["dinner", "晚餐"], ["snack", "加餐"],
  ];
  let html = "";
  for (const [slot, label] of slots) {
    const rec = m[slot];
    const cls = slot === "breakfast" ? "breakfast" : slot === "lunch" ? "lunch" : slot === "dinner" ? "dinner" : "snack";
    if (rec && (rec.recipeId || rec.name || rec.photo || rec.foodInfo)) {
      const r = rec.recipeId ? recipeById(rec.recipeId) : null;
      const name = r ? r.name : rec.name || "自定义";
      const kcal = r ? r.nutrition.kcal + " kcal" : (rec.calories ? rec.calories + " kcal" : (rec.foodInfo ? "待估算" : ""));
      html += `<div class="meal-slot">
        <span class="meal-tag ${cls}">${label}</span>
        <div class="slot-body">
          <b>${esc(name)}</b> <span class="muted">${kcal}</span>
          ${rec.photo ? `<br><img class="meal-photo" src="${rec.photo}" alt="餐照">` : ""}
          ${rec.foodInfo ? `<div class="muted">📝 ${esc(rec.foodInfo)}</div>` : ""}
          ${rec.note ? `<div class="muted">${esc(rec.note)}</div>` : ""}
        </div>
        <div class="slot-actions">
          <button class="slot-btn photo" data-edit="${slot}">记录/编辑</button>
          <button class="slot-btn delete" data-del="${slot}">✕</button>
        </div>
      </div>`;
    } else {
      html += `<div class="meal-slot">
        <span class="meal-tag ${cls}">${label}</span>
        <div class="slot-body"><span class="muted">未记录</span></div>
        <div class="slot-actions"><button class="slot-btn photo" data-edit="${slot}">＋ 记录</button></div>
      </div>`;
    }
  }
  $("#meal-day-body").innerHTML = html || `<div class="empty">当天没有记录</div>`;
  $("#meal-day-body").querySelectorAll("[data-edit]").forEach(el => {
    el.onclick = () => openMealModal(ds, el.dataset.edit);
  });
  $("#meal-day-body").querySelectorAll("[data-del]").forEach(el => {
    el.onclick = () => { delete state.meals[ds][el.dataset.del]; saveState(); renderAll(); };
  });
}

function openMealModal(ds, slot) {
  const rec = (state.meals[ds] || {})[slot] || {};
  const label = slot === "breakfast" ? "早餐" : slot === "lunch" ? "午餐" : slot === "dinner" ? "晚餐" : "加餐";
  openModal(`记录${label} · ${fmtDate(fromISO(ds))}`, `
    <div class="field"><label>选择菜谱（也可选「自定义」直接写）</label>
      <select id="meal-recipe">${recipeOptionsHtml(rec.recipeId || "")}<option value="__custom">✍️ 自定义</option></select>
    </div>
    <div class="field" id="meal-custom-wrap" style="display:${rec.recipeId ? "none" : "block"}">
      <label>自定义菜名 / 描述</label>
      <input id="meal-custom" value="${esc(rec.name || "")}" placeholder="例如：妈妈做的红烧鸡腿">
    </div>
    <div class="field"><label>食物信息 / 营养备注（可填你告诉我的热量蛋白质等）</label>
      <textarea id="meal-info" rows="2" placeholder="例如：鸡胸150g+糙米200g，约520kcal，蛋白45g">${esc(rec.foodInfo || "")}</textarea>
    </div>
    <div class="field"><label>热量 kcal（选菜谱自动带出；自定义餐可手填或用「智能菜谱→热量估算器」）</label>
      <input id="meal-cal" type="number" min="0" step="1" placeholder="如 520" value="${rec.calories || ""}">
    </div>
    <div class="field"><label>餐前照片（先拍照发我分析，也可以在这里上传存档）</label>
      <input type="file" id="meal-photo-input" accept="image/*" style="box-shadow:none;padding:0">
      <div id="meal-photo-preview">${rec.photo ? `<img src="${rec.photo}" style="max-width:160px;border-radius:14px;margin-top:8px;box-shadow:3px 3px 10px rgba(0,0,0,.15)">` : ""}</div>
    </div>
    <div class="field"><label>备注（心情/饱腹感等）</label><textarea id="meal-note" rows="2">${esc(rec.note || "")}</textarea></div>
    <div class="modal-actions">
      <button class="neu-btn primary" id="meal-save">保存</button>
      <button class="neu-btn" id="meal-clear">清空该餐</button>
    </div>
    <p class="muted">💡 正确姿势：吃饭前先拍照发到 Codex 对话里，我会帮你分析营养并给建议；这张照片也可上传到这里存档。</p>`);
  const recipeSel = $("#meal-recipe");
  const customWrap = $("#meal-custom-wrap");
  const calInput = $("#meal-cal");
  recipeSel.onchange = () => {
    customWrap.style.display = recipeSel.value === "__custom" ? "block" : "none";
    // 选中菜谱时自动带出该菜谱热量
    if (recipeSel.value && recipeSel.value !== "__custom") {
      const r = recipeById(recipeSel.value);
      if (r && r.nutrition) calInput.value = r.nutrition.kcal;
    }
  };
  let photoData = rec.photo || null;
  // 食物信息输入完（失焦）自动估算热量并填入，无需手动算
  const infoEl = $("#meal-info");
  infoEl.addEventListener("blur", () => {
    const txt = infoEl.value.trim();
    if (!txt) return;
    const res = estimateCalories(txt);
    if (res.items.length) {
      calInput.value = res.total;
      showToast("🔥", "已估算热量", `约 ${res.total} kcal${res.unknown.length ? "，部分食物未收录已忽略" : ""}。可手动修正数值。`);
    } else if (res.unknown.length) {
      showToast("🍳", "无法估算", "这些食物不在热量库里，可直接发我对话里帮你估算。");
    }
  });
  $("#meal-photo-input").onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = 720;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        photoData = canvas.toDataURL("image/jpeg", 0.72);
        $("#meal-photo-preview").innerHTML = `<img src="${photoData}" style="max-width:160px;border-radius:14px;margin-top:8px;box-shadow:3px 3px 10px rgba(0,0,0,.15)">`;
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(f);
  };
  $("#meal-save").onclick = () => {
    if (!state.meals[ds]) state.meals[ds] = {};
    const recipeId = recipeSel.value !== "__custom" ? recipeSel.value : "";
    const r = recipeId ? recipeById(recipeId) : null;
    state.meals[ds][slot] = {
      recipeId,
      name: recipeSel.value === "__custom" ? $("#meal-custom").value.trim() : "",
      foodInfo: $("#meal-info").value.trim(),
      calories: r && r.nutrition ? r.nutrition.kcal : (parseInt(calInput.value, 10) || 0),
      photo: photoData,
      note: $("#meal-note").value.trim(),
    };
    saveState(); closeModal(); renderAll();
    showToast("🍽️", "三餐已记录", "坚持记录，才能看清自己的饮食。");
  };
  $("#meal-clear").onclick = () => {
    if (state.meals[ds]) delete state.meals[ds][slot];
    saveState(); closeModal(); renderAll();
  };
}

/* ---- 热量估算（基于常见食物热量库） ---- */
function estimateCalories(text) {
  const items = [];
  const unknown = [];
  const parts = String(text || "").split(/[,，、;；+＋\n\s]+/).filter(Boolean);
  for (const part of parts) {
    const m = part.match(/(\d+(?:\.\d+)?)\s*(g|克|kg|公斤|毫升|ml)/i);
    let grams = 100, namePart = part.trim();
    if (m) {
      const q = parseFloat(m[1]);
      const unit = m[2].toLowerCase();
      grams = (unit === "kg" || unit === "公斤") ? q * 1000 : q;
      namePart = part.slice(0, m.index).trim();
    }
    if (!namePart) continue;
    const f = FOOD_CALORIES.find(x =>
      namePart.includes(x[0]) || x[0].includes(namePart) ||
      (x[2] || []).some(a => namePart.includes(a)));
    if (f) items.push({ name: namePart, grams: Math.round(grams), kcal: Math.round(grams / 100 * f[1]), per100: f[1] });
    else unknown.push(namePart + (m ? ` ${m[1]}${m[2]}` : ""));
  }
  return { items, total: items.reduce((a, b) => a + b.kcal, 0), unknown };
}
function renderCalEstimate(text) {
  const box = $("#cal-results");
  if (!box) return;
  if (!text) { box.innerHTML = ""; return; }
  const res = estimateCalories(text);
  const rows = res.items.map(it =>
    `<div class="cal-item"><span>${esc(it.name)}</span><span class="muted">${it.grams}g</span><b>${it.kcal} kcal</b></div>`).join("");
  const unknownHtml = res.unknown.length
    ? `<div class="cal-unknown">未收录：${res.unknown.map(esc).join("、")}（可留言让我补充）</div>` : "";
  box.innerHTML = `<div class="cal-total">🔥 估算总热量 <b>${res.total}</b> kcal <small>${res.items.length ? "（目标 " + state.settings.calorieGoal + " kcal）" : ""}</small></div>
    ${rows}${unknownHtml}`;
}

/* ---- 每日热量摄入图表（近 7 天） ---- */
function dayCalories(iso) {
  const m = state.meals[iso] || {};
  let total = 0;
  for (const slot of ["breakfast", "lunch", "dinner", "snack"]) {
    const rec = m[slot];
    if (!rec) continue;
    if (rec.recipeId) { const r = recipeById(rec.recipeId); if (r && r.nutrition) total += r.nutrition.kcal; }
    else total += (rec.calories || 0);
  }
  return total;
}
function renderCalorieChart() {
  const el = $("#calorie-chart");
  if (!el) return;
  const goal = state.settings.calorieGoal || 2000;
  const today = todayStr();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const iso = toISO(addDays(fromISO(today), -i));
    days.push({ iso, label: i === 0 ? "今天" : fmtWeekday(fromISO(iso)), total: dayCalories(iso), isToday: i === 0 });
  }
  const maxV = Math.max(goal * 1.15, ...days.map(d => d.total), 100);
  const W = 340, H = 192, padT = 20, padB = 24, padL = 4, padR = 4;
  const plotH = H - padT - padB;
  const bw = (W - padL - padR) / 7;
  const bars = days.map((d, i) => {
    const h = Math.max(3, Math.round(d.total / maxV * plotH));
    const x = padL + i * bw + bw * 0.16;
    const y = padT + plotH - h;
    const over = d.total > goal;
    const fill = over ? "url(#gOver)" : (d.total > 0 ? "url(#gOk)" : "#d5dbe4");
    const txt = d.total > 0 ? String(d.total) : "";
    return `<rect x="${x}" y="${y}" width="${bw * 0.68}" height="${h}" rx="5" fill="${fill}"/>
      <text x="${x + bw * 0.34}" y="${y - 5}" text-anchor="middle" font-size="10" font-weight="800" fill="${over ? "#b96f35" : (d.total > 0 ? "#3d7a5b" : "#aab2bf")}">${txt}</text>
      <text x="${x + bw * 0.34}" y="${H - 7}" text-anchor="middle" font-size="10" font-weight="${d.isToday ? 800 : 600}" fill="${d.isToday ? "#3c6ec0" : "#7b8494"}">${d.label}</text>`;
  });
  const goalY = padT + plotH - Math.round(goal / maxV * plotH);
  const sum = days.reduce((a, d) => a + d.total, 0);
  const avg = Math.round(sum / 7);
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;max-width:460px;margin:0 auto">
    <defs>
      <linearGradient id="gOk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fc79b"/><stop offset="1" stop-color="#5fae84"/></linearGradient>
      <linearGradient id="gOver" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0b37c"/><stop offset="1" stop-color="#e79a5e"/></linearGradient>
    </defs>
    ${bars.join("")}
    <line x1="${padL}" y1="${goalY}" x2="${W - padR}" y2="${goalY}" stroke="#e79a5e" stroke-width="1.4" stroke-dasharray="4 3"/>
    <text x="${W - padR}" y="${goalY - 5}" text-anchor="end" font-size="9.5" font-weight="700" fill="#b96f35">目标 ${goal}</text>
  </svg>
  <div class="cal-chart-sum">近 7 天日均 <b>${avg}</b> kcal · 今日 <b>${days[6].total}</b> kcal${days[6].total > goal ? "（已超目标）" : ""}</div>`;
}

/* ---- 智能菜谱 ---- */
function smartGenerate() {
  const raw = $("#smart-input").value.trim();
  if (!raw) { showToast("🍳", "请输入食材", "把冰箱里的食材告诉我～"); return; }
  const lower = raw.toLowerCase();
  const scored = RECIPES.concat(state.customRecipes).map(r => {
    let hit = 0;
    const matched = [];
    for (const ing of r.ingredients) {
      const key = ing.split(" ")[0];
      const words = INGREDIENT_KEYWORDS[key] || [key.toLowerCase()];
      if (words.some(w => lower.includes(w))) { hit++; matched.push(ing); }
    }
    return { r, hit, total: r.ingredients.length, matched, score: hit / r.ingredients.length };
  }).filter(x => x.hit >= 1).sort((a, b) => b.score - a.score || b.hit - a.hit);

  // 附加热量估算：无论输入食材是否匹配到菜谱，都给出这批食材的热量估算
  let calHtml = "";
  {
    const cal = estimateCalories(raw);
    if (cal.items.length) {
      calHtml = `<div class="smart-result" style="background:linear-gradient(135deg,var(--blue-soft),#cfe0fb)">
        <h4>🔥 这批食材热量估算 <span class="match">约 ${cal.total} kcal</span></h4>
        <div class="muted">${cal.items.map(i => `${esc(i.name)} ${i.grams}g → ${i.kcal}kcal`).join(" · ")}</div>
        ${cal.unknown.length ? `<div class="missing">未收录：${cal.unknown.map(esc).join("、")}（可发我对话里帮你补）</div>` : ""}
        <div class="hint">💡 全部食材可在「热量估算器」里算；这一餐做好后，在饮食日历记录时输入食物名会自动带出热量。</div>
      </div>`;
    }
  }
  let html = calHtml;
  if (!scored.length) {
    html += `<div class="empty">没有匹配到现有菜谱。试试「鸡胸、鸡蛋、糙米、番茄」等常见食材，或者直接把食材拍照发我，我帮你现场设计。</div>`;
  } else {
    const top = scored.slice(0, 5);
    html = `<h4 style="margin:14px 0 8px">为你匹配到 ${scored.length} 个可做菜谱：</h4>` + top.map(x => {
      const missing = x.r.ingredients.filter(ig => !x.matched.includes(ig));
      return `<div class="smart-result">
        <h4>${esc(x.r.name)} <span class="match">匹配 ${x.matched.length}/${x.total}</span></h4>
        <div class="muted">可用：${x.matched.map(esc).join("、")}</div>
        ${missing.length ? `<div class="missing">还差：${missing.map(esc).join("、")}</div>` : `<div class="match">🎉 食材齐全，直接做！</div>`}
        <button class="slot-btn photo" data-recipe="${x.r.id}" style="margin-top:8px">查看做法与营养</button>
      </div>`;
    }).join("");
  }
  $("#smart-results").innerHTML = html;
  $("#smart-results").querySelectorAll("[data-recipe]").forEach(el => {
    el.onclick = () => openRecipeModal(el.dataset.recipe);
  });
}

/* ================= 第三栏：健身 ================= */
function renderPlan() {
  const today = todayStr();
  const menu = getWeekMenu(); // 确保周菜单存在（与饮食周一起）
  const html = WEEKLY_PLAN_TEMPLATE.map(p => {
    const date = addDays(mondayOf(new Date()), p.day - 1);
    const ds = toISO(date);
    const isToday = ds === today;
    const done = state.workouts.some(w => w.date === ds);
    return `<div class="plan-day ${isToday ? "today" : ""} ${done ? "done" : ""}" data-plan="${p.day}">
      <div class="plan-day-head"><span>${p.label} · ${p.focus}</span><span>${done ? "✅ 已练" : isToday ? "今日" : ""}</span></div>
      <div class="detail">${esc(p.detail)}</div>
    </div>`;
  }).join("");
  $("#plan-grid").innerHTML = html;
  $("#plan-grid").querySelectorAll(".plan-day").forEach(el => {
    el.onclick = () => openPlanModal(parseInt(el.dataset.plan));
  });
  const wkStart = toISO(mondayOf(new Date()));
  const wkEnd = toISO(addDays(fromISO(wkStart), 6));
  const wk = state.workouts.filter(w => w.date >= wkStart && w.date <= wkEnd).length;
  $("#stat-weight").textContent = state.profile.weightKg + "kg";
  $("#stat-target").textContent = state.profile.targetWeightKg + "kg";
  $("#stat-weekly").textContent = wk + "/5";
  // 连续周数：最近 4 周每周都有 ≥4 次训练
  let streak = 0;
  for (let w = 0; w < 8; w++) {
    const s = toISO(addDays(mondayOf(new Date()), -w * 7));
    const e = toISO(addDays(fromISO(s), 6));
    const c = state.workouts.filter(x => x.date >= s && x.date <= e).length;
    if (c >= 4) streak++; else break;
  }
  $("#stat-streak").textContent = streak + " 周";
}

function openPlanModal(dayNum) {
  const p = WEEKLY_PLAN_TEMPLATE.find(x => x.day === dayNum);
  if (!p) return;
  const exs = p.exercises.map(id => {
    const e = EXERCISES.find(x => x.id === id);
    return e ? `<li><a class="link-btn" data-ex="${e.id}" style="font-size:14px">${esc(e.name)}</a> <span class="muted">（${e.reps}，组间休息 ${e.rest}）</span></li>` : "";
  }).join("");
  openModal(`${p.label} · ${p.focus}`, `
    <p class="muted">目标：${esc(p.detail)}</p>
    <h4>动作清单（点击查看动作解析与视频）</h4>
    <ul>${exs || "<li>休息/恢复日，无需力量训练</li>"}</ul>
    <h4>训练要点</h4>
    <ul>
      <li>每次训练前热身 5–10 分钟：弹力带肩外旋、靠墙天使、快走。</li>
      <li>新手重量选择：最后 2–3 次还有余力（2–3 RIR），动作标准第一。</li>
      <li>组间休息：复合动作 90–120 秒，孤立动作 60 秒。</li>
      <li>训练后拉伸 5–10 分钟，补充蛋白质与水分。</li>
    </ul>
    <div class="modal-actions">
      <button class="neu-btn primary" data-close>开始训练！</button>
    </div>`);
  $("#modal-body").querySelectorAll("[data-ex]").forEach(el => {
    el.onclick = () => openExerciseModal(el.dataset.ex);
  });
  $("#modal-body").querySelector("[data-close]").onclick = closeModal;
}

/* ---- 训练记录 ---- */
function renderWorkouts() {
  const list = state.workouts.slice().sort((a, b) => b.date.localeCompare(a.date));
  $("#workout-list").innerHTML = list.length ? list.map(w => {
    const exs = w.exercises && w.exercises.length
      ? w.exercises.map(e => `${e.name}${e.weight ? " " + e.weight + "kg" : ""} ${e.sets}×${e.reps}`).join(" · ")
      : "";
    return `<div class="workout-card" data-wid="${w.id}">
      <div class="wc-head"><span>${fmtDate(fromISO(w.date))} ${fmtWeekday(fromISO(w.date))}</span><span>${w.duration}min · RPE ${w.rpe || "-"}</span></div>
      <div class="wc-sub">${esc(w.focus || "")}${w.source ? " · " + esc(w.source) : ""}</div>
      ${exs ? `<div class="wc-ex">${esc(exs)}</div>` : ""}
      ${w.note ? `<div class="wc-sub">📝 ${esc(w.note)}</div>` : ""}
    </div>`;
  }).join("") : `<div class="empty">还没有训练记录。练完把运动手表记录发到对话里，或点上方按钮手动记录。</div>`;
  $("#workout-list").querySelectorAll(".workout-card").forEach(el => {
    el.onclick = () => openWorkoutModal(el.dataset.wid);
  });
}

function parseWatchText(text) {
  const rows = [];
  const lines = text.split(/\n|\uff1b|;/).map(x => x.trim()).filter(Boolean);
  const NAME = "[\\u4e00-\\u9fa5A-Za-z\u00b7\\- ]{1,24}?";
  const PA = new RegExp("^(" + NAME + ")\\s*(?:(\\d+(?:\\.\\d+)?)\\s*(?:kg|\u516c\u65a4)\\s*)?(\\d+)\\s*[x\u00d7*]\\s*(\\d+)\\s*(?:\u6b21|reps)?(?:\\s*[x\u00d7*]\\s*(\\d+))?$", "i");
  const PB = new RegExp("^(" + NAME + ")\\s*(\\d+)\\s*[x\u00d7*]\\s*(\\d+)\\s*(?:\u6b21|reps)?(?:\\s*[x\u00d7*]\\s*(\\d+))?\\s*(?:(\\d+(?:\\.\\d+)?)\\s*(?:kg|\u516c\u65a4))?$", "i");
  const PC = new RegExp("^(" + NAME + ")\\s*(\\d+)\\s*(?:\u6b21|reps)", "i");
  for (const line of lines) {
    const ma = line.match(PA);
    if (ma) { rows.push({ name: ma[1].trim(), weight: ma[2], sets: ma[3], reps: ma[4] || ma[3] }); continue; }
    const mb = line.match(PB);
    if (mb) { rows.push({ name: mb[1].trim(), weight: mb[5] || "", sets: mb[2], reps: mb[3] || mb[4] }); continue; }
    const mc = line.match(PC);
    if (mc) rows.push({ name: mc[1].trim(), weight: "", sets: "", reps: mc[2] });
  }
  return rows;
}

function openWorkoutModal(id) {
  const editing = id ? state.workouts.find(w => w.id === id) : null;
  const w = editing || { date: todayStr(), focus: "", duration: 60, rpe: 7, source: "手动", exercises: [], note: "" };
  let focusOpts = WEEKLY_PLAN_TEMPLATE.map(p => `<option value="${esc(p.focus)}" ${w.focus === p.focus ? "selected" : ""}>${p.label} · ${p.focus}</option>`).join("");
  if (!WEEKLY_PLAN_TEMPLATE.some(p => p.focus === w.focus) && w.focus) focusOpts += `<option value="${esc(w.focus)}" selected>${esc(w.focus)}</option>`;
  const exRows = (w.exercises && w.exercises.length ? w.exercises : [{ name: "", weight: "", sets: "", reps: "" }]).map((e, i) => `
    <div class="ex-row form-row3" data-row="${i}" style="margin-bottom:8px">
      <input placeholder="动作" value="${esc(e.name)}" data-f="name">
      <input placeholder="重量kg" value="${esc(e.weight)}" data-f="weight">
      <input placeholder="组×次 (如 4×10)" value="${esc(e.sets + (e.reps ? "×" + e.reps : ""))}" data-f="sr">
    </div>`).join("");
  openModal(editing ? "编辑训练记录" : "记录一次训练", `
    <div class="form-row">
      <div class="field"><label>日期</label><input type="date" id="wk-date" value="${w.date}"></div>
      <div class="field"><label>训练内容</label><select id="wk-focus">${focusOpts}<option value="自定义/其他">自定义/其他</option></select></div>
    </div>
    <div class="form-row3">
      <div class="field"><label>时长（分钟）</label><input type="number" id="wk-dur" value="${w.duration}"></div>
      <div class="field"><label>主观强度 RPE 1-10</label><input type="number" min="1" max="10" id="wk-rpe" value="${w.rpe}"></div>
      <div class="field"><label>来源</label><select id="wk-source"><option ${w.source === "手动" ? "selected" : ""}>手动</option><option ${w.source === "运动手表" ? "selected" : ""}>运动手表</option></select></div>
    </div>
    <h4 style="margin:10px 0 6px">动作明细（可选）</h4>
    <div id="wk-exrows">${exRows}</div>
    <button class="slot-btn" id="wk-addrow" type="button">＋ 添加动作</button>
    <h4 style="margin:14px 0 6px">粘贴运动手表记录（可选，自动解析）</h4>
    <textarea id="wk-watch" rows="3" placeholder="示例：&#10;哑铃肩上推举 12kg 4×10&#10;侧平举 6kg 4×12"></textarea>
    <div class="field" style="margin-top:10px"><label>备注（状态/心得）</label><textarea id="wk-note" rows="2">${esc(w.note || "")}</textarea></div>
    <div class="modal-actions">
      <button class="neu-btn primary" id="wk-save">保存</button>
      ${editing ? `<button class="neu-btn" id="wk-del">删除</button>` : ""}
    </div>`);
  let rowIdx = w.exercises ? w.exercises.length : 1;
  const addRow = (e) => {
    const div = document.createElement("div");
    div.className = "ex-row form-row3";
    div.style.marginBottom = "8px";
    div.innerHTML = `<input placeholder="动作" data-f="name"><input placeholder="重量kg" data-f="weight"><input placeholder="组×次 (如 4×10)" data-f="sr">`;
    $("#wk-exrows").appendChild(div);
  };
  $("#wk-addrow").onclick = addRow;
  $("#wk-watch").onchange = () => {
    const rows = parseWatchText($("#wk-watch").value);
    if (rows.length) {
      $("#wk-exrows").innerHTML = "";
      rows.forEach(r => {
        const div = document.createElement("div");
        div.className = "ex-row form-row3";
        div.style.marginBottom = "8px";
        div.innerHTML = `<input placeholder="动作" value="${esc(r.name)}" data-f="name"><input placeholder="重量kg" value="${esc(r.weight)}" data-f="weight"><input placeholder="组×次" value="${esc(r.sets + (r.reps ? "×" + r.reps : ""))}" data-f="sr">`;
        $("#wk-exrows").appendChild(div);
      });
      showToast("📋", "已解析 " + rows.length + " 个动作", "请核对动作、重量与组次后保存。");
    }
  };
  $("#wk-save").onclick = () => {
    const exercises = [];
    $("#wk-exrows").querySelectorAll(".ex-row").forEach(row => {
      const name = row.querySelector('[data-f="name"]').value.trim();
      const weight = row.querySelector('[data-f="weight"]').value.trim();
      const sr = row.querySelector('[data-f="sr"]').value.trim();
      if (name) {
        const mm = sr.match(/^(\d+)\s*[x×*]\s*(\d+)$/);
        exercises.push({ name, weight, sets: mm ? mm[1] : "", reps: mm ? mm[2] : sr });
      }
    });
    const rec = {
      id: editing ? editing.id : "wk_" + Date.now(),
      date: $("#wk-date").value,
      focus: $("#wk-focus").value,
      duration: parseInt($("#wk-dur").value) || 0,
      rpe: parseInt($("#wk-rpe").value) || 0,
      source: $("#wk-source").value,
      exercises,
      note: $("#wk-note").value.trim(),
    };
    if (editing) {
      const i = state.workouts.findIndex(x => x.id === id);
      state.workouts[i] = rec;
    } else state.workouts.push(rec);
    saveState(); closeModal(); renderAll();
    showToast("💪", "训练已记录", "每一次坚持都算数！");
  };
  const del = $("#wk-del");
  if (del) del.onclick = () => {
    state.workouts = state.workouts.filter(x => x.id !== id);
    saveState(); closeModal(); renderAll();
  };
}

/* ---- 教程库 ---- */
let exFilter = "all";
let exSearch = "";

function renderExChips() {
  const groups = ["all", "肩", "背", "胸", "腿", "臀", "核心", "手臂", "肩袖", "斜方肌"];
  $("#ex-chips").innerHTML = groups.map(g =>
    `<button class="chip ${exFilter === g ? "active" : ""}" data-g="${g}">${g === "all" ? "全部" : g}</button>`).join("");
  $("#ex-chips").querySelectorAll(".chip").forEach(el => {
    el.onclick = () => { exFilter = el.dataset.g; renderExChips(); renderExGrid(); };
  });
}

function renderExGrid() {
  const q = exSearch.trim().toLowerCase();
  let list = EXERCISES;
  if (exFilter !== "all") list = list.filter(e => e.group === exFilter);
  if (q) list = list.filter(e => e.name.toLowerCase().includes(q) || e.group.includes(q) || e.equipment.includes(q));
  $("#ex-grid").innerHTML = list.length ? list.map(e => `
    <div class="ex-card" data-ex="${e.id}">
      <h4>${esc(e.name)}</h4>
      <div class="ex-tags">
        <span class="mini-tag">${e.group}</span>
        <span class="mini-tag g">${e.equipment}</span>
        <span class="mini-tag o">${e.level}</span>
        ${e.tan ? `<span class="mini-tag" style="background:#fde3e3;color:#c94a4a">谭成义</span>` : ""}
      </div>
      <p class="muted" style="margin-top:6px">${e.reps} · 休息 ${e.rest}</p>
    </div>`).join("") : `<div class="empty">没有找到该动作，试试搜索「推举」「划船」「深蹲」。</div>`;
  $("#ex-grid").querySelectorAll(".ex-card").forEach(el => {
    el.onclick = () => openExerciseModal(el.dataset.ex);
  });
}

function openExerciseModal(id) {
  const e = EXERCISES.find(x => x.id === id);
  if (!e) return;
  const vid = e.video.type === "bilibili"
    ? `<a class="video-link" target="_blank" rel="noopener" href="${e.video.url}">▶ B 站视频演示（推荐）</a>`
    : `<a class="video-link" target="_blank" rel="noopener" href="https://search.bilibili.com/all?keyword=${encodeURIComponent(e.video.keyword)}">▶ B 站搜索视频演示：${esc(e.video.keyword)}</a>`;
  openModal(e.name, `
    <p><span class="mini-tag">${e.group}</span> <span class="mini-tag g">${e.equipment}</span> <span class="mini-tag o">${e.level}</span></p>
    <h4>动作步骤</h4>
    <ol>${e.method.map(s => `<li>${esc(s)}</li>`).join("")}</ol>
    <h4>💡 发力要点</h4>
    <ul>${e.keyPoints.map(s => `<li>${esc(s)}</li>`).join("")}</ul>
    <h4>⚠️ 常见错误</h4>
    <ul>${e.errors.map(s => `<li>${esc(s)}</li>`).join("")}</ul>
    <p class="muted">建议：${e.reps} · 组间休息 ${e.rest}</p>
    ${vid}
    ${e.tanNote ? `<p class="muted" style="margin-top:8px">📌 ${esc(e.tanNote)}</p>` : ""}
    <div class="modal-actions"><button class="neu-btn primary" data-close>知道了</button></div>`);
  $("#modal-body").querySelector("[data-close]").onclick = closeModal;
}

/* ---- 谭成义库 ---- */
function renderTan() {
  $("#tan-grid").innerHTML = TAN_LIBRARY.map(t => `
    <a class="tan-card" target="_blank" rel="noopener" href="${t.url}">
      <h4>${esc(t.title)}</h4>
      <p>${esc(t.desc)}</p>
      <div class="play">▶ ${esc(t.plays)}</div>
    </a>`).join("");
}

/* ================= 第四栏：阅读 ================= */
let readCalDate = new Date();

function renderReading() {
  const t = todayStr();
  const todayMin = state.readings.filter(r => r.date === t).reduce((a, r) => a + (r.minutes || 0), 0);
  const wkStart = toISO(mondayOf(new Date()));
  const wkEnd = toISO(addDays(fromISO(wkStart), 6));
  const wkMin = state.readings.filter(r => r.date >= wkStart && r.date <= wkEnd).reduce((a, r) => a + (r.minutes || 0), 0);
  let streak = 0;
  for (let d = new Date(); ; d = addDays(d, -1)) {
    const has = state.readings.some(r => r.date === toISO(d));
    if (has) streak++; else break;
  }
  $("#read-today").textContent = todayMin + " min";
  $("#read-week").textContent = wkMin + " min";
  $("#read-streak").textContent = streak + " 天";

  $("#read-cal-title").textContent = `${readCalDate.getFullYear()}年${readCalDate.getMonth() + 1}月`;
  renderCalendar($("#read-cal"), readCalDate, (iso) => {
    const ms = state.readings.filter(r => r.date === iso).reduce((a, r) => a + (r.minutes || 0), 0);
    return ms ? { cls: ms >= 20 ? "good" : "mid", dot: "📖", tip: `阅读 ${ms} 分钟` } : { cls: "", dot: "", tip: "" };
  }, () => {});

  const list = state.readings.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40);
  $("#reading-list").innerHTML = list.length ? list.map(r => `
    <div class="reading-card" data-rid="${r.id}">
      <div class="rc-head"><span>📖 ${esc(r.book)}</span><span class="muted">${fmtDate(fromISO(r.date))} · ${r.minutes}min</span></div>
      ${r.pages ? `<div class="rc-sub">页码：${esc(r.pages)}</div>` : ""}
      ${r.quote ? `<div class="rc-quote">「${esc(r.quote)}」</div>` : ""}
      ${r.thought ? `<div class="rc-thought">💭 ${esc(r.thought)}</div>` : ""}
    </div>`).join("") : `<div class="empty">今天读点什么吧。10 分钟也是进步。</div>`;
  $("#reading-list").querySelectorAll(".reading-card").forEach(el => {
    el.onclick = () => openReadingModal(el.dataset.rid);
  });
}

function openReadingModal(id) {
  const editing = id ? state.readings.find(r => r.id === id) : null;
  const r = editing || { date: todayStr(), book: "", minutes: 20, pages: "", quote: "", thought: "" };
  const bookOpts = BOOKS.concat(state.books).map(b => `<option value="${esc(b.title)}" ${r.book === b.title ? "selected" : ""}>${esc(b.title)}</option>`).join("");
  openModal(editing ? "编辑阅读记录" : "记录今日阅读", `
    <div class="form-row">
      <div class="field"><label>日期</label><input type="date" id="rd-date" value="${r.date}"></div>
      <div class="field"><label>阅读时长（分钟）</label><input type="number" min="1" id="rd-min" value="${r.minutes}"></div>
    </div>
    <div class="field"><label>书籍（可从读书库选择，或直接输入）</label>
      <input list="rd-booklist" id="rd-book" value="${esc(r.book)}" placeholder="书名">
      <datalist id="rd-booklist">${bookOpts}</datalist>
    </div>
    <div class="field"><label>阅读页码 / 章节</label><input id="rd-pages" value="${esc(r.pages)}" placeholder="如 P120–145 / 第三章"></div>
    <div class="field"><label>📝 喜欢的句子 / 片段</label><textarea id="rd-quote" rows="3">${esc(r.quote || "")}</textarea></div>
    <div class="field"><label>💭 心得</label><textarea id="rd-thought" rows="3">${esc(r.thought || "")}</textarea></div>
    <div class="modal-actions">
      <button class="neu-btn primary" id="rd-save">保存</button>
      ${editing ? `<button class="neu-btn" id="rd-del">删除</button>` : ""}
    </div>`);
  $("#rd-save").onclick = () => {
    const rec = {
      id: editing ? editing.id : "rd_" + Date.now(),
      date: $("#rd-date").value,
      book: $("#rd-book").value.trim() || "未命名",
      minutes: parseInt($("#rd-min").value) || 0,
      pages: $("#rd-pages").value.trim(),
      quote: $("#rd-quote").value.trim(),
      thought: $("#rd-thought").value.trim(),
    };
    if (editing) {
      const i = state.readings.findIndex(x => x.id === id);
      state.readings[i] = rec;
    } else state.readings.push(rec);
    saveState(); closeModal(); renderAll();
    showToast("📚", "打卡成功", `${rec.minutes} 分钟，日拱一卒。`);
  };
  const del = $("#rd-del");
  if (del) del.onclick = () => {
    state.readings = state.readings.filter(x => x.id !== id);
    saveState(); closeModal(); renderAll();
  };
}

function renderBookGrid() {
  const q = $("#book-search").value.trim().toLowerCase();
  const list = BOOKS.concat(state.books).filter(b =>
    !q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || b.category.includes(q));
  $("#book-grid").innerHTML = list.map(b => `
    <div class="book-card" data-book="${esc(b.title)}">
      <h4>${esc(b.title)}</h4>
      <div class="bc-author">${esc(b.author)}</div>
      <div class="bc-cat"><span class="mini-tag purple">${esc(b.category)}</span></div>
      <p class="muted" style="margin-top:6px">${esc(b.intro)}</p>
    </div>`).join("") || `<div class="empty">没有找到相关书籍</div>`;
  $("#book-grid").querySelectorAll(".book-card").forEach(el => {
    el.onclick = () => {
      openModal(el.dataset.book, `
        <h4>${esc(el.dataset.book)}</h4>
        <p>${esc((BOOKS.concat(state.books).find(b => b.title === el.dataset.book) || {}).intro || "")}</p>
        <p class="muted">想读就打开它，从 10 分钟开始。</p>
        <div class="modal-actions"><button class="neu-btn primary" data-close>好，去读书</button></div>`);
      $("#modal-body").querySelector("[data-close]").onclick = closeModal;
    };
  });
}

/* ================= 体重记录 ================= */
function openWeightModal() {
  const last = state.weightLog[state.weightLog.length - 1];
  openModal("更新体重 / 体脂", `
    <div class="form-row">
      <div class="field"><label>体重（kg）</label><input type="number" step="0.1" id="wt-weight" value="${state.profile.weightKg}"></div>
      <div class="field"><label>体脂率（%）</label><input type="number" step="0.1" id="wt-fat" value="${state.profile.bodyFat}"></div>
    </div>
    <div class="field"><label>备注</label><input id="wt-note" placeholder="可选"></div>
    <h4 style="margin:10px 0 4px">历史记录</h4>
    <ul style="max-height:160px;overflow:auto">${state.weightLog.slice(-20).reverse().map(w =>
      `<li>${w.date} · ${w.weight}kg${w.bodyFat ? " · 体脂" + w.bodyFat + "%" : ""}${w.note ? " · " + esc(w.note) : ""}</li>`).join("") || "<li class='muted'>暂无记录</li>"}</ul>
    <div class="modal-actions"><button class="neu-btn primary" id="wt-save">保存本次</button></div>`);
  $("#wt-save").onclick = () => {
    const w = parseFloat($("#wt-weight").value);
    const f = parseFloat($("#wt-fat").value);
    if (w > 0) {
      state.profile.weightKg = w;
      state.profile.bodyFat = f > 0 ? f : state.profile.bodyFat;
      state.weightLog.push({ date: todayStr(), weight: w, bodyFat: f || null, note: $("#wt-note").value.trim() });
      saveState(); closeModal(); renderAll();
      showToast("⚖️", "已记录", "距离 170 斤（85kg）目标还有 " + Math.max(0, (w - state.profile.targetWeightKg).toFixed(1)) + " kg。");
    }
  };
}

/* ================= 数据导入导出 ================= */
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "成长工作台备份_" + todayStr() + ".json";
  a.click();
  URL.revokeObjectURL(a.href);
  showToast("💾", "已导出", "请妥善保存备份文件。");
}
function importData() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.onchange = () => {
    const f = input.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data.profile) throw new Error("格式不对");
        state = Object.assign(defaultState(), data, { settings: Object.assign(defaultState().settings, data.settings || {}) });
        saveState(); renderAll();
        showToast("✅", "导入成功", "数据已恢复。");
      } catch (e) {
        showToast("⚠️", "导入失败", "文件格式不正确，请选择导出的备份文件。");
      }
    };
    reader.readAsText(f);
  };
  input.click();
}

/* ================= 事件绑定 ================= */
function bindEvents() {
  // 左侧导航：切换单栏视图
  $$(".side-btn").forEach(btn => {
    btn.onclick = () => {
      $$(".side-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const v = btn.dataset.view;
      $$(".view").forEach(s => s.classList.remove("active"));
      const target = document.getElementById("view-" + v);
      if (target) target.classList.add("active");
      if (history.replaceState) history.replaceState(null, "", "#" + v);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
  });

  // 页签
  $$(".tabs").forEach(tabs => {
    tabs.querySelectorAll(".tab").forEach(tab => {
      tab.onclick = () => {
        tabs.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
        tab.classList.add("active");
        const root = tabs.closest(".column");
        root.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
        root.querySelector(`.tab-panel[data-panel="${tab.dataset.tab}"]`).classList.add("active");
      };
    });
  });

  // 睡眠
  $("#sleep-prev").onclick = () => { sleepCalDate = new Date(sleepCalDate.getFullYear(), sleepCalDate.getMonth() - 1, 1); renderSleep(); };
  $("#sleep-next").onclick = () => { sleepCalDate = new Date(sleepCalDate.getFullYear(), sleepCalDate.getMonth() + 1, 1); renderSleep(); };
  $("#btn-add-sleep").onclick = () => openSleepModal(todayStr());

  // 饮水
  $("#water-add").onclick = addWater;
  $("#water-undo").onclick = undoWater;
  $("#water-reminder").onchange = (e) => {
    state.settings.waterReminder = e.target.checked;
    if (e.target.checked) requestNotifyPermission();
    saveState(); renderWater();
    showToast("💧", e.target.checked ? "饮水提醒已开启" : "饮水提醒已关闭", e.target.checked ? `每 ${state.settings.waterInterval} 分钟提醒一次。` : "");
  };
  $("#water-interval").onchange = (e) => { state.settings.waterInterval = parseInt(e.target.value) || 60; saveState(); };
  $("#water-start").onchange = (e) => { state.settings.waterStart = e.target.value; saveState(); };
  $("#water-end").onchange = (e) => { state.settings.waterEnd = e.target.value; saveState(); };

  // 久坐
  $("#sit-reminder").onchange = (e) => {
    state.settings.sitReminder = e.target.checked;
    if (e.target.checked) requestNotifyPermission();
    saveState(); renderSit();
    showToast("🧘", e.target.checked ? "久坐提醒已开启" : "久坐提醒已关闭", e.target.checked ? `每 ${state.settings.sitInterval} 分钟提醒起身。` : "");
  };
  $("#sit-interval").onchange = (e) => { state.settings.sitInterval = parseInt(e.target.value) || 50; saveState(); renderSit(); };
  $("#sit-log").onclick = logSit;

  // 菜谱
  $("#recipe-search").oninput = (e) => { recipeSearch = e.target.value; renderRecipeGrid(); };
  $("#diet-prev").onclick = () => {
    const d = fromISO(selectedDietDate);
    selectedDietDate = toISO(new Date(d.getFullYear(), d.getMonth() - 1, 1));
    renderDietCalendar(); renderMealDay();
  };
  $("#diet-next").onclick = () => {
    const d = fromISO(selectedDietDate);
    selectedDietDate = toISO(new Date(d.getFullYear(), d.getMonth() + 1, 1));
    renderDietCalendar(); renderMealDay();
  };
  $("#btn-smart-gen").onclick = smartGenerate;
  $("#btn-copy-request").onclick = () => {
    const txt = "【食材分析】请帮我分析我发来的这张照片（或下面这串食材），估算每份的热量和三大营养素（蛋白质/碳水/脂肪），并给 2–3 个能用这些食材做成的低油、高蛋白菜谱方案（含步骤和营养）。谢谢！";
    navigator.clipboard.writeText(txt).then(() => showToast("📋", "已复制", "粘贴到 Codex 对话里发给我即可。"));
  };
  // 热量估算器
  $("#btn-estimate-cal").onclick = () => renderCalEstimate($("#cal-input").value);
  $("#cal-input").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); renderCalEstimate($("#cal-input").value); } });

  // 健身
  $("#btn-add-workout").onclick = () => openWorkoutModal(null);
  $("#ex-search").oninput = (e) => { exSearch = e.target.value; renderExGrid(); };

  // 阅读
  $("#btn-add-reading").onclick = () => openReadingModal(null);
  $("#read-prev").onclick = () => { readCalDate = new Date(readCalDate.getFullYear(), readCalDate.getMonth() - 1, 1); renderReading(); };
  $("#read-next").onclick = () => { readCalDate = new Date(readCalDate.getFullYear(), readCalDate.getMonth() + 1, 1); renderReading(); };
  $("#book-search").oninput = () => renderBookGrid();

  // 数据
  $("#btn-export").onclick = exportData;
  $("#btn-import").onclick = importData;

  // 科学依据模态
  $$("[data-open='science-modal']").forEach(el => {
    el.onclick = () => {
      openModal("数据来源与科学依据", `
        <p class="muted" style="margin-bottom:10px">以下为本工作台内置数据的核心依据，均来自公开权威来源；菜谱营养为估算值。</p>
        <div class="science-list">${SCIENCE.map(s =>
          `<div class="science-item"><h5>${esc(s.title)}</h5><p>${esc(s.detail)}</p><a href="${s.url}" target="_blank" rel="noopener">${esc(s.url)}</a></div>`).join("")}
        </div>
        <div class="modal-actions"><button class="neu-btn primary" data-close>知道了</button></div>`);
      $("#modal-body").querySelector("[data-close]").onclick = closeModal;
    };
  });

  // 进度指标里加“更新体重”按钮
  const statCard = $("#plan-grid").closest(".column").querySelectorAll(".neu-card")[1];
  const addWt = document.createElement("button");
  addWt.className = "neu-btn";
  addWt.textContent = "⚖️ 记录体重/体脂";
  addWt.style.width = "100%";
  addWt.onclick = openWeightModal;
  statCard.appendChild(addWt);

  // 键盘 Esc 关闭模态
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
}

/* ================= 渲染入口 ================= */
function renderAll() {
  $("#today-line").textContent = `${fmtDate(new Date())} ${fmtWeekday(new Date())} · 慢就是快，习惯胜于冲刺`;
  renderQuickStats();
  renderScienceBanner();
  renderSleep();
  renderWater();
  renderSit();
  renderWeekMenu();
  renderRecipeChips();
  renderRecipeGrid();
  renderDietCalendar();
  renderMealDay();
  renderCalorieChart();
  renderPlan();
  renderWorkouts();
  renderExChips();
  renderExGrid();
  renderTan();
  renderReading();
  renderBookGrid();
}

document.addEventListener("DOMContentLoaded", () => {
  // 支持 URL 锚点定位（如 #diet），刷新后保持当前栏
  const hash = location.hash.replace("#", "");
  if (hash && document.getElementById("view-" + hash)) {
    document.querySelectorAll(".side-btn").forEach(b => b.classList.toggle("active", b.dataset.view === hash));
    document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + hash));
  }
  bindEvents();
  renderAll();
  // 每 60 秒刷新一次快速统计/饮水显示（提醒可能改变数字）
  setInterval(() => { renderQuickStats(); renderWater(); renderSit(); }, 60000);
});
