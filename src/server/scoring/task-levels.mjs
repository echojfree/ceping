export function evaluateTaskLevel(type, scoring, value) {
  if (type === 'drag') {
    const order = Array.isArray(value?.order) ? value.order.map(String) : [];
    const correct = Array.isArray(scoring?.correctOrder) ? scoring.correctOrder.map(String) : [];
    const k = Math.min(3, correct.length);
    if (!k || order.length < k) return 'poor';
    let hit = 0;
    for (let i = 0; i < k; i += 1) if (order[i] === correct[i]) hit += 1;
    if (hit >= k) return 'excellent';
    if (hit >= Math.max(1, k - 1)) return 'good';
    return 'poor';
  }

  if (type === 'fill') {
    const fields = value?.fields && typeof value.fields === 'object' ? value.fields : {};
    const required = scoring?.requiredFields ?? [];
    const minFilled = Number(scoring?.minFilled ?? Math.max(1, required.length));
    let filled = 0;
    for (const k of required) {
      const v = String(fields?.[k] ?? '').trim();
      if (v.length >= 2) filled += 1;
    }
    if (filled >= Math.max(minFilled, required.length)) return 'excellent';
    if (filled >= minFilled) return 'good';
    return 'poor';
  }

  if (type === 'cmd') {
    const cmd = String(value?.cmd ?? value ?? '').trim().toLowerCase();
    if (!cmd) return 'poor';
    const allowed = Array.isArray(scoring?.acceptedCommands) ? scoring.acceptedCommands.map((s) => String(s).toLowerCase()) : [];
    const token = cmd.split(/\s+/)[0];
    if (allowed.includes(token) || allowed.includes(cmd)) return 'excellent';
    const prefixes = Array.isArray(scoring?.acceptedPrefixes) ? scoring.acceptedPrefixes.map((s) => String(s).toLowerCase()) : [];
    if (prefixes.some((p) => token.startsWith(p))) return 'good';
    return 'poor';
  }

  return 'poor';
}

