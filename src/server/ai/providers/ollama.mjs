export async function ollamaChat({ baseUrl, model, messages }) {
  const url = `${baseUrl.replace(/\/$/, '')}/api/chat`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false
    })
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`Ollama error: ${r.status} ${t}`);
  }
  const data = await r.json();
  const content = data?.message?.content ?? data?.response;
  if (!content) throw new Error('Ollama: empty response');
  return { content };
}
