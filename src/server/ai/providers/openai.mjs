function cleanBaseUrl(baseUrl) {
  return String(baseUrl ?? '').replace(/\/$/, '');
}

export async function openaiChat({ baseUrl, apiKey, model, messages, temperature = 0.6 }) {
  const url = `${cleanBaseUrl(baseUrl)}/chat/completions`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      stream: false
    })
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`OpenAI-compatible error: ${r.status} ${t}`);
  }
  const data = await r.json();
  const content = data?.choices?.[0]?.message?.content ?? '';
  if (!content) throw new Error('OpenAI-compatible: empty response');
  return { content };
}

export async function* openaiStreamChat({ baseUrl, apiKey, model, messages, temperature = 0.6, signal }) {
  const url = `${cleanBaseUrl(baseUrl)}/chat/completions`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      stream: true
    }),
    signal
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`OpenAI-compatible error: ${r.status} ${t}`);
  }
  if (!r.body) throw new Error('OpenAI-compatible: no response body');

  const decoder = new TextDecoder();
  const reader = r.body.getReader();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data) continue;
      if (data === '[DONE]') return;

      let json;
      try {
        json = JSON.parse(data);
      } catch {
        continue;
      }

      const delta = json?.choices?.[0]?.delta?.content ?? '';
      if (delta) yield delta;
    }
  }
}

