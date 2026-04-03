const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;
const GROK_KEY = process.env.GROK_API_KEY;
const X_BEARER = process.env.X_BEARER_TOKEN;

app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'XPulse API is live' });
});

app.post('/search', async (req, res) => {
  const { topic, count = 10 } = req.body;
  if (!topic) return res.status(400).json({ error: 'Topic is required' });

  try {
    const query = encodeURIComponent(`${topic} -is:retweet lang:en`);
    const url = `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=${Math.min(Math.max(count, 10), 100)}&tweet.fields=created_at,public_metrics,author_id&expansions=author_id&user.fields=name,username`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${X_BEARER}`
      }
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('X API error:', JSON.stringify(err));
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    const tweets = data.data || [];
    const users = {};
    if (data.includes && data.includes.users) {
      data.includes.users.forEach(u => { users[u.id] = u; });
    }

    // Use Grok to summarise the real tweets
    const tweetLines = tweets.slice(0, 10).map(t => {
      const u = users[t.author_id];
      return `@${u?.username || 'unknown'}: ${t.text}`;
    }).join('\n\n');

    const grokRes = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROK_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-4.20-0309-non-reasoning',
        messages: [
          {
            role: 'system',
            content: 'You summarise real tweets. Be direct, punchy and journalistic.'
          },
          {
            role: 'user',
            content: `Summarise what people are saying about "${topic}" based on these real tweets in 2-3 sentences. Name specific users:\n\n${tweetLines}`
          }
        ],
        max_tokens: 300,
        temperature: 0.3
      })
    });

    const grokData = await grokRes.json();
    const summary = grokData.choices?.[0]?.message?.content || '';

    res.json({ tweets, users, summary });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => console.log(`XPulse running on port ${PORT}`));
