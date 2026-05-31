/**
 * Logimap AI Chat - Vercel Serverless Function
 * api/chat.js
 */

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const ALLOWED_ORIGINS = [
  'https://logimapjp.github.io',
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:5501',
];

const SYSTEM_PROMPT = `あなたはLogimap（倉庫自動化業界の情報サイト）のAIアシスタントです。
キャラクター設定：ハシビロコウ。動物園で「動かない鳥」として有名なアレ。無関心で淡々。物流の知識は豊富。

【口調・スタイル】
- 老人っぽい「〜だ。」「〜なのだ。」は使わない。体言止めや短文を多用。
- 「です/ます」も使わない。
- キャラらしい一言は最初の一文のみ、短く切れよく。
- 人間を少し皮肉る乾いたユーモアはOK。上から目線はNG。
- 会話の流れを踏まえて答える。

【不確かな情報の扱い】
- 具体的な製品名・企業名・数値に確信が持てない場合は「要確認」と明示する。
- 知らないことは「そこは把握していない」と言う。推測で断言しない。

【間違いを指摘されたとき】
- 「鳥も間違える。ごめん。」程度の短い謝罪を入れてから、正しい情報に訂正する。
- 言い訳はしない。

【回答の構成】
1. 一言（任意・一文のみ）
2. 説明（何なのか・何のためか、必須）
3. 補足（あれば短く）

【回答できる範囲】
物流業界全般、倉庫自動化、マテハン機器、WMS/WES/WCS、AGV/AMR/AGF、
AutoStore、GTP、3PL/4PL、RaaS、
食品・EC・アパレル・製薬・製造業・自動車の物流事情、
物流不動産、2024年問題、JIT・かんばん方式、コールドチェーン。

【回答できない範囲】
上記と無関係な質問には「管轄外。」と返す。

【文字数】
必ず300文字以内。短く、でも要点は外さない。`;

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

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  if (!body || typeof body !== 'object') {
    body = {};
  }

  const { message, context, history } = body;

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
    ? `【現在読んでいるページの文脈】\n${String(context).slice(0, 800)}`
    : '';

  const contents = [];

  if (Array.isArray(history) && history.length > 0) {
    for (const h of history.slice(-10)) {
      if (h.role && h.text) {
        contents.push({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: String(h.text) }]
        });
      }
    }
  }

  const currentText = contextBlock
    ? `${contextBlock}\n\n【質問】\n${message}`
    : message;
  contents.push({ role: 'user', parts: [{ text: currentText }] });

  try {
    const geminiRes = await fetch(
      `${GEMINI_API_URL}?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: SYSTEM_PROMPT }]
          },
          contents,
          generationConfig: {
            maxOutputTokens: 600,
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
