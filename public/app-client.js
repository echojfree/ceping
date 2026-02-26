/* global Chart */

async function api(path, { method = 'GET', body } = {}) {
  const r = await fetch(path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error('api_error'), { status: r.status, data });
  return data;
}

async function streamPlainText(path, { body, signal, onChunk }) {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
    signal
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`stream_error:${r.status}:${t.slice(0, 200)}`);
  }
  if (!r.body) return;

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const txt = decoder.decode(value, { stream: true });
    if (txt) onChunk?.(txt);
  }
}

function setCoachMood(avatarEl, level) {
  if (!avatarEl) return;
  avatarEl.classList.remove('cv-coach-mood-excellent', 'cv-coach-mood-good', 'cv-coach-mood-poor');
  if (level === 'excellent') avatarEl.classList.add('cv-coach-mood-excellent');
  else if (level === 'good' || level === 'chosen') avatarEl.classList.add('cv-coach-mood-good');
  else if (level === 'poor') avatarEl.classList.add('cv-coach-mood-poor');
  else avatarEl.classList.add('cv-coach-mood-good');
}

function summarizeAnswer(q, value) {
  if (!q) return '';
  if (q.type === 'single') {
    const opt = (q.options ?? []).find((o) => o.id === String(value));
    return opt?.label ? `选择：${opt.label}` : `选择：${String(value)}`;
  }
  if (q.type === 'cmd') {
    const cmd = typeof value === 'string' ? value : String(value?.cmd ?? '');
    return cmd ? `命令：${cmd}` : '命令：';
  }
  if (q.type === 'fill') {
    const fields = value?.fields ?? {};
    const filled = Object.entries(fields)
      .map(([k, v]) => `${k}=${String(v ?? '').trim().slice(0, 18)}`)
      .filter((s) => !s.endsWith('='));
    return filled.length ? `填空：${filled.join('；')}` : '填空：';
  }
  if (q.type === 'drag') {
    const order = value?.order ?? [];
    return Array.isArray(order) && order.length ? `排序：${order.join(' > ')}` : '排序：';
  }
  return '已作答';
}

function initTilt2p5D() {
  const els = Array.from(document.querySelectorAll('[data-cv-tilt]'));
  for (const el of els) {
    if (el.dataset.cvTiltInit === '1') continue;
    el.dataset.cvTiltInit = '1';

    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      const rotY = x * 8;
      const rotX = -y * 8;
      el.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
    });
    el.addEventListener('mouseleave', () => {
      el.style.transform = '';
    });
  }
}

function dimArrayFromPct(pct) {
  const dims = ['R', 'I', 'A', 'S', 'E', 'C'];
  return dims.map((d) => Number(pct?.[d] ?? 0));
}

function setText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}

function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function getAgeGroup() {
  return localStorage.getItem('cv_age_group') || 'secondary';
}

function setAgeGroup(v) {
  localStorage.setItem('cv_age_group', v);
}

function getRoleBriefingState() {
  try {
    return JSON.parse(localStorage.getItem('cv_role_briefing') || 'null');
  } catch {
    return null;
  }
}

function setRoleBriefingState(state) {
  localStorage.setItem('cv_role_briefing', JSON.stringify(state));
}

async function ensureMe() {
  try {
    return await api('/api/auth/me');
  } catch {
    return { user: null, profile: null };
  }
}

function renderMatchedRoleToGenericReport(rec) {
  const role = rec?.matchedRole ?? '未判定';
  const desc = rec?.matchedRoleDesc ?? '';
  setText('cv-matched-role', role);
  setText('cv-matched-role-desc', desc);

  const taskLink = rec?.taskLink;
  if (taskLink) setHtml('cv-task-link', `<a class="underline text-cyan-300" href="${taskLink}">打开进阶任务</a>`);
}

function createOrUpdateRadarChart(canvasId, chartRefKey, pct, color = 'rgba(230, 0, 18, 0.4)', border = '#e60012') {
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return null;
  if (window[chartRefKey]) window[chartRefKey].destroy();
  window[chartRefKey] = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['R', 'I', 'A', 'S', 'E', 'C'],
      datasets: [
        {
          data: dimArrayFromPct(pct),
          backgroundColor: color,
          borderColor: border,
          borderWidth: 2,
          pointBackgroundColor: border
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { r: { ticks: { display: false, min: 0, max: 100 } } },
      plugins: { legend: { display: false } }
    }
  });
  return window[chartRefKey];
}

function renderSkillBars(containerId, skills) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const pct = skills?.pct ?? skills ?? {};
  const labels = {
    data_literacy: '数据素养',
    analysis: '分析推理',
    experiment: '实验验证',
    design_literacy: '视觉表达',
    copywriting: '文案表达',
    communication: '沟通协作',
    empathy: '共情服务',
    process: '流程规范',
    risk_control: '风险合规',
    planning: '目标规划',
    execution: '现场执行',
    store_ops: '门店运营',
    leadership: '推动带队'
  };
  const entries = Object.entries(pct)
    .filter(([k]) => labels[k])
    .map(([k, v]) => [k, Number(v ?? 0)]);
  entries.sort((a, b) => b[1] - a[1]);

  const top = entries.slice(0, 6);
  if (!top.length) {
    el.innerHTML = `<div class="text-gray-400 text-sm">（本模块暂无技能数据）</div>`;
    return;
  }

  el.innerHTML = top
    .map(([k, v]) => {
      const width = Math.max(0, Math.min(100, v));
      return `
        <div class="flex items-center gap-3">
          <div class="w-28 text-xs text-gray-300 font-[monospace]">${labels[k]}</div>
          <div class="flex-1 h-3 bg-gray-800 border border-gray-600 overflow-hidden">
            <div class="h-3 bg-emerald-500" style="width:${width}%"></div>
          </div>
          <div class="w-12 text-right text-xs text-gray-400 font-[monospace]">${width}</div>
        </div>
      `;
    })
    .join('');
}

function renderSkillDeltaBars(containerId, delta) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const labels = {
    data_literacy: '数据素养',
    analysis: '分析推理',
    experiment: '实验验证',
    design_literacy: '视觉表达',
    copywriting: '文案表达',
    communication: '沟通协作',
    empathy: '共情服务',
    process: '流程规范',
    risk_control: '风险合规',
    planning: '目标规划',
    execution: '现场执行',
    store_ops: '门店运营',
    leadership: '推动带队'
  };
  const entries = Object.entries(delta ?? {})
    .map(([k, v]) => [k, Number(v ?? 0)])
    .filter(([k, v]) => labels[k] && v !== 0);
  if (!entries.length) {
    el.innerHTML = '';
    el.classList.add('hidden');
    return;
  }
  entries.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const top = entries.slice(0, 6);
  const maxAbs = Math.max(3, ...top.map(([, v]) => Math.abs(v)));
  el.classList.remove('hidden');
  el.innerHTML = top
    .map(([k, v]) => {
      const width = Math.round((Math.min(Math.abs(v), maxAbs) / maxAbs) * 100);
      const color = v >= 0 ? 'bg-emerald-500' : 'bg-red-500';
      const sign = v > 0 ? `+${v}` : `${v}`;
      return `
        <div class="flex items-center gap-3">
          <div class="w-20 text-[10px] text-gray-300 font-[monospace]">${labels[k]}</div>
          <div class="flex-1 h-2 bg-gray-800 border border-gray-600 overflow-hidden">
            <div class="h-2 ${color}" style="width:${width}%"></div>
          </div>
          <div class="w-10 text-right text-[10px] text-gray-400 font-[monospace]">${sign}</div>
        </div>
      `;
    })
    .join('');
}

