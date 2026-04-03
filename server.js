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
    // -is:reply -is:retweet ensures only original posts
    const query = encodeURIComponent(`${topic} -is:reply -is:retweet lang:en`);
    const url = `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=50&tweet.fields=created_at,public_metrics,author_id,conversation_id&expansions=author_id&user.fields=name,username`;

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${X_BEARER}` }
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('X API error:', JSON.stringify(err));
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    let tweets = data.data || [];
    const users = {};
    if (data.includes && data.includes.users) {
      data.includes.users.forEach(u => { users[u.id] = u; });
    }

    // Sort by engagement: likes + retweets*2 + replies
    tweets.sort((a, b) => {
      const engA = (a.public_metrics?.like_count||0) + (a.public_metrics?.retweet_count||0)*2 + (a.public_metrics?.reply_count||0);
      const engB = (b.public_metrics?.like_count||0) + (b.public_metrics?.retweet_count||0)*2 + (b.public_metrics?.reply_count||0);
      return engB - engA;
    });

    // Take top N
    tweets = tweets.slice(0, count);

    // Build tweet content for Grok to summarise
    const tweetContent = tweets.map(t => {
      const u = users[t.author_id];
      const m = t.public_metrics || {};
      return `@${u?.username||'unknown'} (${m.like_count||0} likes, ${m.retweet_count||0} retweets): ${t.text}`;
    }).join('\n\n');

    // Ask Grok for a clean summary
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
            content: 'You summarise social media posts. Write in plain English. No markdown, no asterisks, no bullet points. Be clear, direct and journalistic.'
          },
          {
            role: 'user',
            content: `These are real posts from X about "${topic}". Write a clear 2-3 sentence overview of what people are generally saying about this topic. Focus on the overall mood, key opinions, and any patterns you notice. Then on a new line write "Top voices:" followed by the 3 most engaged posts in the format: @handle says "[short quote]" — [one sentence on why it stands out].\n\nPosts:\n${tweetContent}`
          }
        ],
        max_tokens: 400,
        temperature: 0.2
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
