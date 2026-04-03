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

  const prompt = `Search X right now for the top ${count} most recent and engaging posts about: "${topic}".

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
2-3 punchy sentences summarising what people on X are saying about "${topic}" right now. Name real users. Be direct.
---END---

Only use real posts you can actually find on X right now. Real usernames, real text, real numbers.`;

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
            content: 'You are Grok with live access to X. Use your real-time X search to find actual current posts. Only return real posts that exist on X right now.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        search_parameters: {
          mode: 'on',
          sources: [
            {
              type: 'x'
            }
          ],
          max_search_results: count
        },
        max_tokens: 3000,
        temperature: 0.1
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
