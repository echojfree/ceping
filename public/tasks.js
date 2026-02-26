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

function qs(name) {
  return new URLSearchParams(location.search).get(name);
}

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function main() {
  const resultId = qs('resultId');
  if (!resultId) {
    $('meta').textContent = '缺少 resultId 参数';
    return;
  }

  const { result } = await api(`/api/results/${encodeURIComponent(resultId)}`);
  $('meta').textContent = `代码：${result.code} · 年龄段：${result.ageGroup ?? '-'} · 时间：${result.createdAt}`;

  const rec = result.recommendations ?? {};
  $('role').textContent = rec.matchedRole ?? '-';
  $('role-desc').textContent = rec.matchedRoleDesc ?? '';
  $('skill-notes').textContent = rec.skillNotes ?? '';

  $('qr').src = `/api/results/${encodeURIComponent(resultId)}/qr`;

  const tasks = rec.tasks ?? [];
  $('tasks').innerHTML = tasks
    .map(
      (t) => `
      <div class="border border-slate-800 rounded-xl p-4 bg-slate-900/30">
        <div class="font-bold">${escapeHtml(t.title)}</div>
        <div class="text-slate-300 text-sm mt-2">${escapeHtml(t.desc)}</div>
      </div>`
    )
    .join('');

  renderSkills(result.skills);

  $('btn-chat').addEventListener('click', async () => {
    const userText = $('chat-input').value.trim();
    if (!userText) return;
    $('btn-chat').disabled = true;
    $('chat-out').textContent = 'AI 教练思考中...';
    try {
      const data = await api('/api/ai/chat', {
        method: 'POST',
        body: { resultId, userText, ageGroup: result.ageGroup }
      });
      $('chat-out').textContent = data.reply.content;
    } catch (e) {
      $('chat-out').textContent = `请求失败：${e.status ?? '?'} ${e.data?.error ?? 'unknown'}`;
    } finally {
      $('btn-chat').disabled = false;
    }
  });
}

function renderSkills(skills) {
  const el = $('skills');
  if (!el) return;
  const pct = skills?.pct ?? {};
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
    .map(([k, v]) => [k, Number(v ?? 0)])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  if (!entries.length) {
    el.innerHTML = `<div class="text-slate-400 text-sm">（本结果暂无技能数据）</div>`;
    return;
  }

  el.innerHTML = entries
    .map(([k, v]) => {
      const width = Math.max(0, Math.min(100, v));
      return `
        <div class="flex items-center gap-3">
          <div class="w-28 text-xs text-slate-300">${labels[k]}</div>
          <div class="flex-1 h-3 bg-slate-950 border border-slate-800 overflow-hidden rounded">
            <div class="h-3 bg-emerald-500" style="width:${width}%"></div>
          </div>
          <div class="w-10 text-right text-xs text-slate-400">${width}</div>
        </div>
      `;
    })
    .join('');
}

main();
