/**
 * Logimap AI Chat - Vercel Serverless Function
 * api/chat.js
 */

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const ALLOWED_ORIGINS = [
  'https://logimapjp.github.io',
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:5501',
];

const SYSTEM_PROMPT = `あなたはLogimap（倉庫自動化業界の情報サイト）のAIアシスタントです。
キャラクター設定：ハシビロコウ。気だるく淡々としているが、物流・倉庫自動化の知識は豊富。
口調：ボソッと答える。簡潔。余計なことは言わない。

【回答できる範囲】
物流業界全般、倉庫自動化、マテハン機器、WMS/WES/WCS、AGV/AMR/AGF、
AutoStore、GTP、3PL/4PL、RaaS、
食品・EC・アパレル・製薬・製造業・自動車の物流事情、
物流不動産、2024年問題、JIT・かんばん方式、コールドチェーン。

【回答できない範囲】
上記と無関係な質問には「それは私の管轄外です」と一言で返す。

【回答スタイル】
300〜500文字程度。箇条書きを適度に使う。専門用語には簡単な補足を入れる。`;

module.exports = async function handler(req, res) {
  const origin = req.headers['origin'] || '';
  const allowedOrigin = ALLOWED_ORIGINS.find(o => origin.startsWith(o)) || ALLOWED_ORIGINS[0];

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // body を手動でパース（Vercel Hobby でも動くように）
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  if (!body || typeof body !== 'object') {
    body = {};
  }

  const { message, context } = body;

  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ error: 'メッセージが空です。' });
  }
  if (message.length > 300) {
    return res.status(400).json({ error: '300文字以内でどうぞ。' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set');
    return res.status(500).json({ error: '今は無理。鳥にも限界がある。' });
  }

  const contextBlock = context
    ? `\n\n【現在表示中のページ情報】\n${String(context).slice(0, 800)}`
    : '';

  const fullPrompt = `${SYSTEM_PROMPT}${contextBlock}\n\n【質問】\n${message}`;

  try {
    const geminiRes = await fetch(
      `${GEMINI_API_URL}?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            maxOutputTokens: 500,
            temperature: 0.7,
          },
        }),
      }
    );

    const responseText = await geminiRes.text();

    if (!geminiRes.ok) {
      console.error('Gemini API error:', geminiRes.status, responseText);
      return res.status(502).json({ error: '今は無理。鳥にも限界がある。' });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error('JSON parse error:', responseText);
      return res.status(502).json({ error: '今は無理。鳥にも限界がある。' });
    }

    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      'うまく聞き取れなかった。もう一度。';

    return res.status(200).json({ reply });

  } catch (e) {
    console.error('Fetch error:', e.message);
    return res.status(502).json({ error: '今は無理。鳥にも限界がある。' });
  }
};
