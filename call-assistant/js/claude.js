// Прямые запросы к Anthropic Messages API из браузера собственным ключом пользователя.
// Ключ хранится только в localStorage на устройстве и никогда не уходит на сторонние серверы.

const CLAUDE_MODELS = [
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (быстрый, рекомендуем)' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 (умнее, чуть медленнее)' },
];

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

class ClaudeError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function askClaude({ apiKey, model, system, prompt, maxTokens = 400, signal }) {
  if (!apiKey) throw new ClaudeError('Не задан API-ключ Anthropic. Откройте «Настройки».');

  let res;
  try {
    res = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ClaudeError('Не удалось связаться с api.anthropic.com. Проверьте интернет-соединение.');
  }

  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.error?.message || ''; } catch {}
    if (res.status === 401) throw new ClaudeError('Неверный API-ключ. Проверьте его в «Настройках».', 401);
    if (res.status === 429) throw new ClaudeError('Превышен лимит запросов к Claude API. Подождите немного.', 429);
    throw new ClaudeError(`Ошибка Claude API (${res.status}): ${detail || 'неизвестная ошибка'}`, res.status);
  }

  const data = await res.json();
  const text = (data.content || []).map(b => b.text || '').join('').trim();
  return text;
}