function setGenericReportSummary(result) {
  const rec = result?.recommendations;
  const role = rec?.matchedRole ?? '综合方向';
  const summary = rec?.summary ?? '';
  setText('cv-generic-role-title', role);
  setHtml('cv-generic-summary', summary.replaceAll('\n', '<br/>'));

  const link = `/tasks?resultId=${encodeURIComponent(result.id)}`;
  setHtml('cv-task-link', `<a class="underline text-cyan-300" href="${link}" target="_blank">生成/查看进阶任务（含二维码）</a>`);

  const skillNotes = rec?.skillNotes ?? '';
  const el = document.getElementById('cv-skill-notes');
  if (el) el.innerHTML = skillNotes ? skillNotes.replaceAll('\n', '<br/>') : '';

  renderSkillBars('cv-skill-bars', result?.skills);
}

async function loadAssessment(slug) {
  return api(`/api/assessments/${encodeURIComponent(slug)}`);
}

async function submitAssessment(slug, answers) {
  const ageGroup = getAgeGroup();
  const data = await api(`/api/assessments/${encodeURIComponent(slug)}/submit`, {
    method: 'POST',
    body: { ageGroup, answers }
  });
  return data.result;
}

async function evaluateScene(slug, questionId, value) {
  return api(`/api/assessments/${encodeURIComponent(slug)}/evaluate`, {
    method: 'POST',
    body: { questionId, value }
  });
}

function addSkillDelta(acc, delta) {
  if (!delta) return acc;
  const next = { ...(acc ?? {}) };
  for (const [k, v] of Object.entries(delta)) next[k] = Number(next[k] ?? 0) + Number(v ?? 0);
  return next;
}

function formatDelta(delta) {
  if (!delta) return '';
  const entries = Object.entries(delta)
    .map(([k, v]) => [k, Number(v ?? 0)])
    .filter(([, v]) => v !== 0);
  if (!entries.length) return '';
  entries.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  return entries
    .slice(0, 4)
    .map(([k, v]) => `${k}${v > 0 ? `+${v}` : `${v}`}`)
    .join(' · ');
}

