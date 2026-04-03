const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;
const GROK_KEY = process.env.GROK_API_KEY;

app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'XPulse API is live' });
});

app.post('/search', async (req, res) => {
  const { topic, count = 10 } = req.body;
  if (!topic) return res.status(400).json({ error: 'Topic is required' });

  const today = new Date().toDateString();

  const prompt = `Today is ${today}. Search your live X (Twitter) knowledge and find the ${count} most recent posts about "${topic}" from the last 24-48 hours.

For EACH post return this EXACT block:

---TWEET---
HANDLE: @realusername
NAME: Real Display Name
TEXT: The actual tweet text
LIKES: number
RETWEETS: number
CONTEXT: One sentence on the sentiment or why this post is notable
---END---

After all posts:

---SUMMARY---
2-3 punchy sentences summarising what people on X are saying about "${topic}" right now today ${today}. Name real users. Be direct.
---END---

IMPORTANT: Only return posts from the last 48 hours. Use real @usernames that exist on X. Real tweet text only.`;

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROK_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-3-latest',
        messages: [
          {
            role: 'system',
            content: `You are Grok, built by xAI, with real-time access to X (Twitter) posts. Today is ${today}. When asked about topics, search X for the most recent posts from today and yesterday only. Never use old or outdated information. Always return current posts with real usernames.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 3000,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('Grok error:', JSON.stringify(err));
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || '';
    res.json({ raw });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reach Grok API' });
  }
});

app.listen(PORT, () => console.log(`XPulse running on port ${PORT}`));
