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

function $(id) {
  return document.getElementById(id);
}

function setText(id, txt) {
  const el = $(id);
  if (el) el.textContent = txt;
}

function getAgeGroup() {
  return localStorage.getItem('cv_age_group') || 'secondary';
}

function setAgeGroup(v) {
  localStorage.setItem('cv_age_group', v);
}

function dimArrayFromPct(pct) {
  const dims = ['R', 'I', 'A', 'S', 'E', 'C'];
  return dims.map((d) => Number(pct?.[d] ?? 0));
}

let chartInstance = null;

function renderChart(pct) {
  const ctx = $('chart')?.getContext('2d');
  if (!ctx) return;
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['R', 'I', 'A', 'S', 'E', 'C'],
      datasets: [
        {
          data: dimArrayFromPct(pct),
          backgroundColor: 'rgba(56, 189, 248, 0.2)',
          borderColor: '#38bdf8',
          borderWidth: 2,
          pointBackgroundColor: '#38bdf8'
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
}

async function main() {
  $('age').value = getAgeGroup();
  $('age').addEventListener('change', () => setAgeGroup($('age').value));

  setText('status', '正在加载题目...');
  const data = await api('/api/assessments/riasec-quick');
  const questions = data.questions;
  setText('status', `已加载 ${questions.length} 题`);

  const answers = new Map(); // questionId -> number 1..5
  let index = 0;

  function render() {
    const q = questions[index];
    setText('progress', `${index + 1}/${questions.length}`);
    setText('prompt', q.prompt);

    $('btn-prev').disabled = index === 0;
    $('btn-next').textContent = index === questions.length - 1 ? '提交并生成报告' : '下一题';

    const selected = answers.get(q.id);
    $('options').innerHTML = q.options
      .map((o) => {
        const active = selected === o.id;
        return `
          <button
            data-v="${o.id}"
            class="px-3 py-3 rounded border text-sm ${
              active
                ? 'bg-emerald-600 border-emerald-400 font-bold'
                : 'bg-slate-950 border-slate-800 hover:border-slate-600'
            }"
          >${o.label}</button>
        `;
      })
      .join('');
    $('options').querySelectorAll('button[data-v]').forEach((btn) => {
      btn.addEventListener('click', () => {
        answers.set(q.id, Number(btn.dataset.v));
        render();
      });
    });
  }

  async function submit() {
    if (answers.size !== questions.length) {
      setText('status', '还有题目未作答，请补全后再提交。');
      return;
    }
    setText('status', '生成报告中...');
    const payload = {
      ageGroup: getAgeGroup(),
      answers: questions.map((q) => ({ questionId: q.id, value: answers.get(q.id) }))
    };
    const r = await api('/api/assessments/riasec-quick/submit', { method: 'POST', body: payload });
    const result = r.result;

    $('view-quiz').classList.add('hidden');
    $('view-result').classList.remove('hidden');

    setText('code', result.code);
    setText('role', result.recommendations.matchedRole);
    setText('summary', result.recommendations.summary);
    renderChart(result.pct);

    const link = `/tasks?resultId=${encodeURIComponent(result.id)}`;
    $('btn-open-tasks').href = link;
    $('qr').src = `/api/results/${encodeURIComponent(result.id)}/qr`;

    $('btn-chat').addEventListener('click', async () => {
      const userText = $('chat-input').value.trim();
      if (!userText) return;
      $('btn-chat').disabled = true;
      $('chat-out').textContent = 'AI 教练思考中...';
      try {
        const rep = await api('/api/ai/chat', {
          method: 'POST',
          body: { resultId: result.id, userText, ageGroup: getAgeGroup() }
        });
        $('chat-out').textContent = rep.reply.content;
      } catch (e) {
        $('chat-out').textContent = `请求失败：${e.status ?? '?'} ${e.data?.error ?? 'unknown'}`;
      } finally {
        $('btn-chat').disabled = false;
      }
    });

    setText('status', '报告已生成');
  }

  $('btn-prev').addEventListener('click', () => {
    if (index > 0) index -= 1;
    render();
  });
  $('btn-next').addEventListener('click', async () => {
    const q = questions[index];
    if (!answers.get(q.id)) {
      setText('status', '请选择一个选项后再继续。');
      return;
    }
    setText('status', '');
    if (index === questions.length - 1) await submit();
    else {
      index += 1;
      render();
    }
  });

  render();
}

main();