// Expose to existing inline prototype scripts
window.CareerVerse = {
  state: {
    ecomStory: null,
    ecomData: null,
    ecomCreative: null,
    ecomFrontline: null,
    lastResult: null
  },

  async init() {
    // Ensure age group has some reasonable value
    if (!localStorage.getItem('cv_age_group')) setAgeGroup('secondary');

    // Preload assessment IDs/questions for the prototype flows
    try {
      const story = await loadAssessment('ecom-story');
      this.state.ecomStory = story;
    } catch {}
    try {
      const data = await loadAssessment('ecom-data-ops');
      this.state.ecomData = data;
    } catch {}
    try {
      const creative = await loadAssessment('ecom-creative-lab');
      this.state.ecomCreative = creative;
    } catch {}
    try {
      const frontline = await loadAssessment('ecom-frontline');
      this.state.ecomFrontline = frontline;
    } catch {}

    // Surface a simple age group selector (non-blocking)
    const holder = document.getElementById('cv-age-holder');
    if (holder) {
      holder.innerHTML = `
        <label class="text-xs text-gray-400 font-[monospace]">年龄段：</label>
        <select id="cv-age" class="ml-2 bg-black/40 border border-white/20 px-2 py-1 text-sm">
          <option value="primary">小学</option>
          <option value="middle">中学</option>
          <option value="secondary">中职/高中</option>
          <option value="adult">成人</option>
        </select>
        <div class="mt-2">
          <a class="underline text-cyan-300 text-sm font-[monospace]" href="/quiz">进入通用快速测评（RIASEC）</a>
        </div>
      `;
      const sel = document.getElementById('cv-age');
      sel.value = getAgeGroup();
      sel.addEventListener('change', () => setAgeGroup(sel.value));
    }

    updateBriefingStatusUI();
  },

  scenario: {
    mode: null, // 'creative' | 'frontline'
    slug: null,
    assessment: null,
    index: 0,
    answers: [],
    pickedByQuestionId: new Map(),
    draftsByQuestionId: new Map(),
    accumSkills: {},
    accumRiasec: {},
    coachAbort: null
  },

  startCreativeLab() {
    this._startScenario({
      mode: 'creative',
      slug: 'ecom-creative-lab',
      screenId: 'screen-creative-lab',
      promptId: 'cv-cre-prompt',
      optionsId: 'cv-cre-options',
      feedbackId: 'cv-cre-feedback',
      progressId: 'cv-cre-progress',
      nextLabelId: 'cv-cre-next'
    });
  },

  startFrontline() {
    this._startScenario({
      mode: 'frontline',
      slug: 'ecom-frontline',
      screenId: 'screen-frontline',
      promptId: 'cv-fr-prompt',
      optionsId: 'cv-fr-options',
      feedbackId: 'cv-fr-feedback',
      progressId: 'cv-fr-progress',
      nextLabelId: 'cv-fr-next'
    });
  },

  async _startScenario(cfg) {
    try {
      this.scenario.coachAbort?.abort?.();
    } catch {}
    this.scenario.mode = cfg.mode;
    this.scenario.slug = cfg.slug;
    this.scenario.index = 0;
    this.scenario.answers = [];
    this.scenario.pickedByQuestionId = new Map();
    this.scenario.draftsByQuestionId = new Map();

    const assessment =
      cfg.slug === 'ecom-creative-lab'
        ? this.state.ecomCreative
        : cfg.slug === 'ecom-frontline'
          ? this.state.ecomFrontline
          : null;

    if (!assessment) {
      alert('模块加载失败：请确认后端已启动并完成数据库迁移。');
      return;
    }
    this.scenario.assessment = assessment;
    this.scenario.accumSkills = {};
    this.scenario.accumRiasec = {};
    this.scenario.coachAbort = null;
    window.switchScreen?.(cfg.screenId);
    this._renderScenario(cfg);
  },

  _scenarioCfg(mode) {
    if (mode === 'creative')
      return {
        screenId: 'screen-creative-lab',
        promptId: 'cv-cre-prompt',
        optionsId: 'cv-cre-options',
        feedbackId: 'cv-cre-feedback',
        coachTextId: 'cv-cre-coach-text',
        coachAvatarId: 'cv-cre-coach-avatar',
        progressId: 'cv-cre-progress',
        nextLabelId: 'cv-cre-next'
      };
    return {
      screenId: 'screen-frontline',
      promptId: 'cv-fr-prompt',
      optionsId: 'cv-fr-options',
      feedbackId: 'cv-fr-feedback',
      coachTextId: 'cv-fr-coach-text',
      coachAvatarId: 'cv-fr-coach-avatar',
      progressId: 'cv-fr-progress',
      nextLabelId: 'cv-fr-next'
    };
  },

  _streamCoachToPanel({ coachTextId, coachAvatarId, payload, moodLevel, storeKey }) {
    const textEl = document.getElementById(coachTextId);
    const avatarEl = document.getElementById(coachAvatarId);
    if (avatarEl) setCoachMood(avatarEl, moodLevel);
    if (textEl) textEl.textContent = '';

    const abort = new AbortController();
    if (storeKey === 'scenario') {
      try {
        this.scenario.coachAbort?.abort?.();
      } catch {}
      this.scenario.coachAbort = abort;
    } else if (storeKey === 'dataOps') {
      try {
        this.dataOps.coachAbort?.abort?.();
      } catch {}
      this.dataOps.coachAbort = abort;
    }

    streamPlainText('/api/ai/coach/stream', {
      body: payload,
      signal: abort.signal,
      onChunk: (chunk) => {
        if (!textEl) return;
        textEl.textContent += chunk;
      }
    }).catch(async () => {
      // Non-stream fallback
      try {
        const r = await api('/api/ai/coach', { method: 'POST', body: payload });
        if (textEl) textEl.textContent = r?.reply?.content ?? 'AI教练暂时离线。';
      } catch {
        if (textEl) textEl.textContent = 'AI教练暂时离线。';
      }
    });
  },

  _renderScenario(cfg) {
    const mode = cfg?.mode ?? this.scenario.mode;
    const ui = cfg ?? this._scenarioCfg(mode);
    const assessment = this.scenario.assessment;
    const q = assessment?.questions?.[this.scenario.index];
    if (!q) return;

    const promptEl = document.getElementById(ui.promptId);
    const optionsEl = document.getElementById(ui.optionsId);
    const feedbackEl = document.getElementById(ui.feedbackId);
    const progressEl = document.getElementById(ui.progressId);
    const nextLabelEl = document.getElementById(ui.nextLabelId);

    if (progressEl) progressEl.textContent = `SCENE ${this.scenario.index + 1}/${assessment.questions.length}`;
    if (promptEl) promptEl.textContent = q.prompt;

    const picked = this.scenario.pickedByQuestionId.get(q.id);
    if (feedbackEl) {
      feedbackEl.classList.toggle('hidden', !picked);
      const label = q.type === 'single' ? `已记录选择：${picked}` : '已记录本幕提交';
      feedbackEl.textContent = picked ? label : '';
    }

    if (nextLabelEl) nextLabelEl.textContent = this.scenario.index === assessment.questions.length - 1 ? '结算报告' : '下一幕';

    const tone =
      mode === 'creative'
        ? { pill: 'bg-red-600', border: 'border-red-600', badge: 'bg-pink-500' }
        : { pill: 'bg-green-600', border: 'border-green-600', badge: 'bg-green-500' };

    if (q.type === 'single') {
      optionsEl.innerHTML = (q.options ?? [])
        .map((o) => {
          const isPicked = picked === o.id;
          return `
            <button class="skew-box btn-hacker py-5 text-xl text-left pl-6 group ${isPicked ? 'border-emerald-400' : ''}" onclick="window.CareerVerse?.scenarioPick?.('${mode}','${q.id}','${o.id}')">
              <span class="unskew-text flex items-center gap-3">
                <span class="${tone.badge} text-black px-2 py-1 text-sm font-bold rounded font-[monospace]">${o.id}</span>
                ${escapeHtml(o.label)}
              </span>
            </button>
          `;
        })
        .join('');
      return;
    }

    if (q.type === 'drag') {
      const items = q.options?.items ?? [];
      const saved = picked?.order;
      const draft = this.scenario.draftsByQuestionId.get(q.id)?.order ?? (Array.isArray(saved) ? saved : items.map((it) => it.id));
      const idToLabel = new Map(items.map((it) => [it.id, it.label]));

      optionsEl.innerHTML = `
        <div class="bg-black/50 border border-white/10 p-4 mb-4">
          <div class="text-gray-400 text-sm font-[monospace]">TASK: ORDER</div>
          <div class="text-white text-xl font-bold">把条目按优先级排序（支持上下移动）。</div>
        </div>
        <div class="flex flex-col gap-3" data-cv-task="drag">
          ${draft
            .map((id, idx) => {
              const label = idToLabel.get(id) ?? id;
              return `
                <div class="bg-black border-2 border-white/10 p-4 flex items-center justify-between gap-4 skew-box">
                  <div class="unskew-text flex items-center gap-3">
                    <span class="bg-white text-black px-2 py-1 font-bold font-[monospace]">${idx + 1}</span>
                    <span class="text-xl text-gray-200">${escapeHtml(label)}</span>
                  </div>
                  <div class="flex items-center gap-2 unskew-text">
                    <button class="btn-hacker px-4 py-2 text-sm font-bold" onclick="window.CareerVerse?.scenarioMoveDrag?.('${mode}','${q.id}',${idx},${idx - 1})">上移</button>
                    <button class="btn-hacker px-4 py-2 text-sm font-bold" onclick="window.CareerVerse?.scenarioMoveDrag?.('${mode}','${q.id}',${idx},${idx + 1})">下移</button>
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
        <div class="mt-4 flex justify-end">
          <button class="btn-p5 px-8 py-3 text-xl font-bold skew-box" onclick="window.CareerVerse?.scenarioConfirmDrag?.('${mode}','${q.id}')">
            <span class="unskew-text">提交本幕排序</span>
          </button>
        </div>
      `;
      return;
    }

    if (q.type === 'fill') {
      const fields = q.options?.fields ?? [];
      const savedFields = picked?.fields ?? {};
      const draftFields = this.scenario.draftsByQuestionId.get(q.id)?.fields ?? savedFields;
      optionsEl.innerHTML = `
        <div class="bg-black/50 border border-white/10 p-4 mb-4">
          <div class="text-gray-400 text-sm font-[monospace]">TASK: FILL</div>
          <div class="text-white text-xl font-bold">按提示填空，完成可执行的输出。</div>
        </div>
        <div class="grid grid-cols-1 gap-4" data-cv-task="fill">
          ${fields
            .map((f) => {
              const v = String(draftFields?.[f.key] ?? '');
              return `
                <label class="block">
                  <div class="text-gray-300 text-sm mb-2 font-[monospace]">${escapeHtml(f.label)}</div>
                  <input
                    class="w-full px-4 py-3 rounded bg-black/70 border border-white/10 text-lg"
                    value="${escapeHtml(v)}"
                    placeholder="${escapeHtml(f.placeholder ?? '')}"
                    oninput="window.CareerVerse?.scenarioSetField?.('${mode}','${q.id}','${f.key}', this.value)"
                  />
                </label>
              `;
            })
            .join('')}
        </div>
        <div class="mt-4 flex justify-end">
          <button class="btn-p5 px-8 py-3 text-xl font-bold skew-box" onclick="window.CareerVerse?.scenarioConfirmFill?.('${mode}','${q.id}')">
            <span class="unskew-text">提交本幕文本</span>
          </button>
        </div>
      `;
      return;
    }

    // Unknown type: fallback
    optionsEl.innerHTML = `<div class="text-gray-400">未知题型：${escapeHtml(q.type)}</div>`;
  },

  scenarioPick(mode, questionId, optionId) {
    const assessment = this.scenario.assessment;
    const q = assessment?.questions?.[this.scenario.index];
    if (!q || q.id !== questionId) return;
    this.scenario.pickedByQuestionId.set(questionId, optionId);
    const ui = this._scenarioCfg(mode);
    const sceneIndex = this.scenario.index;
    // Async evaluate for instant feedback
    evaluateScene(this.scenario.slug, questionId, optionId)
      .then((r) => {
        if (this.scenario.index !== sceneIndex) return;
        const ev = r?.evaluation;
        this.scenario.accumSkills = addSkillDelta(this.scenario.accumSkills, ev?.skillsDelta);
        this.scenario.accumRiasec = addSkillDelta(this.scenario.accumRiasec, ev?.riasecDelta);
        const feedbackEl = document.getElementById(ui.feedbackId);
        if (feedbackEl) {
          const extra = formatDelta(ev?.skillsDelta);
          feedbackEl.classList.remove('hidden');
          feedbackEl.textContent = (ev?.feedback || '系统已记录。') + (extra ? `（技能：${extra}）` : '');
        }

        this._streamCoachToPanel({
          coachTextId: ui.coachTextId,
          coachAvatarId: ui.coachAvatarId,
          moodLevel: ev?.level ?? 'chosen',
          storeKey: 'scenario',
          payload: {
            moduleSlug: this.scenario.slug,
            scenePrompt: q.prompt,
            sceneIndex: this.scenario.index,
            sceneTotal: assessment?.questions?.length ?? 0,
            answerSummary: summarizeAnswer(q, optionId),
            evaluation: ev
          }
        });
      })
      .catch(() => {});
    this._renderScenario({ mode, ...ui });
  },

  scenarioMoveDrag(mode, questionId, fromIdx, toIdx) {
    const assessment = this.scenario.assessment;
    const q = assessment?.questions?.[this.scenario.index];
    if (!q || q.id !== questionId || q.type !== 'drag') return;

    const items = q.options?.items ?? [];
    const saved = this.scenario.pickedByQuestionId.get(q.id)?.order;
    const current = this.scenario.draftsByQuestionId.get(q.id)?.order ?? (Array.isArray(saved) ? saved : items.map((it) => it.id));
    if (toIdx < 0 || toIdx >= current.length) return;

    const next = [...current];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    this.scenario.draftsByQuestionId.set(q.id, { ...(this.scenario.draftsByQuestionId.get(q.id) ?? {}), order: next });
    const ui = this._scenarioCfg(mode);
    this._renderScenario({ mode, ...ui });
  },

  scenarioConfirmDrag(mode, questionId) {
    const assessment = this.scenario.assessment;
    const q = assessment?.questions?.[this.scenario.index];
    if (!q || q.id !== questionId || q.type !== 'drag') return;
    const items = q.options?.items ?? [];
    const draft = this.scenario.draftsByQuestionId.get(q.id)?.order ?? items.map((it) => it.id);
    if (!Array.isArray(draft) || !draft.length) return;
    this.scenario.pickedByQuestionId.set(q.id, { order: draft });
    const ui = this._scenarioCfg(mode);
    const sceneIndex = this.scenario.index;
    evaluateScene(this.scenario.slug, q.id, { order: draft })
      .then((r) => {
        if (this.scenario.index !== sceneIndex) return;
        const ev = r?.evaluation;
        this.scenario.accumSkills = addSkillDelta(this.scenario.accumSkills, ev?.skillsDelta);
        this.scenario.accumRiasec = addSkillDelta(this.scenario.accumRiasec, ev?.riasecDelta);
        const feedbackEl = document.getElementById(this._scenarioCfg(mode).feedbackId);
        if (feedbackEl) {
          const level = ev?.level ?? '';
          const extra = formatDelta(ev?.skillsDelta);
          feedbackEl.classList.remove('hidden');
          feedbackEl.textContent = `[${level}] ` + (ev?.feedback || '已提交排序。') + (extra ? `（技能：${extra}）` : '');
        }
        this._streamCoachToPanel({
          coachTextId: ui.coachTextId,
          coachAvatarId: ui.coachAvatarId,
          moodLevel: ev?.level ?? 'good',
          storeKey: 'scenario',
          payload: {
            moduleSlug: this.scenario.slug,
            scenePrompt: q.prompt,
            sceneIndex: this.scenario.index,
            sceneTotal: assessment?.questions?.length ?? 0,
            answerSummary: summarizeAnswer(q, { order: draft }),
            evaluation: ev
          }
        });
      })
      .catch(() => {});
    this._renderScenario({ mode, ...ui });
  },

  scenarioSetField(mode, questionId, key, value) {
    const assessment = this.scenario.assessment;
    const q = assessment?.questions?.[this.scenario.index];
    if (!q || q.id !== questionId || q.type !== 'fill') return;
    const prev = this.scenario.draftsByQuestionId.get(q.id)?.fields ?? {};
    const next = { ...prev, [key]: value };
    this.scenario.draftsByQuestionId.set(q.id, { ...(this.scenario.draftsByQuestionId.get(q.id) ?? {}), fields: next });
  },

  scenarioConfirmFill(mode, questionId) {
    const assessment = this.scenario.assessment;
    const q = assessment?.questions?.[this.scenario.index];
    if (!q || q.id !== questionId || q.type !== 'fill') return;
    const draftFields = this.scenario.draftsByQuestionId.get(q.id)?.fields ?? {};
    const fieldDefs = q.options?.fields ?? [];
    const filled = fieldDefs.filter((f) => String(draftFields?.[f.key] ?? '').trim().length >= 1).length;
    if (filled < 1) return;
    this.scenario.pickedByQuestionId.set(q.id, { fields: draftFields });
    const ui = this._scenarioCfg(mode);
    const sceneIndex = this.scenario.index;
    evaluateScene(this.scenario.slug, q.id, { fields: draftFields })
      .then((r) => {
        if (this.scenario.index !== sceneIndex) return;
        const ev = r?.evaluation;
        this.scenario.accumSkills = addSkillDelta(this.scenario.accumSkills, ev?.skillsDelta);
        this.scenario.accumRiasec = addSkillDelta(this.scenario.accumRiasec, ev?.riasecDelta);
        const feedbackEl = document.getElementById(this._scenarioCfg(mode).feedbackId);
        if (feedbackEl) {
          const level = ev?.level ?? '';
          const extra = formatDelta(ev?.skillsDelta);
          feedbackEl.classList.remove('hidden');
          feedbackEl.textContent = `[${level}] ` + (ev?.feedback || '已提交文本。') + (extra ? `（技能：${extra}）` : '');
        }
        this._streamCoachToPanel({
          coachTextId: ui.coachTextId,
          coachAvatarId: ui.coachAvatarId,
          moodLevel: ev?.level ?? 'good',
          storeKey: 'scenario',
          payload: {
            moduleSlug: this.scenario.slug,
            scenePrompt: q.prompt,
            sceneIndex: this.scenario.index,
            sceneTotal: assessment?.questions?.length ?? 0,
            answerSummary: summarizeAnswer(q, { fields: draftFields }),
            evaluation: ev
          }
        });
      })
      .catch(() => {});
    this._renderScenario({ mode, ...ui });
  },

  async scenarioNext(mode) {
    const ui = this._scenarioCfg(mode);
    const assessment = this.scenario.assessment;
    const q = assessment?.questions?.[this.scenario.index];
    if (!q) return;
    const picked = this.scenario.pickedByQuestionId.get(q.id);
    if (!picked) return;

    if (this.scenario.index < assessment.questions.length - 1) {
      this.scenario.index += 1;
      this._renderScenario({ mode, ...ui });
      return;
    }

    // submit
    const answers = assessment.questions.map((qq) => ({
      questionId: qq.id,
      value: this.scenario.pickedByQuestionId.get(qq.id)
    }));
    const result = await submitAssessment(this.scenario.slug, answers);
    this.state.lastResult = result;
    window.switchScreen?.('screen-report-generic');
  },

  scenarioBack(mode) {
    const assessment = this.scenario.assessment;
    if (!assessment) return;
    this.scenario.index = Math.max(0, this.scenario.index - 1);
    const ui = this._scenarioCfg(mode);
    this._renderScenario({ mode, ...ui });
  },

  dataOps: {
    index: 0,
    pickedByQuestionId: new Map(),
    draftsByQuestionId: new Map(),
    accumSkills: {},
    accumRiasec: {},
    coachAbort: null,
    running: false
  },

  dataOpsBegin() {
    const assessment = this.state.ecomData;
    if (!assessment?.questions?.length) {
      const prompt = document.getElementById('cv-dataops-prompt');
      if (prompt) prompt.textContent = '模块加载失败：请刷新或确认后端已更新。';
      return;
    }
    this.dataOps.index = 0;
    this.dataOps.pickedByQuestionId = new Map();
    this.dataOps.draftsByQuestionId = new Map();
    this.dataOps.accumSkills = {};
    this.dataOps.accumRiasec = {};
    this.dataOps.coachAbort = null;
    this.dataOps.running = true;
    const fb = document.getElementById('cv-dataops-feedback');
    if (fb) fb.classList.add('hidden');
    renderSkillDeltaBars('cv-dataops-skill-delta', {});
    this._renderDataOpsQuestion();
  },

  _renderDataOpsQuestion() {
    const assessment = this.state.ecomData;
    const q = assessment?.questions?.[this.dataOps.index];
    if (!q) return;

    const promptEl = document.getElementById('cv-dataops-prompt');
    if (promptEl) promptEl.textContent = `第 ${this.dataOps.index + 1}/${assessment.questions.length} 幕：${q.prompt}`;

    const box = document.getElementById('action-buttons');
    if (!box) return;
    const picked = this.dataOps.pickedByQuestionId.get(q.id);

    if (q.type === 'single') {
      box.innerHTML = (q.options ?? [])
        .map((o) => {
          const selected = picked === o.id;
          const cmd =
            o.id === 'I' ? 'analyze.funnel --deep' : o.id === 'C' ? 'guardrail.stoploss --apply' : 'bid.increase --max_budget';
          const hint =
            o.id === 'I'
              ? 'I/C：定位链路与验证假设'
              : o.id === 'C'
                ? 'C：先控风险再优化'
                : 'E：目标导向强推进';

          return `
            <button class="btn-cmd flex flex-col p-4 text-left rounded shadow-lg ${selected ? 'border-emerald-400' : ''}" onclick="window.CareerVerse?.dataOpsPick?.('${q.id}','${o.id}')">
              <span class="font-bold text-white font-sans text-lg mb-1">${escapeHtml(o.label)}</span>
              <span class="text-xs text-cyan-400">> ${cmd}</span>
              <div class="mt-2 text-xs text-gray-500 font-sans bg-black/50 p-1 rounded">${hint}</div>
            </button>
          `;
        })
        .join('');
      return;
    }

    if (q.type === 'cmd') {
      const v = String(picked?.cmd ?? picked ?? '');
      const placeholder = q.options?.placeholder ?? '例如：analyze.funnel --by=channel';
      box.innerHTML = `
        <div class="cyber-panel p-4">
          <div class="text-xs text-yellow-400 font-mono mb-2">> INPUT_COMMAND</div>
          <input id="cv-dataops-cmd" class="w-full px-3 py-2 bg-black border border-yellow-500/40 text-yellow-200 font-mono" value="${escapeHtml(v)}" placeholder="${escapeHtml(placeholder)}" />
          <div class="mt-3 flex justify-end">
            <button class="btn-cmd px-6 py-3 font-bold text-lg font-mono text-emerald-500" onclick="window.CareerVerse?.dataOpsRunCmd?.('${q.id}')">RUN</button>
          </div>
        </div>
      `;
      return;
    }

    if (q.type === 'drag') {
      const items = q.options?.items ?? [];
      const saved = picked?.order;
      const draft = this.dataOps.draftsByQuestionId?.get?.(q.id)?.order ?? (Array.isArray(saved) ? saved : items.map((it) => it.id));
      const idToLabel = new Map(items.map((it) => [it.id, it.label]));
      box.innerHTML = `
        <div class="cyber-panel p-4">
          <div class="text-xs text-cyan-400 font-mono mb-2">> ORDER_STEPS</div>
          <div class="flex flex-col gap-2">
            ${draft
              .map((id, idx) => {
                const label = idToLabel.get(id) ?? id;
                return `
                  <div class="flex items-center justify-between gap-3 border border-cyan-500/20 bg-black/60 p-3">
                    <div class="text-sm text-cyan-200 font-mono">${idx + 1}. ${escapeHtml(label)}</div>
                    <div class="flex gap-2">
                      <button class="btn-cmd px-3 py-1 text-sm font-mono" onclick="window.CareerVerse?.dataOpsMoveDrag?.('${q.id}',${idx},${idx - 1})">UP</button>
                      <button class="btn-cmd px-3 py-1 text-sm font-mono" onclick="window.CareerVerse?.dataOpsMoveDrag?.('${q.id}',${idx},${idx + 1})">DN</button>
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
          <div class="mt-3 flex justify-end">
            <button class="btn-cmd px-6 py-3 font-bold text-lg font-mono text-emerald-500" onclick="window.CareerVerse?.dataOpsConfirmDrag?.('${q.id}')">COMMIT</button>
          </div>
        </div>
      `;
      return;
    }

    box.innerHTML = `<div class="text-gray-400 font-mono">Unsupported task: ${escapeHtml(q.type)}</div>`;
  },

  dataOpsPick(questionId, optionId) {
    const assessment = this.state.ecomData;
    const q = assessment?.questions?.[this.dataOps.index];
    if (!q || q.id !== questionId || q.type !== 'single') return;

    // hide crisis overlay once the player acts
    const overlay = document.getElementById('crisis-overlay');
    if (overlay) overlay.classList.add('opacity-0');

    this.dataOps.pickedByQuestionId.set(questionId, optionId);
    this._renderDataOpsQuestion();

    const chatLog = document.getElementById('chat-log');
    if (chatLog) {
      const who = optionId === 'I' ? 'ANALYST' : optionId === 'C' ? 'CONTROLLER' : 'OPERATOR';
      chatLog.innerHTML += `<div class="text-emerald-400 mt-2 p-2 border border-emerald-500/40 bg-black text-sm font-mono">> [${who}] ${escapeHtml(q.prompt)} => ${escapeHtml(optionId)}</div>`;
      chatLog.scrollTop = chatLog.scrollHeight;
    }

    evaluateScene('ecom-data-ops', questionId, optionId)
      .then((r) => {
        const ev = r?.evaluation;
        this.dataOps.accumSkills = addSkillDelta(this.dataOps.accumSkills, ev?.skillsDelta);
        this.dataOps.accumRiasec = addSkillDelta(this.dataOps.accumRiasec, ev?.riasecDelta);
        const fb = document.getElementById('cv-dataops-feedback');
        const extra = formatDelta(ev?.skillsDelta);
        if (fb) {
          fb.classList.remove('hidden');
          fb.textContent = `[${ev?.level ?? 'chosen'}] ` + (ev?.feedback || '系统已记录。') + (extra ? `（技能：${extra}）` : '');
        }
        renderSkillDeltaBars('cv-dataops-skill-delta', this.dataOps.accumSkills);
        const chatLog2 = document.getElementById('chat-log');
        if (chatLog2) {
          chatLog2.innerHTML += `<div class="text-yellow-300 mt-2 p-2 border border-yellow-500/40 bg-black text-sm font-mono">> [EVAL ${escapeHtml(ev?.level ?? 'chosen')}] ${escapeHtml(ev?.feedback || 'OK')}</div>`;
          chatLog2.scrollTop = chatLog2.scrollHeight;
        }

        this._streamCoachToPanel({
          coachTextId: 'cv-dataops-coach-text',
          coachAvatarId: 'cv-dataops-coach-avatar',
          moodLevel: ev?.level ?? 'chosen',
          storeKey: 'dataOps',
          payload: {
            moduleSlug: 'ecom-data-ops',
            scenePrompt: q.prompt,
            sceneIndex: this.dataOps.index,
            sceneTotal: assessment?.questions?.length ?? 0,
            answerSummary: summarizeAnswer(q, optionId),
            evaluation: ev
          }
        });
      })
      .catch(() => {});

    // auto-advance after a short delay
    setTimeout(() => this.dataOpsNext(), 1100);
  },

  dataOpsRunCmd(questionId) {
    const assessment = this.state.ecomData;
    const q = assessment?.questions?.[this.dataOps.index];
    if (!q || q.id !== questionId || q.type !== 'cmd') return;

    const input = document.getElementById('cv-dataops-cmd');
    const cmd = String(input?.value ?? '').trim();
    if (!cmd) return;
    this.dataOps.pickedByQuestionId.set(questionId, { cmd });

    const chatLog = document.getElementById('chat-log');
    if (chatLog) {
      chatLog.innerHTML += `<div class="text-cyan-400 mt-2 p-2 border border-cyan-500/40 bg-black text-sm font-mono">> ${escapeHtml(cmd)}</div>`;
      chatLog.scrollTop = chatLog.scrollHeight;
    }

    evaluateScene('ecom-data-ops', questionId, { cmd })
      .then((r) => {
        const ev = r?.evaluation;
        this.dataOps.accumSkills = addSkillDelta(this.dataOps.accumSkills, ev?.skillsDelta);
        this.dataOps.accumRiasec = addSkillDelta(this.dataOps.accumRiasec, ev?.riasecDelta);
        const fb = document.getElementById('cv-dataops-feedback');
        const extra = formatDelta(ev?.skillsDelta);
        if (fb) {
          fb.classList.remove('hidden');
          fb.textContent = `[${ev?.level ?? ''}] ` + (ev?.feedback || '系统已记录。') + (extra ? `（技能：${extra}）` : '');
        }
        renderSkillDeltaBars('cv-dataops-skill-delta', this.dataOps.accumSkills);
        const chatLog2 = document.getElementById('chat-log');
        if (chatLog2) {
          chatLog2.innerHTML += `<div class="text-yellow-300 mt-2 p-2 border border-yellow-500/40 bg-black text-sm font-mono">> [EVAL ${escapeHtml(ev?.level ?? '')}] ${escapeHtml(ev?.feedback || 'OK')}</div>`;
          chatLog2.scrollTop = chatLog2.scrollHeight;
        }

        this._streamCoachToPanel({
          coachTextId: 'cv-dataops-coach-text',
          coachAvatarId: 'cv-dataops-coach-avatar',
          moodLevel: ev?.level ?? 'good',
          storeKey: 'dataOps',
          payload: {
            moduleSlug: 'ecom-data-ops',
            scenePrompt: q.prompt,
            sceneIndex: this.dataOps.index,
            sceneTotal: assessment?.questions?.length ?? 0,
            answerSummary: summarizeAnswer(q, { cmd }),
            evaluation: ev
          }
        });
      })
      .catch(() => {});

    setTimeout(() => this.dataOpsNext(), 900);
  },

  dataOpsMoveDrag(questionId, fromIdx, toIdx) {
    const assessment = this.state.ecomData;
    const q = assessment?.questions?.[this.dataOps.index];
    if (!q || q.id !== questionId || q.type !== 'drag') return;
    if (!this.dataOps.draftsByQuestionId) this.dataOps.draftsByQuestionId = new Map();

    const items = q.options?.items ?? [];
    const saved = this.dataOps.pickedByQuestionId.get(q.id)?.order;
    const current =
      this.dataOps.draftsByQuestionId.get(q.id)?.order ?? (Array.isArray(saved) ? saved : items.map((it) => it.id));
    if (toIdx < 0 || toIdx >= current.length) return;

    const next = [...current];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    this.dataOps.draftsByQuestionId.set(q.id, { ...(this.dataOps.draftsByQuestionId.get(q.id) ?? {}), order: next });
    this._renderDataOpsQuestion();
  },

  dataOpsConfirmDrag(questionId) {
    const assessment = this.state.ecomData;
    const q = assessment?.questions?.[this.dataOps.index];
    if (!q || q.id !== questionId || q.type !== 'drag') return;
    const items = q.options?.items ?? [];
    const order = this.dataOps.draftsByQuestionId.get(q.id)?.order ?? items.map((it) => it.id);
    if (!Array.isArray(order) || !order.length) return;
    this.dataOps.pickedByQuestionId.set(questionId, { order });

    evaluateScene('ecom-data-ops', questionId, { order })
      .then((r) => {
        const ev = r?.evaluation;
        this.dataOps.accumSkills = addSkillDelta(this.dataOps.accumSkills, ev?.skillsDelta);
        this.dataOps.accumRiasec = addSkillDelta(this.dataOps.accumRiasec, ev?.riasecDelta);
        const fb = document.getElementById('cv-dataops-feedback');
        const extra = formatDelta(ev?.skillsDelta);
        if (fb) {
          fb.classList.remove('hidden');
          fb.textContent = `[${ev?.level ?? ''}] ` + (ev?.feedback || '系统已记录。') + (extra ? `（技能：${extra}）` : '');
        }
        renderSkillDeltaBars('cv-dataops-skill-delta', this.dataOps.accumSkills);
        const chatLog2 = document.getElementById('chat-log');
        if (chatLog2) {
          chatLog2.innerHTML += `<div class="text-yellow-300 mt-2 p-2 border border-yellow-500/40 bg-black text-sm font-mono">> [EVAL ${escapeHtml(ev?.level ?? '')}] ${escapeHtml(ev?.feedback || 'OK')}</div>`;
          chatLog2.scrollTop = chatLog2.scrollHeight;
        }

        this._streamCoachToPanel({
          coachTextId: 'cv-dataops-coach-text',
          coachAvatarId: 'cv-dataops-coach-avatar',
          moodLevel: ev?.level ?? 'good',
          storeKey: 'dataOps',
          payload: {
            moduleSlug: 'ecom-data-ops',
            scenePrompt: q.prompt,
            sceneIndex: this.dataOps.index,
            sceneTotal: assessment?.questions?.length ?? 0,
            answerSummary: summarizeAnswer(q, { order }),
            evaluation: ev
          }
        });
      })
      .catch(() => {});

    setTimeout(() => this.dataOpsNext(), 1000);
  },

  async dataOpsNext() {
    const assessment = this.state.ecomData;
    const q = assessment?.questions?.[this.dataOps.index];
    if (!q) return;
    const picked = this.dataOps.pickedByQuestionId.get(q.id);
    if (!picked) return;

    if (this.dataOps.index < assessment.questions.length - 1) {
      this.dataOps.index += 1;
      this._renderDataOpsQuestion();
      return;
    }

    const answers = assessment.questions.map((qq) => ({
      questionId: qq.id,
      value: this.dataOps.pickedByQuestionId.get(qq.id)
    }));
    try {
      const result = await submitAssessment('ecom-data-ops', answers);
      this.state.lastResult = result;
    } catch (e) {
      // still proceed to report screen; the report will show fallback text if result missing
    }
    window.switchScreen?.('screen-report-data');
  },

  onEnterGenericReport() {
    const result = this.state.lastResult;
    if (!result) return;
    setGenericReportSummary(result);
    createOrUpdateRadarChart('hollandChartGeneric', '__cv_chart_generic', result.pct);
  },

  onEnterDataReport() {
    const result = this.state.lastResult;
    if (!result) return;
    createOrUpdateRadarChart('hollandChartData', '__cv_chart_data', result.pct, 'rgba(16, 185, 129, 0.3)', '#10b981');
    const rec = result.recommendations;
    const txt = (rec?.summary ?? '').replaceAll('\n', '<br/>') + (rec?.skillNotes ? `<br/><br/>${rec.skillNotes.replaceAll('\n','<br/>')}` : '');
    const area = document.getElementById('report-typing-area');
    if (area) area.innerHTML = txt;
    const task = rec?.tasks?.[0]?.title ?? '专属进阶实训任务已生成';
    setText('task-title', task);
    renderSkillBars('cv-skill-bars-data', result?.skills);
  }
};

window.addEventListener('DOMContentLoaded', () => {
  window.CareerVerse?.init?.();
  initTilt2p5D();
});

// -----------------------------------------------------------------------------
// Role Briefing (Job Awareness) - keeps the same cyber/P5 vibe but adds cognition
// -----------------------------------------------------------------------------

const ROLE_DATA = [
  {
    id: 'product',
    name: '产品开发',
    zone: '创意工坊区 / 流量中枢塔',
    riasec: 'I / C',
    color: 'cyan',
    tagline: '把“好卖的东西”找出来，并把它做成能复购的产品。',
    do: ['选品与竞品对比', '定价与利润核算', '卖点提炼与版本迭代', '供应链协同与风险预案'],
    tools: ['对比表', '用户评价关键词', '利润表', '小实验/AB测试'],
    kpi: ['毛利率', '动销', '退货率', '差评率', '复购率'],
    mistakes: ['只凭感觉选品', '只看销量不看利润', '忽略售后与复购成本'],
    microtask: '任选一个商品：写出 3 个竞品差异点 + 1 个“可验证的改进假设”。'
  },
  {
    id: 'design',
    name: '视觉设计',
    zone: '创意工坊区',
    riasec: 'A / I',
    color: 'red',
    tagline: '用排版、配色与动效，把卖点变成“想点、想买”。',
    do: ['主图/详情页信息层级', '活动页版式与动效', '品牌统一视觉规范', '用数据复盘改图改文案'],
    tools: ['Figma/Canva', '参考库', '版式栅格', 'CTR复盘'],
    kpi: ['CTR点击率', '停留时长', '加购率', '跳失率'],
    mistakes: ['只追求“好看”不突出卖点', '信息堆满导致看不懂', '不做复盘只改风格'],
    microtask: '把一句卖点改成“3秒看懂”的主图文案结构：标题+利益点+佐证。'
  },
  {
    id: 'cs',
    name: '客户服务',
    zone: '前线交易所',
    riasec: 'S / R',
    color: 'green',
    tagline: '把情绪稳住，把问题闭环，把复购拉回来。',
    do: ['客诉安抚与话术体系', '售后问题定位与反馈', '差评拦截与复购引导', '跨部门协同推进解决'],
    tools: ['话术库', '工单/表格', '复盘模板', '同理心表达'],
    kpi: ['响应时长', '一次解决率', '满意度', '差评率'],
    mistakes: ['只道歉不解决', '与客户争对错', '不记录不复盘导致重复踩坑'],
    microtask: '写 3 条“客户生气”的回复：先共情，再给方案，再给时间点。'
  },
  {
    id: 'store',
    name: '门店经营',
    zone: '前线交易所',
    riasec: 'R / S',
    color: 'yellow',
    tagline: '现场执行、节奏管理与团队协作，让线下也能稳。',
    do: ['陈列与动线优化', '库存与补货节奏', '现场服务与突发处理', 'O2O到店/到家协同'],
    tools: ['执行清单', '库存表', '排班表', '现场复盘'],
    kpi: ['到店转化', '缺货率', '客诉率', '人效'],
    mistakes: ['只靠经验不做清单', '缺货/过期不预警', '只盯忙不盯结果'],
    microtask: '把“收货-上架-陈列-补货-盘点”写成 10 步标准流程清单。'
  },
  {
    id: 'ops',
    name: '电商运营',
    zone: '流量中枢塔',
    riasec: 'E / C',
    color: 'blue',
    tagline: '把目标拆成动作，把资源拉齐，把活动跑起来。',
    do: ['活动策划与节奏编排', '预算与资源协调', '投放策略与人群规划', '复盘与迭代推进'],
    tools: ['活动表', '目标拆解', '投放计划', '会议纪要与推进'],
    kpi: ['GMV', '转化率', '客单价', 'ROI', '库存周转'],
    mistakes: ['只做热闹不算账', '目标不拆到动作', '复盘只写“提升转化”不写怎么做'],
    microtask: '设一个目标：GMV/转化/客单价三项各写 1 个“可执行动作”。'
  },
  {
    id: 'data',
    name: '数据分析',
    zone: '流量中枢塔',
    riasec: 'I / C',
    color: 'emerald',
    tagline: '用归因与实验，把“哪里坏了”找出来，并给出能验证的解法。',
    do: ['指标体系与看板', '转化链路诊断', '流量归因与异常检测', '实验设计与效果评估'],
    tools: ['生意参谋/看板', '漏斗图', '对比分析', '实验记录'],
    kpi: ['CVR转化率', 'ROI', 'CAC获客成本', '留存/复购'],
    mistakes: ['只报数不解释原因', '只看单点不看链路', '不做实验就下结论'],
    microtask: '发现转化下降：写 3 个可能原因 + 每个原因的验证方法。'
  }
];

const QUIZ = [
  {
    q: '主图点击率很低，但流量不差。你最应该先找谁？',
    options: [
      { id: 'design', label: '视觉设计（改信息层级/卖点呈现）' },
      { id: 'cs', label: '客户服务（先道歉安抚）' },
      { id: 'store', label: '门店经营（先补货）' },
      { id: 'ops', label: '电商运营（先加预算）' }
    ],
    answer: 'design',
    why: '点击率低通常是“呈现不打动人/卖点不清晰”，先从主图与信息结构入手。'
  },
  {
    q: '转化率突然腰斩，你怀疑恶意点击或人群跑偏。先找谁？',
    options: [
      { id: 'data', label: '数据分析（归因诊断/定位异常）' },
      { id: 'design', label: '视觉设计（换风格）' },
      { id: 'store', label: '门店经营（现场排查）' },
      { id: 'product', label: '产品开发（换品）' }
    ],
    answer: 'data',
    why: '先用数据归因把“问题在哪一段链路”定位清楚，避免盲改。'
  },
  {
    q: '客户怒骂“超卖不发货”，准备给差评。谁来打第一通电话最合适？',
    options: [
      { id: 'cs', label: '客户服务（共情+方案+时点）' },
      { id: 'ops', label: '电商运营（解释活动规则）' },
      { id: 'design', label: '视觉设计（做公关海报）' },
      { id: 'data', label: '数据分析（拉表）' }
    ],
    answer: 'cs',
    why: '这种场景的关键是情绪与信任，先稳住关系，才能争取处理时间。'
  },
  {
    q: '要做一个大促活动：排期、资源、预算、人群都要推进。谁最像“总控”？',
    options: [
      { id: 'ops', label: '电商运营（目标拆解+推进协同）' },
      { id: 'data', label: '数据分析（建模）' },
      { id: 'cs', label: '客户服务（接待）' },
      { id: 'store', label: '门店经营（陈列）' }
    ],
    answer: 'ops',
    why: '运营岗位的核心是“把目标拆成动作并推进落地”，像活动总导演。'
  },
  {
    q: '线下门店出现缺货、陈列混乱、排班不合理，现场体验变差。先找谁？',
    options: [
      { id: 'store', label: '门店经营（现场执行与节奏管理）' },
      { id: 'design', label: '视觉设计（换海报）' },
      { id: 'data', label: '数据分析（看报表）' },
      { id: 'product', label: '产品开发（换配方）' }
    ],
    answer: 'store',
    why: '这类问题是现场执行链路，需要“流程清单+节奏管理+协作”立刻止血。'
  }
];

function pill(text, tone = 'gray') {
  const map = {
    gray: 'bg-gray-700/60 border-gray-500/40 text-gray-100',
    cyan: 'bg-cyan-500/20 border-cyan-400/40 text-cyan-200',
    red: 'bg-red-500/20 border-red-400/40 text-red-200',
    green: 'bg-green-500/20 border-green-400/40 text-green-200',
    yellow: 'bg-yellow-500/20 border-yellow-400/40 text-yellow-100',
    blue: 'bg-blue-500/20 border-blue-400/40 text-blue-200',
    emerald: 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
  };
  const cls = map[tone] ?? map.gray;
  return `<span class="px-2 py-1 text-sm border ${cls} font-[monospace]">${escapeHtml(text)}</span>`;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setBriefHeader(step, title, progress, nextLabel) {
  const stepEl = document.getElementById('cv-brief-step');
  const titleEl = document.getElementById('cv-brief-title');
  const progEl = document.getElementById('cv-brief-progress');
  const nextEl = document.getElementById('cv-brief-next');
  if (stepEl) stepEl.textContent = String(step);
  if (titleEl) titleEl.textContent = title;
  if (progEl) progEl.textContent = progress;
  if (nextEl) nextEl.textContent = nextLabel;
}

function updateBriefingStatusUI() {
  const briefingState = getRoleBriefingState();
  const statusEl = document.getElementById('cv-briefing-status');
  const btnEl = document.getElementById('cv-briefing-btn');
  if (!statusEl || !btnEl) return;

  if (!briefingState?.done) {
    statusEl.textContent = '岗位情报：未完成';
    btnEl.classList.add('animate-pulse');
  } else if (briefingState.skipped) {
    statusEl.textContent = '岗位情报：已跳过（建议补完）';
    btnEl.classList.add('animate-pulse');
  } else {
    statusEl.textContent = '岗位情报：已完成';
    btnEl.classList.remove('animate-pulse');
  }
}

function showRoleDetail(ri) {
  const role = ROLE_DATA.find((r) => r.id === ri) ?? ROLE_DATA[0];
  document.getElementById('cv-role-name').textContent = role.name;
  document.getElementById('cv-role-tagline').textContent = role.tagline;
  document.getElementById('cv-role-riasec').textContent = role.riasec;
  document.getElementById('cv-role-zone').textContent = role.zone;

  const doEl = document.getElementById('cv-role-do');
  doEl.innerHTML = role.do.map((x) => `<li>${escapeHtml(x)}</li>`).join('');

  const toolsEl = document.getElementById('cv-role-tools');
  toolsEl.innerHTML = role.tools.map((x) => pill(x, role.color)).join(' ');

  const kpiEl = document.getElementById('cv-role-kpi');
  kpiEl.innerHTML = role.kpi.map((x) => pill(x, 'gray')).join(' ');

  const misEl = document.getElementById('cv-role-mistakes');
  misEl.innerHTML = role.mistakes.map((x) => `<li>${escapeHtml(x)}</li>`).join('');

  document.getElementById('cv-role-microtask').textContent = role.microtask;

  document.querySelectorAll('[data-cv-role]').forEach((el) => {
    const selected = el.getAttribute('data-cv-role') === role.id;
    el.classList.toggle('ring-4', selected);
    el.classList.toggle('ring-cyan-300', selected);
    el.classList.toggle('ring-offset-0', selected);
  });
}

function renderRoleGrid() {
  const grid = document.getElementById('cv-role-grid');
  if (!grid) return;
  grid.innerHTML = ROLE_DATA.map((r) => {
    const tone =
      r.color === 'red'
        ? 'border-red-600 shadow-[0_0_20px_rgba(230,0,18,0.2)]'
        : r.color === 'cyan'
          ? 'border-cyan-500 shadow-[0_0_20px_rgba(0,243,255,0.12)]'
          : r.color === 'emerald'
            ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.12)]'
            : r.color === 'green'
              ? 'border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.12)]'
              : r.color === 'yellow'
                ? 'border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.12)]'
                : 'border-gray-700 shadow-[0_0_20px_rgba(255,255,255,0.06)]';

    return `
      <button data-cv-role="${escapeHtml(r.id)}" class="text-left bg-black border-4 ${tone} cut-corner p-3 transition-transform hover:scale-[1.02]" onclick="window.RoleBriefing?.select?.('${escapeHtml(r.id)}')">
        <div class="text-gray-400 text-xs font-[monospace]">${escapeHtml(r.riasec)} · ${escapeHtml(r.zone.split(' / ')[0])}</div>
        <div class="text-2xl font-black text-white mt-1">${escapeHtml(r.name)}</div>
        <div class="text-gray-300 text-sm mt-1">${escapeHtml(r.tagline)}</div>
      </button>
    `;
  }).join('');
}

function quizRender(state) {
  const total = QUIZ.length;
  document.getElementById('cv-quiz-total').textContent = String(total);
  document.getElementById('cv-quiz-score').textContent = String(state.correct);
  document.getElementById('cv-quiz-index').textContent = String(state.index + 1);

  const item = QUIZ[state.index];
  document.getElementById('cv-quiz-question').textContent = item.q;

  const opts = document.getElementById('cv-quiz-options');
  opts.innerHTML = item.options
    .map((o) => {
      const picked = state.answers[state.index] === o.id;
      return `
        <button class="btn-hacker skew-box px-6 py-5 text-left text-xl ${picked ? 'border-emerald-400' : ''}" onclick="window.RoleBriefing?.pick?.('${escapeHtml(o.id)}')">
          <span class="unskew-text">${escapeHtml(o.label)}</span>
        </button>
      `;
    })
    .join('');

  const fb = document.getElementById('cv-quiz-feedback');
  const picked = state.answers[state.index];
  if (!picked) {
    fb.classList.add('hidden');
    fb.textContent = '';
  } else {
    const ok = picked === item.answer;
    fb.classList.remove('hidden');
    fb.classList.toggle('text-emerald-300', ok);
    fb.classList.toggle('text-red-300', !ok);
    fb.textContent = (ok ? '✅ 正确：' : '❌ 更合适的是：') + item.why;
  }

  const nextLabel = state.index === total - 1 ? '完成训练' : '下一题';
  const nextBtn = document.getElementById('cv-quiz-next');
  if (nextBtn) nextBtn.textContent = nextLabel;

  const done = state.index === total - 1 && state.answers[state.index];
  document.getElementById('cv-quiz-done').classList.toggle('hidden', !done);
}

window.RoleBriefing = (() => {
  const defaultState = {
    done: false,
    skipped: false,
    activeRole: ROLE_DATA[0].id,
    step: 1,
    quiz: { index: 0, answers: [], correct: 0 }
  };

  function read() {
    return getRoleBriefingState() ?? defaultState;
  }

  function write(patch) {
    const next = { ...read(), ...patch };
    setRoleBriefingState(next);
    return next;
  }

  function enter() {
    const state = read();
    renderRoleGrid();
    showRoleDetail(state.activeRole);
    showStep(state.step, state);
  }

  function showStep(step, state = read()) {
    const detail = document.getElementById('cv-role-detail');
    const quiz = document.getElementById('cv-role-quiz');
    if (!detail || !quiz) return;

    if (step === 1) {
      detail.classList.remove('hidden');
      quiz.classList.add('hidden');
      setBriefHeader(1, '六大岗位：你将做什么？', '岗位速览', '开始识别训练');
      return;
    }

    detail.classList.add('hidden');
    quiz.classList.remove('hidden');
    setBriefHeader(2, '岗位识别训练：遇到问题找谁？', '识别训练', '继续训练');
    quizRender(state.quiz);
  }

  function select(roleId) {
    const state = write({ activeRole: roleId });
    showRoleDetail(state.activeRole);
  }

  function next() {
    const state = read();
    if (state.step === 1) {
      const nextState = write({ step: 2 });
      showStep(2, nextState);
      return;
    }
    // in quiz step, next delegates to nextQuiz
    nextQuiz();
  }

  function skip() {
    write({ skipped: true, done: true });
    // Use the existing global switchScreen from index.html
    window.switchScreen?.('screen-hub');
    updateBriefingStatusUI();
  }

  function pick(roleId) {
    const state = read();
    const quiz = { ...state.quiz };
    quiz.answers = [...(quiz.answers ?? [])];
    quiz.answers[quiz.index] = roleId;
    quiz.correct = quiz.answers.reduce((acc, ans, idx) => acc + (ans === QUIZ[idx].answer ? 1 : 0), 0);
    const nextState = write({ quiz });
    quizRender(nextState.quiz);
  }

  function prevQuiz() {
    const state = read();
    const quiz = { ...state.quiz, index: Math.max(0, state.quiz.index - 1) };
    const nextState = write({ quiz });
    quizRender(nextState.quiz);
  }

  function nextQuiz() {
    const state = read();
    const total = QUIZ.length;
    if (!state.quiz.answers[state.quiz.index]) return; // must pick first

    if (state.quiz.index < total - 1) {
      const quiz = { ...state.quiz, index: state.quiz.index + 1 };
      const nextState = write({ quiz });
      quizRender(nextState.quiz);
      return;
    }
    // last question answered => show done panel
    quizRender(state.quiz);
  }

  function finish() {
    write({ done: true, skipped: false });
    window.switchScreen?.('screen-hub');
    updateBriefingStatusUI();
  }

  return { enter, select, next, skip, pick, prevQuiz, nextQuiz, finish };
})();
