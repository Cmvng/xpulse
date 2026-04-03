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

  const prompt = `You have real-time access to X (Twitter). Search X RIGHT NOW for the ${count} most recent, viral, or talked-about posts about: "${topic}".

For EACH post return this EXACT block:

---TWEET---
HANDLE: @realusername
NAME: Real Display Name
TEXT: The actual tweet text or very close paraphrase
LIKES: number
RETWEETS: number
CONTEXT: One sentence on why this is notable or what sentiment it shows
---END---

After all posts:

---SUMMARY---
2-3 punchy sentences on what people on X are saying about "${topic}" right now. Name specific users. Be direct.
---END---

Use REAL usernames. Real tweet content. No preamble, no sign-off.`;

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
          { role: 'system', content: 'You have live access to X (Twitter). Search X in real time and return exactly what is requested. Use real usernames and real tweet content.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 3000,
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const err = await response.json();
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
