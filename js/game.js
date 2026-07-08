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
    examined: new Set(), // 已勘查的 clue.id
    selectedSuspect: null, // 推理阶段选中的嫌疑人 id
    selectedEvidence: new Set(), // 推理阶段选中的关键证据 clue.id
    revealed: false, // 是否已揭晓
  };

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
    return `
      <section class="screen home">
        <div class="home-inner">
          <div class="home-mark">🕯️</div>
          <h1 class="home-title">罪案推理<span>·</span>侦探笔记</h1>
          <p class="home-sub">一桩桩以真实历史背景为蓝本改编的谜案。<br>勘查线索、推敲证词，用逻辑揪出真凶。</p>
          <button class="btn btn-primary btn-lg" data-act="start">翻开案件簿</button>
          <div class="home-foot">本作案件为面向游戏体验的戏剧化改编，不涉及任何版权播客内容。</div>
        </div>
      </section>`;
  }

  // ---------- 案件选择 ----------
  function renderCaseSelect() {
    const cards = CASES.map((c) => {
      return `
        <article class="case-card" data-act="open-case" data-id="${c.id}" style="--accent:${c.accent}">
          <div class="case-card-top">
            <span class="case-era">${esc(c.era)}</span>
            <span class="case-diff">${difficultyDots(c.difficulty)}</span>
          </div>
          <h3 class="case-title">${esc(c.title)}</h3>
          <div class="case-subtitle">${esc(c.subtitle)}</div>
          <p class="case-synopsis">${esc(c.synopsis)}</p>
          <div class="case-meta">
            <span>⏱ ${esc(c.duration)}</span>
            <span>👤 ${c.suspects.length} 名嫌疑人</span>
            <span>🔎 ${c.clues.length} 条线索</span>
          </div>
          <div class="case-card-cta">展开调查 →</div>
        </article>`;
    }).join("");
    return `
      <section class="screen">
        <header class="topbar">
          <button class="btn-ghost" data-act="home">← 返回</button>
          <h2 class="topbar-title">案件簿</h2>
          <span></span>
        </header>
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

  // ---------- 启动 ----------
  document.addEventListener("DOMContentLoaded", () => {
    render();
  });
})();
