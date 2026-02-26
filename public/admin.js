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

function show(el, yes) {
  if (!el) return;
  el.classList.toggle('hidden', !yes);
}

async function refreshAll() {
  const overview = await api('/api/admin/overview');
  $('stat-users').textContent = String(overview.userCount);
  $('stat-results').textContent = String(overview.resultCount);
  $('stat-assessments').textContent = String(overview.assessmentCount);

  const assessments = await api('/api/admin/assessments');
  $('tbl-assessments').innerHTML = assessments.assessments
    .map(
      (a) => `
      <tr class="align-top">
        <td class="py-2 pr-2 font-mono">${escapeHtml(a.slug)}</td>
        <td class="py-2 pr-2">${escapeHtml(a.title)}</td>
        <td class="py-2 pr-2">${escapeHtml(a.kind)}</td>
        <td class="py-2 pr-2">${a.is_active ? '<span class="text-emerald-400">启用</span>' : '<span class="text-slate-500">停用</span>'}</td>
      </tr>`
    )
    .join('');

  const results = await api('/api/results?limit=50');
  $('tbl-results').innerHTML = results.results
    .map(
      (r) => `
      <tr class="align-top">
        <td class="py-2 pr-2 whitespace-nowrap">${escapeHtml(r.created_at)}</td>
        <td class="py-2 pr-2">${escapeHtml(r.assessment_title)}</td>
        <td class="py-2 pr-2 font-mono font-bold">${escapeHtml(r.code)}</td>
        <td class="py-2 pr-2 text-slate-400">${escapeHtml(r.user_email ?? '（匿名）')}</td>
      </tr>`
    )
    .join('');
}

async function exportCsv() {
  const results = await api('/api/results?limit=200');
  const headers = ['created_at', 'assessment_slug', 'assessment_title', 'code', 'age_group', 'user_email', 'id'];
  const rows = results.results.map((r) => [
    r.created_at,
    r.assessment_slug,
    r.assessment_title,
    r.code,
    r.age_group,
    r.user_email ?? '',
    r.id
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `careerverse-results-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[\",\\n]/.test(s)) return `"${s.replaceAll('\"', '\"\"')}"`;
  return s;
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
  const me = await api('/api/auth/me');
  const isAdmin = me?.user?.role === 'admin';

  show($('login-card'), !isAdmin);
  show($('admin-content'), isAdmin);
  show($('btn-logout'), isAdmin);

  if (isAdmin) {
    await refreshAll();
    $('btn-refresh').addEventListener('click', refreshAll);
    $('btn-export').addEventListener('click', exportCsv);
    $('btn-logout').addEventListener('click', async () => {
      await api('/api/auth/logout', { method: 'POST' });
      location.reload();
    });
    return;
  }

  $('btn-login').addEventListener('click', async () => {
    show($('login-error'), false);
    try {
      await api('/api/auth/login', {
        method: 'POST',
        body: {
          email: $('login-email').value || 'admin@local',
          password: $('login-password').value || 'admin123456'
        }
      });
      location.reload();
    } catch (e) {
      $('login-error').textContent = `登录失败（${e.status ?? '?'}）：${e.data?.error ?? 'unknown'}`;
      show($('login-error'), true);
    }
  });
}

main();
