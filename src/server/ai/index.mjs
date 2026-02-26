import { ollamaChat } from './providers/ollama.mjs';
import { localCoachReply } from './providers/local.mjs';

export async function aiReply({ env, db, userText, resultId, messages, ageGroup }) {
  const result = resultId ? db.get('select * from results where id = ?', [resultId]) : null;
  const riasec = result ? safeJson(result.riasec_json) : null;
  const skills = result ? safeJson(result.skills_json) : null;
  const rec = result ? safeJson(result.recommendations_json) : null;

  const context = {
    code: result?.code,
    topDims: riasec?.top ?? [],
    riasecRaw: riasec?.raw,
    riasecPct: riasec?.pct,
    skillsTop: skills?.top ?? [],
    skillsPct: skills?.pct,
    recommendations: rec
  };

  // Try Ollama first if configured; otherwise fallback.
  try {
    const system = [
      '你是“职境纪元 CareerVerse”的职业测评教练。',
      '目标：把测评结果转成可执行的下一步计划，语言要友好、具体、鼓励但不鸡汤。',
      '注意：面向中职学生/中小学生/成人；避免过于成人化或高压力表达。',
      '',
      `测评上下文(JSON)：${JSON.stringify({ ageGroup, ...context })}`
    ].join('\n');

    const ollamaMessages = [
      { role: 'system', content: system },
      ...(Array.isArray(messages) && messages.length ? messages : []),
      { role: 'user', content: userText ?? '' }
    ];

    const reply = await ollamaChat({
      baseUrl: env.OLLAMA_BASE_URL,
      model: env.OLLAMA_MODEL,
      messages: ollamaMessages
    });
    return { provider: 'ollama', content: reply.content };
  } catch {
    const local = localCoachReply({ userText, result: context, ageGroup });
    return { provider: 'local', content: local.content };
  }
}

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
