/**
 * 罪案推理·侦探笔记 —— 游戏引擎
 * 纯前端单页应用，无外部依赖。
 */

(function () {
  "use strict";

  // ---------- 状态 ----------
  const State = {
    screen: "home",
    caseId: null,
    examined: new Set(),
    selectedSuspect: null,
    selectedEvidence: new Set(),
    revealed: false,
    categoryFilter: null,  // 当前选中的分类 id，null = 全部
  };

  // ---------- 案件分类 ----------
  const CATEGORIES = {
    all: { id: "all", name: "全部案件", icon: "📋", desc: "", color: "#c9a86a" },
    "turbulent-times": { id: "turbulent-times", name: "乱世风云", icon: "🚢", desc: "动荡年代的血色交易与权力暗涌", color: "#c9a86a" },
    "locked-room":     { id: "locked-room",     name: "密室诡计", icon: "🏚️", desc: "门与窗皆从内反锁——凶手却已抽身", color: "#7a9cc6" },
    "exotic-mystery":  { id: "exotic-mystery",  name: "异域谜踪", icon: "🏜️", desc: "沙漠、江河与远方——危险藏在异乡目光背后", color: "#d4a256" },
    "dark-hearts":     { id: "dark-hearts",     name: "人间恶魔", icon: "🔪", desc: "藏在人皮之下的深渊——连环杀手与变态心理", color: "#c46a6a" },
    "disappearance":   { id: "disappearance",   name: "失踪谜案", icon: "🌫️", desc: "消失在雾中的身影——比死亡更令人不安", color: "#9a8fbf" },
    "small-town":      { id: "small-town",      name: "故里疑云", icon: "🏘️", desc: "平静小镇深处，每个人都在藏一个秘密", color: "#b8965c" },
  };

  // ---------- 隐藏勋章 ----------
  const HIDDEN_BADGES = [
    {
      id: "nostalgia-master",
      name: "怀旧仙人",
      icon: "\uD83D\uDCDC",
      desc: "连续通关三个百年以上的古老案件",
      color: "#c9a86a",
      check: (history) => {
        let streak = 0;
        for (let i = history.length - 1; i >= 0; i--) {
          const c = CASES.find(cs => cs.id === history[i]);
          if (c && c.isAncient) streak++;
          else break;
        }
        return streak >= 3;
      }
    },
    {
      id: "focus-master",
      name: "专注勋章",
      icon: "\uD83C\uDFAF",
      desc: "连续通关某个分类的全部案件",
      color: "#8fb3a3",
      check: (history) => {
        if (history.length < 2) return false;
        const lastCat = CASES.find(c => c.id === history[history.length - 1])?.category;
        if (!lastCat) return false;
        const allInCat = CASES.filter(c => c.category === lastCat).map(c => c.id);
        if (allInCat.length < 2) return false;
        // 检查历史末尾是否包含该分类的全部案件（连续）
        let streak = 0;
        const catsInStreak = new Set();
        for (let i = history.length - 1; i >= 0; i--) {
          const c = CASES.find(cs => cs.id === history[i]);
          if (c && c.category === lastCat) { streak++; catsInStreak.add(c.id); }
          else break;
        }
        return catsInStreak.size === allInCat.length && streak >= allInCat.length;
      }
    },
    {
      id: "podcast-echo",
      name: "播客回声",
      icon: "\uD83C\uDF99\uFE0F",
      desc: "连续通关三个霓达播客改编案件",
      color: "#d4a256",
      check: (history) => {
        let streak = 0;
        for (let i = history.length - 1; i >= 0; i--) {
          const c = CASES.find(cs => cs.id === history[i]);
          if (c && c.source === "nida") streak++;
          else break;
        }
        return streak >= 3;
      }
    },
  ];

  // 播放历史
  const HISTORY_KEY = "detective_history_v2";
  function loadHistory() { try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; } }
  function saveHistory(h) { try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch {} }
  function addToHistory(caseId) {
    let h = loadHistory();
    // 去重：如果刚才玩过同一个案子，先移除旧记录
    h = h.filter(id => id !== caseId);
    h.push(caseId);
    if (h.length > 50) h = h.slice(-50); // 最多保留50条
    saveHistory(h);
    return h;
  }

  // ---------- 音效系统 ----------
  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
    }
    return audioCtx;
  }
  function playClickSound() {
    const ctx = getAudioCtx(); if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sine"; o.frequency.setValueAtTime(800, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.08);
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.1);
  }
  function playBadgeSound() {
    const ctx = getAudioCtx(); if (!ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = "triangle";
      const t = ctx.currentTime + i * 0.12;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.start(t); o.stop(t + 0.3);
    });
  }

  // ---------- 粒子动画 ----------
  function spawnBadgeParticles(x, y, color) {
    for (let i = 0; i < 20; i++) {
      const p = document.createElement("div");
      p.className = "badge-particle";
      const angle = (Math.PI * 2 * i) / 20;
      const dist = 60 + Math.random() * 80;
      p.style.cssText = `
        left:${x}px; top:${y}px;
        --dx:${Math.cos(angle) * dist}px;
        --dy:${Math.sin(angle) * dist}px;
        background:${color};
        animation-delay:${Math.random() * 0.2}s;
      `;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 1200);
    }
  }

  function addCaseCardRipple(e) {
    const card = e.currentTarget;
    const ripple = document.createElement("span");
    ripple.className = "case-ripple";
    const rect = card.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = size + "px";
    ripple.style.left = (e.clientX - rect.left - size / 2) + "px";
    ripple.style.top = (e.clientY - rect.top - size / 2) + "px";
    card.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  }
  const BADGE_KEY = "detective_badges_v2";
  function loadBadges() {
    try { return JSON.parse(localStorage.getItem(BADGE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveBadges(b) {
    try { localStorage.setItem(BADGE_KEY, JSON.stringify(b)); }
    catch (e) { /* localStorage 不可用时静默失败 */ }
  }
  function markSolved(caseId) {
    const b = loadBadges();
    b["solved_" + caseId] = true;
    saveBadges(b);
  }
  function isSolved(caseId) {
    return !!loadBadges()["solved_" + caseId];
  }
  function categoryProgress(catId) {
    const casesInCat = CASES.filter(c => c.category === catId);
    if (casesInCat.length === 0) return { total: 0, solved: 0 };
    const solved = casesInCat.filter(c => isSolved(c.id)).length;
    return { total: casesInCat.length, solved };
  }
  function checkAndAwardBadge(catId) {
    if (catId === "all") return null;
    const badges = loadBadges();
    if (badges[catId]) return null; // 已有勋章
    const prog = categoryProgress(catId);
    if (prog.total > 0 && prog.solved === prog.total) {
      badges[catId] = true;
      saveBadges(badges);
      return CATEGORIES[catId];
    }
    return null;
  }
  function getUnlockedBadges() {
    const badges = loadBadges();
    return Object.keys(CATEGORIES).filter(k => k !== "all" && badges[k]).map(k => CATEGORIES[k]);
  }
  function getUnlockedHiddenBadges() {
    const badges = loadBadges();
    return HIDDEN_BADGES.filter(hb => badges[hb.id]);
  }

  const CATEGORY_META = {
    scene: { label: "案发现场", icon: "🔍", color: "#c9a86a" },
    forensic: { label: "法医检验", icon: "🧪", color: "#8fb3a3" },
    witness: { label: "证人证词", icon: "🗣️", color: "#a98fb3" },
    document: { label: "文书物证", icon: "📜", color: "#b3936f" },
  };

  // ---------- 工具 ----------
  function $(sel) {
    return document.querySelector(sel);
  }
  function getCase() {
    return CASES.find((c) => c.id === State.caseId);
  }
  function esc(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  function narrToHtml(text) {
    return esc(text).replace(/\n\n/g, "</p><p class='narr-p'>").replace(/\n/g, "<br>");
  }
  function difficultyDots(n) {
    return "●".repeat(n) + "○".repeat(5 - n);
  }

  // ---------- 屏幕路由 ----------
  function go(screen) {
    State.screen = screen;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function render() {
    const app = $("#app");
    let html = "";
    switch (State.screen) {
      case "home":
        html = renderHome();
        break;
      case "case-select":
        html = renderCaseSelect();
        break;
      case "briefing":
        html = renderBriefing();
        break;
      case "investigation":
        html = renderInvestigation();
        break;
      case "deduction":
        html = renderDeduction();
        break;
      case "reveal":
        html = renderReveal();
        break;
    }
    app.innerHTML = html;
    bindEvents();
  }

  // ---------- 首页 ----------
  function renderHome() {
    const badges = getUnlockedBadges();
    const hiddenBadges = getUnlockedHiddenBadges();
    const badgeHtml = badges.length > 0 ? `
      <div class="home-badges">
        <div class="home-badges-label">🏆 已解锁勋章</div>
        <div class="home-badges-row">
          ${badges.map(b => `<span class="badge-chip" style="--bcolor:${b.color}">${b.icon} ${b.name}</span>`).join("")}
        </div>
      </div>` : "";
    const hiddenHtml = `
      <div class="home-badges">
        <div class="home-badges-label">🔮 隐藏勋章（${hiddenBadges.length}/${HIDDEN_BADGES.length}）</div>
        <div class="home-badges-row">
          ${HIDDEN_BADGES.map(hb => {
            const unlocked = hiddenBadges.some(b => b.id === hb.id);
            return `<span class="badge-chip ${unlocked ? '' : 'badge-locked'}" style="--bcolor:${hb.color}">${unlocked ? hb.icon : '❓'} ${unlocked ? hb.name : '???'}</span>`;
          }).join("")}
        </div>
      </div>`;
    const totalBadgeCount = badges.length + hiddenBadges.length;

    const totalSolved = CASES.filter(c => isSolved(c.id)).length;
    const statsHtml = totalSolved > 0 ? `<div class="home-stats">已破案 <strong>${totalSolved}</strong> / ${CASES.length}  ·  勋章 <strong>${totalBadgeCount}</strong> / ${Object.keys(CATEGORIES).length - 1 + HIDDEN_BADGES.length}</div>` : "";

    return `
      <section class="screen home">
        <div class="home-inner">
          <div class="home-mark">🕯️</div>
          <h1 class="home-title">罪案推理<span>·</span>侦探笔记</h1>
          <p class="home-sub">以真实历史背景为蓝本改编的谜案。<br>勘查线索、推敲证词，用逻辑揪出真凶。</p>
          ${badgeHtml}
          ${hiddenHtml}
          ${statsHtml}
          <button class="btn btn-primary btn-lg" data-act="start">翻开案件簿</button>
          <div class="home-foot">案件内容均为原创戏剧化改编，基于公共领域历史事件。不涉及任何版权播客内容。</div>
        </div>
      </section>`;
  }

  // ---------- 案件选择 ----------
  function renderCaseSelect() {
    const activeCat = State.categoryFilter || "all";

    // 分类标签
    const catTabs = Object.values(CATEGORIES).map(cat => {
      const active = activeCat === cat.id;
      const isAll = cat.id === "all";
      const prog = isAll ? { total: CASES.length, solved: CASES.filter(c => isSolved(c.id)).length }
                         : categoryProgress(cat.id);
      const done = prog.total > 0 && prog.solved === prog.total;
      return `<button class="tab cat-tab ${active ? 'active' : ''} ${done ? 'cat-done' : ''}" data-act="filter-cat" data-cat="${cat.id}">
        <span class="tab-icon">${cat.icon}</span>
        <span class="tab-label">${cat.name}</span>
        <span class="tab-count">${prog.solved}/${prog.total}</span>
        ${done ? '<span class="cat-check">🏆</span>' : ''}
      </button>`;
    }).join("");

    // 根据分类筛选案件
    const filtered = CASES.filter(c => activeCat === "all" || c.category === activeCat);
    const cards = filtered.map((c) => {
      const solved = isSolved(c.id);
      const cat = CATEGORIES[c.category] || CATEGORIES.all;
      return `
        <article class="case-card ${solved ? 'case-solved' : ''}" data-act="open-case" data-id="${c.id}" style="--accent:${c.accent}">
          <div class="case-card-top">
            <span class="case-era">${esc(c.era)} <span class="case-cat-tag" style="color:${cat.color}">${cat.icon} ${cat.name}</span></span>
            <span class="case-diff">${difficultyDots(c.difficulty)}</span>
          </div>
          <h3 class="case-title">${esc(c.title)} ${solved ? '<span class="solved-badge">✓</span>' : ''}</h3>
          <div class="case-subtitle">${esc(c.subtitle)}</div>
          <p class="case-synopsis">${esc(c.synopsis)}</p>
          <div class="case-meta">
            <span>⏱ ${esc(c.duration)}</span>
            <span>👤 ${c.suspects.length} 名嫌疑人</span>
            <span>🔎 ${c.clues.length} 条线索</span>
          </div>
          <div class="case-card-cta">${solved ? '重新调查 →' : '展开调查 →'}</div>
        </article>`;
    }).join("");

    return `
      <section class="screen">
        <header class="topbar">
          <button class="btn-ghost" data-act="home">← 返回</button>
          <h2 class="topbar-title">案件簿</h2>
          <span></span>
        </header>
        <div class="cat-tabs-scroll">
          <div class="tabs cat-tabs">${catTabs}</div>
        </div>
        <div class="case-grid">${cards}</div>
      </section>`;
  }

  // ---------- 案情简报 ----------
  function renderBriefing() {
    const c = getCase();
    const suspects = c.suspects.map((s) => `
      <div class="suspect-chip">
        <span class="suspect-avatar">${s.portrait}</span>
        <div class="suspect-chip-info">
          <div class="suspect-chip-name">${esc(s.name)}</div>
          <div class="suspect-chip-role">${esc(s.role)} · ${s.age}岁</div>
        </div>
      </div>`).join("");
    return `
      <section class="screen">
        <header class="topbar">
          <button class="btn-ghost" data-act="case-select">← 案件簿</button>
          <h2 class="topbar-title">${esc(c.title)}</h2>
          <span></span>
        </header>
        <div class="briefing" style="--accent:${c.accent}">
          <div class="briefing-tag">${esc(c.era)} · 难度 ${difficultyDots(c.difficulty)}</div>
          <p class="narr"><span class="narr-p">${narrToHtml(c.briefing.narrative)}</span></p>
          <div class="victim-card">
            <div class="victim-label">死者档案</div>
            <div class="victim-name">${esc(c.briefing.victim.name)} <span>${c.briefing.victim.age}岁 · ${esc(c.briefing.victim.role)}</span></div>
            <div class="victim-desc">${esc(c.briefing.victim.description)}</div>
          </div>
          <div class="suspect-chips">
            <div class="block-label">涉案人员</div>
            <div class="suspect-chips-inner">${suspects}</div>
          </div>
          <div class="briefing-actions">
            <button class="btn btn-primary btn-lg" data-act="investigate">开始勘查 →</button>
          </div>
        </div>
      </section>`;
  }

  // ---------- 勘查调查 ----------
  function renderInvestigation() {
    const c = getCase();
    const examinedCount = State.examined.size;
    const totalCount = c.clues.length;

    const tabs = Object.keys(CATEGORY_META).map((key) => {
      const meta = CATEGORY_META[key];
      const count = c.clues.filter((cl) => cl.category === key).length;
      const done = c.clues.filter((cl) => cl.category === key && State.examined.has(cl.id)).length;
      return `<button class="tab ${State._activeTab === key || (!State._activeTab && key === 'scene') ? 'active' : ''}" data-act="tab" data-tab="${key}">
        <span class="tab-icon">${meta.icon}</span>
        <span class="tab-label">${meta.label}</span>
        <span class="tab-count">${done}/${count}</span>
      </button>`;
    }).join("");

    const activeTab = State._activeTab || "scene";
    const clues = c.clues.filter((cl) => cl.category === activeTab);
    const clueCards = clues.map((cl) => {
      const examined = State.examined.has(cl.id);
      return `
        <div class="clue-card ${examined ? 'examined' : ''}" data-act="examine" data-id="${cl.id}">
          <div class="clue-card-head">
            <span class="clue-dot" style="background:${CATEGORY_META[cl.category].color}"></span>
            <span class="clue-title">${esc(cl.title)}</span>
            <span class="clue-state">${examined ? '已勘查 ✓' : '点击勘查'}</span>
          </div>
          <div class="clue-body">${examined ? esc(cl.detail) : '<span class="clue-locked">' + esc(cl.locked) + '</span>'}</div>
        </div>`;
    }).join("");

    const suspects = c.suspects.map((s) => `
      <div class="suspect-side-card" data-act="view-suspect" data-id="${s.id}">
        <span class="suspect-avatar sm">${s.portrait}</span>
        <div>
          <div class="suspect-side-name">${esc(s.name)}</div>
          <div class="suspect-side-role">${esc(s.role)}</div>
        </div>
      </div>`).join("");

    const allExamined = examinedCount === totalCount;

    return `
      <section class="screen investigation">
        <header class="topbar">
          <button class="btn-ghost" data-act="briefing">← 简报</button>
          <h2 class="topbar-title">${esc(c.title)}</h2>
          <span class="progress-pill">线索 ${examinedCount}/${totalCount}</span>
        </header>

        <div class="invest-layout">
          <aside class="invest-sidebar">
            <div class="block-label">涉案人员</div>
            ${suspects}
          </aside>

          <main class="invest-main">
            <div class="tabs">${tabs}</div>
            <div class="clue-grid">${clueCards}</div>
            <div class="invest-foot">
              <div class="invest-hint">${allExamined ? '所有线索已勘查完毕，可以开始推理了。' : '继续勘查线索，真相藏在细节里。'}</div>
              <button class="btn btn-primary" data-act="deduct">前往推理 ${allExamined ? '' : `(${examinedCount}/${totalCount})`} →</button>
            </div>
          </main>
        </div>
      </section>`;
  }

  // ---------- 嫌疑人详情弹层 ----------
  function renderSuspectModal(suspectId) {
    const c = getCase();
    const s = c.suspects.find((x) => x.id === suspectId);
    if (!s) return "";
    const statements = s.statements.map((st, i) => `
      <li class="statement"><span class="statement-q">问 ${i + 1}</span><span class="statement-a">${esc(st)}</span></li>`).join("");
    return `
      <div class="modal-overlay" data-act="close-modal">
        <div class="modal" data-act="stop">
          <button class="modal-close" data-act="close-modal">✕</button>
          <div class="modal-suspect-head">
            <span class="suspect-avatar lg">${s.portrait}</span>
            <div>
              <h3 class="modal-suspect-name">${esc(s.name)}</h3>
              <div class="modal-suspect-role">${esc(s.role)} · ${s.age}岁</div>
            </div>
          </div>
          <p class="modal-bio">${esc(s.bio)}</p>
          <div class="modal-field"><span class="field-label">不在场说明</span><p>${esc(s.alibi)}</p></div>
          <div class="modal-field"><span class="field-label">已知动机</span><p>${esc(s.motive)}</p></div>
          <div class="modal-field"><span class="field-label">询问记录</span><ul class="statements">${statements}</ul></div>
        </div>
      </div>`;
  }

  // ---------- 推理指认 ----------
  function renderDeduction() {
    const c = getCase();
    const suspects = c.suspects.map((s) => {
      const selected = State.selectedSuspect === s.id;
      return `
        <div class="accuse-card ${selected ? 'selected' : ''}" data-act="accuse" data-id="${s.id}">
          <span class="suspect-avatar">${s.portrait}</span>
          <div class="accuse-info">
            <div class="accuse-name">${esc(s.name)}</div>
            <div class="accuse-role">${esc(s.role)}</div>
          </div>
          <span class="accuse-check">${selected ? '✓' : ''}</span>
        </div>`;
    }).join("");

    const examinedClues = c.clues.filter((cl) => State.examined.has(cl.id));
    const evidenceOptions = examinedClues.map((cl) => {
      const sel = State.selectedEvidence.has(cl.id);
      return `
        <div class="evidence-pick ${sel ? 'selected' : ''}" data-act="pick-evidence" data-id="${cl.id}">
          <span class="ev-dot" style="background:${CATEGORY_META[cl.category].color}"></span>
          <span class="ev-title">${esc(cl.title)}</span>
          <span class="ev-check">${sel ? '✓' : '+'}</span>
        </div>`;
    }).join("");

    return `
      <section class="screen deduction">
        <header class="topbar">
          <button class="btn-ghost" data-act="investigate">← 继续勘查</button>
          <h2 class="topbar-title">推理指认</h2>
          <span></span>
        </header>
        <div class="deduct-inner" style="--accent:${c.accent}">
          <div class="deduct-step">
            <div class="step-num">一</div>
            <div class="step-content">
              <h3 class="step-title">指认凶手</h3>
              <p class="step-desc">综合所有线索，你认为谁是真凶？</p>
              <div class="accuse-list">${suspects}</div>
            </div>
          </div>
          <div class="deduct-step">
            <div class="step-num">二</div>
            <div class="step-content">
              <h3 class="step-title">呈堂铁证</h3>
              <p class="step-desc">选出最能坐实凶手的关键证据（可多选，将影响你的侦探评分）。</p>
              <div class="evidence-picks">${evidenceOptions || '<div class="empty-tip">请先在勘查阶段查看线索。</div>'}</div>
            </div>
          </div>
          <div class="deduct-actions">
            <button class="btn btn-primary btn-lg ${State.selectedSuspect ? '' : 'disabled'}" data-act="reveal" ${State.selectedSuspect ? '' : 'disabled'}>揭开真相 →</button>
          </div>
        </div>
      </section>`;
  }

  // ---------- 真相揭晓 ----------
  function renderReveal() {
    const c = getCase();
    const sol = c.solution;
    const correct = State.selectedSuspect === sol.culpritId;
    const culprit = c.suspects.find((s) => s.id === sol.culpritId);

    // 关键证据命中
    const keySet = new Set(sol.keyEvidence);
    let keyHit = 0;
    keySet.forEach((id) => { if (State.selectedEvidence.has(id)) keyHit++; });

    // 误导证据计数（选中的非关键证据 = 误导或被干扰）
    let misleading = 0;
    State.selectedEvidence.forEach((id) => {
      if (!keySet.has(id)) misleading++;
    });
    // 惩罚公式：每选一个错误证据扣 10% 命中分
    const rawHit = (keyHit / keySet.size) * 100;
    const penalty = misleading * 10;
    const evidenceScore = Math.max(0, Math.round(rawHit - penalty));

    // 严格综合评分
    let verdict, verdictDesc, score;
    if (correct && evidenceScore >= 80) {
      verdict = "完美推理";
      verdictDesc = "你精准锁定真凶，呈上全部铁证且未被误导线索所惑。";
      score = "S";
    } else if (correct && evidenceScore >= 50) {
      verdict = "破案成功";
      verdictDesc = "你揪出了真凶，但证据链尚有漏洞——有些线索干扰了你的判断。";
      score = "A";
    } else if (correct) {
      verdict = "推理存疑";
      verdictDesc = "真凶落网，但你未能呈上充足铁证，此案难以定罪。";
      score = "B";
    } else {
      verdict = "推理失误";
      verdictDesc = "真凶另有其人。带着复盘的眼光，看看哪里漏了关键一环。";
      score = "—";
    }

    const reasoning = sol.reasoning.map((r) => `
      <div class="reason-step">
        <div class="reason-num">${r.step}</div>
        <div class="reason-text">
          <div class="reason-title">${esc(r.title)}</div>
          <div class="reason-body">${esc(r.text)}</div>
        </div>
      </div>`).join("");

    // 证据评审：列出玩家选中的线索并标注对错
    let evidenceReview = "";
    if (State.selectedEvidence.size > 0) {
      const reviewItems = c.clues
        .filter((cl) => State.selectedEvidence.has(cl.id))
        .map((cl) => {
          const isKey = keySet.has(cl.id);
          return `<div class="ev-review-item ${isKey ? 'ev-correct' : 'ev-wrong'}">
            <span class="ev-review-dot" style="background:${CATEGORY_META[cl.category].color}"></span>
            <span class="ev-review-title">${esc(cl.title)}</span>
            <span class="ev-review-tag">${isKey ? '✓ 关键证据' : '✗ 误导线索'}</span>
          </div>`;
        }).join("");
      evidenceReview = `
        <div class="reveal-section">
          <h3 class="reveal-h">你的呈堂证据评审</h3>
          <div class="ev-review-list">${reviewItems}</div>
        </div>`;
    }

    return `
      <section class="screen reveal ${correct ? 'reveal-ok' : 'reveal-fail'}">
        <header class="topbar">
          <button class="btn-ghost" data-act="case-select">← 案件簿</button>
          <h2 class="topbar-title">真相揭晓</h2>
          <span></span>
        </header>
        <div class="reveal-inner" style="--accent:${c.accent}">
          <div class="verdict-banner">
            <div class="verdict-score">${score}</div>
            <div class="verdict-text">
              <div class="verdict-title">${verdict}</div>
              <div class="verdict-desc">${verdictDesc}</div>
            </div>
          </div>

          <div class="culprit-reveal">
            <span class="suspect-avatar xl">${culprit.portrait}</span>
            <div>
              <div class="culprit-label">真凶</div>
              <div class="culprit-name">${esc(culprit.name)}</div>
              <div class="culprit-role">${esc(culprit.role)}</div>
            </div>
          </div>

          ${evidenceReview}

          <div class="reveal-section">
            <h3 class="reveal-h">作案手法</h3>
            <p class="reveal-p">${esc(sol.method)}</p>
          </div>

          <div class="reveal-section">
            <h3 class="reveal-h">推理还原</h3>
            <div class="reason-chain">${reasoning}</div>
          </div>

          <div class="reveal-actions">
            <button class="btn btn-ghost" data-act="replay">重新调查此案</button>
            <button class="btn btn-primary" data-act="case-select">挑战下一案 →</button>
          </div>
        </div>
      </section>`;
  }

  // ---------- 事件绑定 ----------
  function bindEvents() {
    const app = $("#app");
    app.querySelectorAll("[data-act]").forEach((el) => {
      el.addEventListener("click", handleAction);
    });
  }

  function handleAction(e) {
    const el = e.currentTarget;
    const act = el.dataset.act;
    switch (act) {
      case "start":
        go("case-select");
        break;
      case "home":
        go("home");
        break;
      case "open-case":
        playClickSound();
        addCaseCardRipple(e);
        State.caseId = el.dataset.id;
        State.examined = new Set();
        State.selectedSuspect = null;
        State.selectedEvidence = new Set();
        State.revealed = false;
        State._activeTab = "scene";
        go("briefing");
        break;
      case "case-select":
        go("case-select");
        break;
      case "briefing":
        go("briefing");
        break;
      case "investigate":
        go("investigation");
        break;
      case "tab":
        State._activeTab = el.dataset.tab;
        render();
        break;
      case "examine": {
        const id = el.dataset.id;
        State.examined.add(id);
        render();
        break;
      }
      case "view-suspect": {
        const id = el.dataset.id;
        showSuspectModal(id);
        break;
      }
      case "close-modal":
        closeModal();
        break;
      case "stop":
        e.stopPropagation();
        break;
      case "deduct":
        go("deduction");
        break;
      case "accuse":
        State.selectedSuspect = el.dataset.id;
        render();
        break;
      case "pick-evidence": {
        const id = el.dataset.id;
        if (State.selectedEvidence.has(id)) State.selectedEvidence.delete(id);
        else State.selectedEvidence.add(id);
        render();
        break;
      }
      case "reveal":
        State.revealed = true;
        go("reveal");
        // 标记已通关并检查勋章
        markSolved(State.caseId);
        const history = addToHistory(State.caseId);
        setTimeout(() => {
          const cat = getCase().category;
          if (cat) {
            const badge = checkAndAwardBadge(cat);
            if (badge) { playBadgeSound(); showBadgeToast(badge); }
          }
          // 检查隐藏勋章（延迟，避免与分类勋章冲突）
          setTimeout(() => {
            const badges = loadBadges();
            HIDDEN_BADGES.forEach(hb => {
              if (!badges[hb.id] && hb.check(history)) {
                badges[hb.id] = true;
                saveBadges(badges);
                playBadgeSound();
                showBadgeToast(hb, true);
              }
            });
          }, 800);
        }, 1200);
        break;
      case "filter-cat":
        State.categoryFilter = el.dataset.cat === "all" ? null : el.dataset.cat;
        render();
        break;
      case "replay": {
        const id = State.caseId;
        State.examined = new Set();
        State.selectedSuspect = null;
        State.selectedEvidence = new Set();
        State.revealed = false;
        State._activeTab = "scene";
        State.caseId = id;
        go("briefing");
        break;
      }
    }
  }

  function showSuspectModal(id) {
    let modal = $("#suspect-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "suspect-modal";
      document.body.appendChild(modal);
    }
    modal.innerHTML = renderSuspectModal(id);
    modal.style.display = "block";
    modal.querySelectorAll("[data-act]").forEach((el) => el.addEventListener("click", handleAction));
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }
  function closeModal() {
    const modal = $("#suspect-modal");
    if (modal) {
      modal.style.display = "none";
      modal.innerHTML = "";
    }
  }

  // 勋章获得 toast
  function showBadgeToast(badge, isHidden) {
    const isH = !!isHidden;
    const toast = document.createElement("div");
    toast.className = "badge-toast" + (isH ? " badge-toast-hidden" : "");
    toast.innerHTML = `<span class="badge-toast-icon">${badge.icon}</span><div><strong>${isH ? '🔮 隐藏勋章解锁！' : '勋章解锁！'}</strong><br>${badge.name}</div>`;
    document.body.appendChild(toast);
    const rect = toast.getBoundingClientRect();
    spawnBadgeParticles(rect.left + rect.width / 2, rect.top + rect.height / 2, badge.color);
    setTimeout(() => { toast.classList.add("show"); }, 50);
    setTimeout(() => { toast.classList.remove("show"); }, 4000);
    setTimeout(() => { toast.remove(); }, 4600);
  }

  // ---------- 启动 ----------
  document.addEventListener("DOMContentLoaded", () => {
    render();
  });
})();
